import { BonusType, ExamType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface RankRow {
  submissionId: number;
  knownFinalScore: number;
  isVeteranPreferred: boolean;
  writtenScore: number;
  knownBonusPoint: number;
}

export interface KnownFinalScoreResult {
  martialBonusPoint: number;
  knownBonusPoint: number;
  knownFinalScore: number | null;
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

function isVeteranBonusType(bonusType: BonusType): boolean {
  return bonusType === BonusType.VETERAN_5 || bonusType === BonusType.VETERAN_10;
}

function compareRankRow(left: RankRow, right: RankRow): number {
  if (right.knownFinalScore !== left.knownFinalScore) {
    return right.knownFinalScore - left.knownFinalScore;
  }

  if (right.isVeteranPreferred !== left.isVeteranPreferred) {
    return Number(right.isVeteranPreferred) - Number(left.isVeteranPreferred);
  }

  if (right.writtenScore !== left.writtenScore) {
    return right.writtenScore - left.writtenScore;
  }

  if (right.knownBonusPoint !== left.knownBonusPoint) {
    return right.knownBonusPoint - left.knownBonusPoint;
  }

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

export function getMartialBonusPoint(danLevel: number): number {
  if (!Number.isFinite(danLevel)) return 0;
  if (danLevel >= 4) return 2;
  if (danLevel >= 2) return 1;
  return 0;
}

export function calculateKnownFinalScore(params: {
  writtenScore: number;
  fitnessPassed: boolean;
  martialDanLevel: number;
  additionalBonusPoint: number;
}): KnownFinalScoreResult {
  if (!params.fitnessPassed) {
    return {
      martialBonusPoint: 0,
      knownBonusPoint: 0,
      knownFinalScore: null,
    };
  }

  const martialBonusPoint = getMartialBonusPoint(params.martialDanLevel);
  const sanitizedAdditionalBonus = Math.max(0, params.additionalBonusPoint);
  const knownBonusPoint = roundScore(martialBonusPoint + sanitizedAdditionalBonus);
  const knownFinalScore = roundScore(Math.max(0, params.writtenScore) + knownBonusPoint);

  return {
    martialBonusPoint,
    knownBonusPoint,
    knownFinalScore,
  };
}

export async function calculateKnownFinalRank(params: {
  examId: number;
  regionId: number;
  examType: ExamType;
  submissionId: number;
}): Promise<{ finalRank: number | null; totalParticipants: number }> {
  const rows = await prisma.finalPrediction.findMany({
    where: {
      finalScore: { not: null },
      interviewGrade: "PASS",
      submission: {
        examId: params.examId,
        regionId: params.regionId,
        examType: params.examType,
      },
    },
    select: {
      submissionId: true,
      finalScore: true,
      fitnessScore: true,
      interviewScore: true,
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
    rows.map((row) => {
      const martialBonusPoint = row.fitnessScore === null ? 0 : Number(row.fitnessScore);
      const additionalBonusPoint = row.interviewScore === null ? 0 : Number(row.interviewScore);
      const knownBonusPoint = roundScore(martialBonusPoint + additionalBonusPoint);

      return {
        submissionId: row.submissionId,
        knownFinalScore: Number(row.finalScore),
        isVeteranPreferred: isVeteranBonusType(row.submission.bonusType),
        writtenScore: Number(row.submission.finalScore),
        knownBonusPoint,
      };
    })
  );

  return {
    finalRank: rankMap.get(params.submissionId) ?? null,
    totalParticipants: rows.length,
  };
}
