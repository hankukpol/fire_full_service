import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const EXAM_TYPE_LABEL: Record<string, string> = {
  PUBLIC: "공채",
  CAREER_RESCUE: "구조경채",
  CAREER_ACADEMIC: "소방학과경채",
  CAREER_EMT: "구급경채",
};

const GENDER_LABEL: Record<string, string> = {
  MALE: "남",
  FEMALE: "여",
};

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // 활성 시험 먼저 조회 (없으면 전체 대상)
  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const submissions = await prisma.submission.findMany({
    where: {
      ...(activeExam ? { examId: activeExam.id } : {}),
      OR: [
        { examNumber: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      examNumber: true,
      examType: true,
      gender: true,
      totalScore: true,
      finalScore: true,
      isSuspicious: true,
      subjectScores: {
        select: { isFailed: true },
      },
      user: {
        select: { name: true },
      },
      region: {
        select: { name: true },
      },
      exam: {
        select: { year: true, round: true },
      },
    },
  });

  const results = submissions.map((s) => {
    const hasCutoff = s.subjectScores.some((ss) => ss.isFailed);
    return {
      submissionId: s.id,
      userName: s.user.name,
      examNumber: s.examNumber ?? "-",
      examTypeLabel: EXAM_TYPE_LABEL[s.examType] ?? s.examType,
      genderLabel: GENDER_LABEL[s.gender] ?? s.gender,
      regionName: s.region.name,
      examLabel: `${s.exam.year}년 ${s.exam.round}차`,
      totalScore: Number(s.totalScore),
      finalScore: Number(s.finalScore),
      hasCutoff,
      isSuspicious: s.isSuspicious,
    };
  });

  return NextResponse.json({ results });
}
