import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { evaluateAutoPassCutRows } from "@/lib/pass-cut-auto-release";
import {
  createPassCutRelease,
  PassCutReleaseServiceError,
} from "@/lib/pass-cut-release.service";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const runtime = "nodejs";

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function toUserErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return "DB schema mismatch detected. Run `npx prisma db push` and try again.";
  }
  return fallbackMessage;
}

interface CreateReleaseBody {
  examId?: number;
  releaseNumber?: number;
  memo?: string;
  autoNotice?: boolean;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const examId = parsePositiveInt(searchParams.get("examId"));
    if (!examId) {
      return NextResponse.json({ error: "examId is required." }, { status: 400 });
    }

    const releases = await prisma.passCutRelease.findMany({
      where: { examId },
      orderBy: [{ releaseNumber: "asc" }, { id: "asc" }],
      select: {
        id: true,
        examId: true,
        releaseNumber: true,
        releasedAt: true,
        participantCount: true,
        memo: true,
        admin: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            snapshots: true,
          },
        },
      },
    });

    return NextResponse.json({
      releases: releases.map((release) => ({
        id: release.id,
        examId: release.examId,
        releaseNumber: release.releaseNumber,
        releasedAt: release.releasedAt.toISOString(),
        participantCount: release.participantCount,
        memo: release.memo,
        createdBy: {
          id: release.admin.id,
          name: release.admin.name,
        },
        snapshotCount: release._count.snapshots,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/pass-cut-release error", error);
    return NextResponse.json(
      { error: toUserErrorMessage(error, "Failed to fetch pass-cut releases.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const adminUserId = Number(guard.session.user.id);
    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return NextResponse.json({ error: "Invalid admin user." }, { status: 401 });
    }

    let body: CreateReleaseBody;
    try {
      body = (await request.json()) as CreateReleaseBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const examId = parsePositiveInt(body.examId);
    const releaseNumber = parsePositiveInt(body.releaseNumber);
    const memo = typeof body.memo === "string" && body.memo.trim() ? body.memo.trim() : null;
    const autoNotice = body.autoNotice !== false;

    if (!examId) {
      return NextResponse.json({ error: "examId is required." }, { status: 400 });
    }
    if (!releaseNumber || releaseNumber < 1 || releaseNumber > 4) {
      return NextResponse.json({ error: "releaseNumber must be in 1..4." }, { status: 400 });
    }

    const settings = await getSiteSettingsUncached();
    const includeCareerExamType = Boolean(settings["site.careerExamEnabled"] ?? true);
    const evaluatedRows = await evaluateAutoPassCutRows({
      examId,
      releaseNumberForThreshold: releaseNumber,
      includeCareerExamType,
    });

    const created = await createPassCutRelease({
      examId,
      releaseNumber,
      createdBy: adminUserId,
      source: "ADMIN",
      memo,
      autoNotice,
      snapshots: evaluatedRows.map((row) => ({
        regionId: row.regionId,
        examType: row.examType,
        participantCount: row.participantCount,
        recruitCount: row.recruitCount,
        averageScore: row.averageScore,
        oneMultipleCutScore: row.oneMultipleCutScore,
        sureMinScore: row.sureMinScore,
        likelyMinScore: row.likelyMinScore,
        possibleMinScore: row.possibleMinScore,
        statusPayload: row.statusPayload,
      })),
    });

    return NextResponse.json({
      success: true,
      releaseId: created.id,
      releaseNumber: created.releaseNumber,
      releasedAt: created.releasedAt,
      participantCount: created.participantCount,
      snapshotCount: created.snapshotCount,
    });
  } catch (error) {
    if (error instanceof PassCutReleaseServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A release for this exam/releaseNumber already exists." },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/pass-cut-release error", error);
    return NextResponse.json(
      { error: toUserErrorMessage(error, "Failed to create pass-cut release.") },
      { status: 500 }
    );
  }
}
