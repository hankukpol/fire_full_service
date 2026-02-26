import { BonusType, ExamType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// 직렬별 필기 만점
const WRITTEN_MAX_BY_EXAM_TYPE: Record<ExamType, number> = {
  [ExamType.PUBLIC]: 300,
  [ExamType.CAREER_RESCUE]: 200,
  [ExamType.CAREER_ACADEMIC]: 200,
  [ExamType.CAREER_EMT]: 200,
};

const FITNESS_MAX = 60;    // 체력 만점
const WRITTEN_WEIGHT = 50; // 필기 반영 비율 (50%)
const FITNESS_WEIGHT = 25; // 체력 반영 비율 (25%)

interface RankRow {
  submissionId: number;
  knownFinalScore: number;
  isVeteranPreferred: boolean;
  writtenScore: number;
}

export interface KnownFinalScoreResult {
  writtenConverted: number;  // 필기 환산 (50점 만점)
  fitnessConverted: number;  // 체력 환산 (25점 만점)
  knownFinalScore: number;   // 면접 제외 최종 환산 (최대 80점)
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

function isVeteranBonusType(bonusType: BonusType): boolean {
  return bonusType === BonusType.VETERAN_5 || bonusType === BonusType.VETERAN_10;
}

function compareRankRow(left: RankRow, right: RankRow): number {
  // 1순위: 최종 환산 점수 내림차순
  if (right.knownFinalScore !== left.knownFinalScore) {
    return right.knownFinalScore - left.knownFinalScore;
  }
  // 2순위: 취업지원대상자 우선
  if (right.isVeteranPreferred !== left.isVeteranPreferred) {
    return Number(right.isVeteranPreferred) - Number(left.isVeteranPreferred);
  }
  // 3순위: 필기 원점수 내림차순
  if (right.writtenScore !== left.writtenScore) {
    return right.writtenScore - left.writtenScore;
  }
  // 4순위: 먼저 제출한 순서
  return left.submissionId - right.submissionId;
}

function toRankMap(rows: RankRow[]): Map<number, number> {
  const sorted = [...rows].sort(compareRankRow);
  const rankMap = new Map<number, number>();
  for (let index = 0; index < sorted.length; index += 1) {
    rankMap.set(sorted[index].submissionId, index + 1);
  }
  return rankMap;
}

/** 직렬별 필기 만점 반환 */
export function getWrittenScoreMax(examType: ExamType): number {
  return WRITTEN_MAX_BY_EXAM_TYPE[examType] ?? 300;
}

/**
 * 면접 제외 최종 환산 점수 계산 (소방)
 *
 * 공식:
 *   필기 환산 = (필기점수 / 필기만점) × 50
 *   체력 환산 = (체력점수 / 60) × 25
 *   최종 환산 = 필기 환산 + 체력 환산 + 자격증 가산점
 *   만점 = 80점 (면접 25% 제외)
 */
export function calculateKnownFinalScore(params: {
  writtenScore: number;     // 필기 finalScore (원점수 + 취업/의상 가산점)
  writtenScoreMax: number;  // 필기 만점 (공채 300, 경채 200)
  fitnessRawScore: number;  // 체력 원점수 (0~60)
  certificateBonus: number; // 자격증 가산점 (0~5)
}): KnownFinalScoreResult {
  const clampedWritten = Math.max(0, params.writtenScore);
  const clampedFitness = Math.min(FITNESS_MAX, Math.max(0, params.fitnessRawScore));
  const clampedCert = Math.max(0, params.certificateBonus);

  const writtenConverted = roundScore((clampedWritten / params.writtenScoreMax) * WRITTEN_WEIGHT);
  const fitnessConverted = roundScore((clampedFitness / FITNESS_MAX) * FITNESS_WEIGHT);
  const knownFinalScore = roundScore(writtenConverted + fitnessConverted + clampedCert);

  return { writtenConverted, fitnessConverted, knownFinalScore };
}

/** 동일 시험·지역·직렬 기준 임시 순위 계산 */
export async function calculateKnownFinalRank(params: {
  examId: number;
  regionId: number;
  examType: ExamType;
  submissionId: number;
}): Promise<{ finalRank: number | null; totalParticipants: number }> {
  const rows = await prisma.finalPrediction.findMany({
    where: {
      finalScore: { not: null },
      submission: {
        examId: params.examId,
        regionId: params.regionId,
        examType: params.examType,
      },
    },
    select: {
      submissionId: true,
      finalScore: true,
      submission: {
        select: {
          finalScore: true,
          bonusType: true,
        },
      },
    },
  });

  if (rows.length < 1) {
    return { finalRank: null, totalParticipants: 0 };
  }

  const rankMap = toRankMap(
    rows.map((row) => ({
      submissionId: row.submissionId,
      knownFinalScore: Number(row.finalScore),
      isVeteranPreferred: isVeteranBonusType(row.submission.bonusType),
      writtenScore: Number(row.submission.finalScore),
    }))
  );

  return {
    finalRank: rankMap.get(params.submissionId) ?? null,
    totalParticipants: rows.length,
  };
}
