import { ExamType, PassCutSnapshotStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildPassCutPredictionRows } from "@/lib/pass-cut";
import {
  evaluateAutoPassCutRows,
  resolveNextReleaseNumberFromList,
  runAutoPassCutRelease,
  toSnapshotFromEvaluatedRow,
} from "@/lib/pass-cut-auto-release";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseExamType(value: string | null): ExamType | null {
  if (value === ExamType.PUBLIC) return ExamType.PUBLIC;
  if (value === ExamType.CAREER_RESCUE) return ExamType.CAREER_RESCUE;
  if (value === ExamType.CAREER_ACADEMIC) return ExamType.CAREER_ACADEMIC;
  if (value === ExamType.CAREER_EMT) return ExamType.CAREER_EMT;
  return null;
}

function fallbackCurrentSnapshot() {
  return {
    participantCount: 0,
    recruitCount: 0,
    applicantCount: null,
    targetParticipantCount: null,
    coverageRate: null,
    stabilityScore: null,
    status: PassCutSnapshotStatus.COLLECTING_INSUFFICIENT_SAMPLE,
    statusReason: "표본 부족",
    averageScore: null,
    oneMultipleCutScore: null,
    sureMinScore: null,
    likelyMinScore: null,
    possibleMinScore: null,
  };
}

function toFallbackStatus(params: {
  participantCount: number;
  applicantCount: number | null;
  oneMultipleCutScore: number | null;
}) {
  if (params.applicantCount === null) {
    return {
      status: PassCutSnapshotStatus.COLLECTING_MISSING_APPLICANT_COUNT,
      statusReason: "응시인원 미입력",
    };
  }
  if (params.participantCount < 1 || params.oneMultipleCutScore === null) {
    return {
      status: PassCutSnapshotStatus.COLLECTING_INSUFFICIENT_SAMPLE,
      statusReason: "표본 부족",
    };
  }
  return {
    status: PassCutSnapshotStatus.READY,
    statusReason: null,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examIdQuery = parsePositiveInt(searchParams.get("examId"));
  const regionId = parsePositiveInt(searchParams.get("regionId"));
  const examType = parseExamType(searchParams.get("examType"));

  if (!regionId) {
    return NextResponse.json({ error: "regionId is required." }, { status: 400 });
  }
  if (!examType) {
    return NextResponse.json({ error: "examType must be PUBLIC, CAREER_RESCUE, CAREER_ACADEMIC, or CAREER_EMT." }, { status: 400 });
  }

  const examId =
    examIdQuery ??
    (
      await prisma.exam.findFirst({
        where: { isActive: true },
        orderBy: [{ examDate: "desc" }, { id: "desc" }],
        select: { id: true },
      })
    )?.id ??
    null;

  if (!examId) {
    return NextResponse.json({
      releases: [],
      current: fallbackCurrentSnapshot(),
    });
  }

  let autoRows = [] as Awaited<ReturnType<typeof evaluateAutoPassCutRows>>;
  try {
    const autoResult = await runAutoPassCutRelease({
      examId,
      trigger: "traffic",
    });
    if (autoResult.rows.length > 0) {
      autoRows = autoResult.rows;
    }
  } catch (error) {
    console.error("Auxiliary auto pass-cut trigger failed", error);
  }

  const releases = await prisma.passCutRelease.findMany({
    where: { examId },
    orderBy: [{ releaseNumber: "asc" }, { id: "asc" }],
    select: {
      releaseNumber: true,
      releasedAt: true,
      participantCount: true,
      snapshots: {
        where: {
          regionId,
          examType,
        },
        select: {
          participantCount: true,
          recruitCount: true,
          applicantCount: true,
          targetParticipantCount: true,
          coverageRate: true,
          stabilityScore: true,
          status: true,
          statusReason: true,
          averageScore: true,
          oneMultipleCutScore: true,
          sureMinScore: true,
          likelyMinScore: true,
          possibleMinScore: true,
        },
        take: 1,
      },
    },
  });

  const nextReleaseNumber =
    resolveNextReleaseNumberFromList(releases.map((item) => item.releaseNumber)) ?? 4;

  if (autoRows.length < 1) {
    try {
      autoRows = await evaluateAutoPassCutRows({
        examId,
        releaseNumberForThreshold: nextReleaseNumber,
      });
    } catch (error) {
      console.error("Failed to evaluate auto pass-cut rows for current snapshot", error);
    }
  }

  let current = toSnapshotFromEvaluatedRow(
    autoRows.find((row) => row.regionId === regionId && row.examType === examType)
  );

  if (autoRows.length < 1) {
    try {
      const settings = await getSiteSettingsUncached();
      const rows = await buildPassCutPredictionRows({
        examId,
        includeCareerExamType: Boolean(settings["site.careerExamEnabled"] ?? true),
      });
      const matched = rows.find((row) => row.regionId === regionId && row.examType === examType);
      if (matched) {
        const fallbackStatus = toFallbackStatus({
          participantCount: matched.participantCount,
          applicantCount: matched.applicantCount,
          oneMultipleCutScore: matched.oneMultipleCutScore,
        });
        current = {
          participantCount: matched.participantCount,
          recruitCount: matched.recruitCount,
          applicantCount: matched.applicantCount,
          targetParticipantCount: null,
          coverageRate: null,
          stabilityScore: null,
          status: fallbackStatus.status,
          statusReason: fallbackStatus.statusReason,
          averageScore: matched.averageScore,
          oneMultipleCutScore: matched.oneMultipleCutScore,
          sureMinScore: matched.sureMinScore,
          likelyMinScore: matched.likelyMinScore,
          possibleMinScore: matched.possibleMinScore,
        };
      }
    } catch (error) {
      console.error("Failed to build fallback current pass-cut snapshot", error);
    }
  }

  return NextResponse.json({
    releases: releases.map((release) => {
      const snapshot = release.snapshots[0] ?? null;
      return {
        releaseNumber: release.releaseNumber,
        releasedAt: release.releasedAt.toISOString(),
        totalParticipantCount: release.participantCount,
        snapshot: snapshot
          ? {
              participantCount: snapshot.participantCount,
              recruitCount: snapshot.recruitCount,
              applicantCount: snapshot.applicantCount,
              targetParticipantCount: snapshot.targetParticipantCount,
              coverageRate: snapshot.coverageRate,
              stabilityScore: snapshot.stabilityScore,
              status: snapshot.status,
              statusReason: snapshot.statusReason,
              averageScore: snapshot.averageScore,
              oneMultipleCutScore: snapshot.oneMultipleCutScore,
              sureMinScore: snapshot.sureMinScore,
              likelyMinScore: snapshot.likelyMinScore,
              possibleMinScore: snapshot.possibleMinScore,
            }
          : null,
      };
    }),
    current,
  });
}
