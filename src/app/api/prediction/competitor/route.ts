import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { calculatePrediction, maskKoreanName, PredictionError } from "@/lib/prediction";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parsePositiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toSafeNumber(value: number): number {
  return Number(value.toFixed(2));
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetSubmissionId = parsePositiveInteger(searchParams.get("submissionId"));
  if (!targetSubmissionId) {
    return NextResponse.json({ error: "조회할 제출 ID가 필요합니다." }, { status: 400 });
  }

  const requesterRole = session.user.role === "ADMIN" ? Role.ADMIN : Role.USER;

  try {
    const prediction = await calculatePrediction(userId, {}, requesterRole);

    const populationWhere = {
      examId: prediction.summary.examId,
      regionId: prediction.summary.regionId,
      examType: prediction.summary.examType,
      subjectScores: {
        some: {},
        none: {
          isFailed: true,
        },
      },
    };

    const target = await prisma.submission.findFirst({
      where: {
        id: targetSubmissionId,
        ...populationWhere,
      },
      select: {
        id: true,
        userId: true,
        finalScore: true,
        user: {
          select: {
            name: true,
          },
        },
        subjectScores: {
          select: {
            subjectId: true,
            rawScore: true,
            isFailed: true,
            subject: {
              select: {
                name: true,
                maxScore: true,
              },
            },
          },
          orderBy: [{ subjectId: "asc" }],
        },
      },
    });

    if (!target) {
      return NextResponse.json(
        { error: "동일 지역/유형 경쟁자 데이터만 조회할 수 있습니다." },
        { status: 404 }
      );
    }

    const higherCount = await prisma.submission.count({
      where: {
        ...populationWhere,
        finalScore: {
          gt: target.finalScore,
        },
      },
    });

    const score = toSafeNumber(Number(target.finalScore));
    const isMine = target.id === prediction.summary.submissionId;

    return NextResponse.json({
      competitor: {
        submissionId: target.id,
        rank: higherCount + 1,
        maskedName: isMine ? "★ 나" : maskKoreanName(target.user.name),
        score,
        isMine,
        totalParticipants: prediction.summary.totalParticipants,
        examTypeLabel: prediction.summary.examTypeLabel,
        regionName: prediction.summary.regionName,
      },
      subjectScores: target.subjectScores.map((subjectScore) => {
        const rawScore = Number(subjectScore.rawScore);
        const maxScore = Number(subjectScore.subject.maxScore);
        const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
        return {
          subjectId: subjectScore.subjectId,
          subjectName: subjectScore.subject.name,
          rawScore: toSafeNumber(rawScore),
          maxScore: toSafeNumber(maxScore),
          percentage: Number(percentage.toFixed(1)),
          isFailed: subjectScore.isFailed,
        };
      }),
    });
  } catch (error) {
    if (error instanceof PredictionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("GET /api/prediction/competitor error", error);
    return NextResponse.json({ error: "세부 성적 조회에 실패했습니다." }, { status: 500 });
  }
}
