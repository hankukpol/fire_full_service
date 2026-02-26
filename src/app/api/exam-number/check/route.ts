import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindowRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

const CHECK_WINDOW_MS = 60 * 1000;
const CHECK_LIMIT_PER_IP = 30;

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 응시번호를 정수로 파싱. "00123" → 123, "abc" → null
 */
function parseExamNumberInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimit = consumeFixedWindowRateLimit({
    namespace: "exam-number-check-ip",
    key: ip,
    limit: CHECK_LIMIT_PER_IP,
    windowMs: CHECK_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const examId = parsePositiveInt(searchParams.get("examId"));
  const regionId = parsePositiveInt(searchParams.get("regionId"));
  const examNumber = searchParams.get("examNumber")?.trim() ?? "";
  const examTypeParam = searchParams.get("examType")?.trim() ?? "";

  if (!examId || !regionId || !examNumber) {
    return NextResponse.json(
      { error: "examId, regionId, examNumber가 모두 필요합니다." },
      { status: 400 }
    );
  }

  const examType: ExamType =
    examTypeParam === ExamType.CAREER_RESCUE ? ExamType.CAREER_RESCUE
    : examTypeParam === ExamType.CAREER_ACADEMIC ? ExamType.CAREER_ACADEMIC
    : examTypeParam === ExamType.CAREER_EMT ? ExamType.CAREER_EMT
    : ExamType.PUBLIC;

  try {
    const userId = Number(session.user.id);

    // 1. 응시번호 범위 검증 (채용유형별 별도 범위)
    const quota = await prisma.examRegionQuota.findUnique({
      where: {
        examId_regionId: { examId, regionId },
      },
      select: {
        examNumberStart: true,
        examNumberEnd: true,
      },
    });

    // TODO: 채용유형별 응시번호 범위 필드가 스키마에 추가되면 분기 처리 필요
    const rangeStart = quota?.examNumberStart ?? null;
    const rangeEnd = quota?.examNumberEnd ?? null;

    if (rangeStart && rangeEnd) {
      const inputNum = parseExamNumberInt(examNumber);
      const startNum = parseExamNumberInt(rangeStart);
      const endNum = parseExamNumberInt(rangeEnd);

      if (inputNum !== null && startNum !== null && endNum !== null) {
        if (inputNum < startNum || inputNum > endNum) {
          return NextResponse.json({
            available: false,
            reason: `응시번호가 유효 범위(${rangeStart}~${rangeEnd}) 밖입니다.`,
          });
        }
      } else {
        // 숫자 파싱 실패 시 문자열 비교
        if (examNumber < rangeStart || examNumber > rangeEnd) {
          return NextResponse.json({
            available: false,
            reason: `응시번호가 유효 범위(${rangeStart}~${rangeEnd}) 밖입니다.`,
          });
        }
      }
    }

    // 2. 중복 검증 (본인 제출 제외)
    const duplicate = await prisma.submission.findFirst({
      where: {
        examId,
        regionId,
        examNumber,
        userId: { not: userId },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({
        available: false,
        reason: "이미 다른 사용자가 동일한 응시번호로 제출했습니다.",
      });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error("응시번호 확인 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "응시번호 확인에 실패했습니다." }, { status: 500 });
  }
}
