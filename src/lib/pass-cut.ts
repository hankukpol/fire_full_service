import { ExamType } from "@prisma/client";
import { getRegionRecruitCount } from "@/lib/exam-utils";
import { getLikelyMultiple, getPassMultiple } from "@/lib/prediction";
import { prisma } from "@/lib/prisma";

interface QuotaRow {
  regionId: number;
  regionName: string;
  recruitPublicMale: number;
  recruitPublicFemale: number;
  recruitRescue: number;
  recruitAcademicMale: number;
  recruitAcademicFemale: number;
  recruitAcademicCombined: number;
  recruitEmtMale: number;
  recruitEmtFemale: number;
  applicantPublicMale: number | null;
  applicantPublicFemale: number | null;
  applicantRescue: number | null;
  applicantAcademicMale: number | null;
  applicantAcademicFemale: number | null;
  applicantAcademicCombined: number | null;
  applicantEmtMale: number | null;
  applicantEmtFemale: number | null;
}

interface ScoreBandRow {
  regionId: number;
  examType: ExamType;
  finalScore: number;
  _count: {
    _all: number;
  };
}

export interface PassCutPredictionRow {
  regionId: number;
  regionName: string;
  examType: ExamType;
  recruitCount: number;
  applicantCount: number | null;
  estimatedApplicants: number;
  isApplicantCountExact: boolean;
  competitionRate: number | null;
  participantCount: number;
  averageScore: number | null;
  oneMultipleCutScore: number | null;
  sureMinScore: number | null;
  likelyMinScore: number | null;
  possibleMinScore: number | null;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

function buildScoreBands(rows: ScoreBandRow[]): Array<{ score: number; count: number }> {
  return rows.map((row) => ({
    score: Number(row.finalScore),
    count: row._count._all,
  }));
}

function getScoreAtRank(
  scoreBands: Array<{ score: number; count: number }>,
  rank: number
): number | null {
  if (!Number.isInteger(rank) || rank < 1) {
    return null;
  }

  let covered = 0;
  for (const band of scoreBands) {
    covered += band.count;
    if (covered >= rank) {
      return roundNumber(band.score);
    }
  }

  return null;
}

function getScoreRange(
  scoreBands: Array<{ score: number; count: number }>,
  startRank: number,
  endRank: number
): { min: number | null; max: number | null } {
  if (!Number.isInteger(startRank) || !Number.isInteger(endRank) || startRank > endRank || startRank < 1) {
    return { min: null, max: null };
  }

  return {
    max: getScoreAtRank(scoreBands, startRank),
    min: getScoreAtRank(scoreBands, endRank),
  };
}

function getRegionApplicantCount(
  quota: QuotaRow,
  examType: ExamType
): { applicantCount: number | null; isExact: boolean } {
  let raw: number | null = null;
  switch (examType) {
    case ExamType.PUBLIC:
      raw = (quota.applicantPublicMale ?? 0) + (quota.applicantPublicFemale ?? 0);
      // 두 값 모두 null이면 null 반환
      if (quota.applicantPublicMale === null && quota.applicantPublicFemale === null) raw = null;
      break;
    case ExamType.CAREER_RESCUE:
      raw = quota.applicantRescue;
      break;
    case ExamType.CAREER_ACADEMIC:
      if (quota.recruitAcademicCombined > 0) {
        raw = quota.applicantAcademicCombined;
      } else {
        raw = (quota.applicantAcademicMale ?? 0) + (quota.applicantAcademicFemale ?? 0);
        if (quota.applicantAcademicMale === null && quota.applicantAcademicFemale === null) raw = null;
      }
      break;
    case ExamType.CAREER_EMT:
      raw = (quota.applicantEmtMale ?? 0) + (quota.applicantEmtFemale ?? 0);
      if (quota.applicantEmtMale === null && quota.applicantEmtFemale === null) raw = null;
      break;
  }

  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return {
      applicantCount: Math.floor(raw),
      isExact: true,
    };
  }

  return {
    applicantCount: null,
    isExact: false,
  };
}

export async function buildPassCutPredictionRows(params: {
  examId: number;
  includeCareerExamType: boolean;
}): Promise<PassCutPredictionRow[]> {
  const examTypes: ExamType[] = params.includeCareerExamType
    ? [ExamType.PUBLIC, ExamType.CAREER_RESCUE, ExamType.CAREER_ACADEMIC, ExamType.CAREER_EMT]
    : [ExamType.PUBLIC];

  const [quotaRows, participantStats, scoreBandStats] = await Promise.all([
    prisma.$queryRaw<QuotaRow[]>`
      SELECT
        q."regionId",
        r."name" AS "regionName",
        q."recruitPublicMale",
        q."recruitPublicFemale",
        q."recruitRescue",
        q."recruitAcademicMale",
        q."recruitAcademicFemale",
        q."recruitAcademicCombined",
        q."recruitEmtMale",
        q."recruitEmtFemale",
        q."applicantPublicMale",
        q."applicantPublicFemale",
        q."applicantRescue",
        q."applicantAcademicMale",
        q."applicantAcademicFemale",
        q."applicantAcademicCombined",
        q."applicantEmtMale",
        q."applicantEmtFemale"
      FROM "exam_region_quotas" q
      JOIN "Region" r ON r.id = q."regionId"
      WHERE q."examId" = ${params.examId}
      ORDER BY r."name" ASC
    `,
    prisma.submission.groupBy({
      by: ["regionId", "examType"],
      where: {
        examId: params.examId,
        isSuspicious: false,
        subjectScores: {
          some: {},
          none: {
            isFailed: true,
          },
        },
      },
      _count: {
        _all: true,
      },
      _avg: {
        finalScore: true,
      },
    }),
    prisma.submission.groupBy({
      by: ["regionId", "examType", "finalScore"],
      where: {
        examId: params.examId,
        isSuspicious: false,
        subjectScores: {
          some: {},
          none: {
            isFailed: true,
          },
        },
      },
      _count: {
        _all: true,
      },
      orderBy: [{ regionId: "asc" }, { examType: "asc" }, { finalScore: "desc" }],
    }),
  ]);

  const participantMap = new Map(
    participantStats.map((item) => [
      `${item.regionId}-${item.examType}`,
      {
        participantCount: item._count._all,
        averageScore: item._avg.finalScore === null ? null : roundNumber(Number(item._avg.finalScore)),
      },
    ])
  );

  const scoreBandMap = new Map<string, ScoreBandRow[]>();
  for (const row of scoreBandStats) {
    const key = `${row.regionId}-${row.examType}`;
    const current = scoreBandMap.get(key) ?? [];
    current.push({
      regionId: row.regionId,
      examType: row.examType,
      finalScore: Number(row.finalScore),
      _count: {
        _all: row._count._all,
      },
    });
    scoreBandMap.set(key, current);
  }

  const rows: PassCutPredictionRow[] = [];

  for (const quota of quotaRows) {
    for (const examType of examTypes) {
      const recruitCount = getRegionRecruitCount(quota, examType);
      if (!Number.isInteger(recruitCount) || recruitCount < 1) {
        continue;
      }

      const participant = participantMap.get(`${quota.regionId}-${examType}`);
      const participantCount = participant?.participantCount ?? 0;
      const averageScore = participant?.averageScore ?? null;
      const applicantCountInfo = getRegionApplicantCount(quota, examType);
      const competitionRate =
        recruitCount > 0 && applicantCountInfo.applicantCount !== null
          ? roundNumber(applicantCountInfo.applicantCount / recruitCount)
          : null;

      const scoreBands = buildScoreBands(scoreBandMap.get(`${quota.regionId}-${examType}`) ?? []);
      const oneMultipleCutScore = getScoreAtRank(scoreBands, recruitCount);

      const passMultiple = getPassMultiple(recruitCount, examType);
      const likelyMultiple = getLikelyMultiple(passMultiple);
      const likelyMaxRank = Math.max(1, Math.floor(recruitCount * likelyMultiple));
      const passCount = Math.ceil(recruitCount * passMultiple);

      const likelyRange = getScoreRange(scoreBands, recruitCount + 1, likelyMaxRank);
      const possibleRange = getScoreRange(scoreBands, likelyMaxRank + 1, passCount);
      const sureMinScore = getScoreAtRank(scoreBands, recruitCount);

      rows.push({
        regionId: quota.regionId,
        regionName: quota.regionName,
        examType,
        recruitCount,
        applicantCount: applicantCountInfo.applicantCount,
        estimatedApplicants: applicantCountInfo.applicantCount ?? 0,
        isApplicantCountExact: applicantCountInfo.isExact,
        competitionRate,
        participantCount,
        averageScore,
        oneMultipleCutScore,
        sureMinScore,
        likelyMinScore: likelyRange.min,
        possibleMinScore: possibleRange.min,
      });
    }
  }

  return rows;
}

export function getCurrentPassCutSnapshot(
  rows: PassCutPredictionRow[],
  regionId: number,
  examType: ExamType
): {
  participantCount: number;
  recruitCount: number;
  applicantCount: number | null;
  averageScore: number | null;
  oneMultipleCutScore: number | null;
  sureMinScore: number | null;
  likelyMinScore: number | null;
  possibleMinScore: number | null;
} {
  const matched = rows.find((row) => row.regionId === regionId && row.examType === examType);
  if (!matched) {
    return {
      participantCount: 0,
      recruitCount: 0,
      applicantCount: null,
      averageScore: null,
      oneMultipleCutScore: null,
      sureMinScore: null,
      likelyMinScore: null,
      possibleMinScore: null,
    };
  }

  return {
    participantCount: matched.participantCount,
    recruitCount: matched.recruitCount,
    applicantCount: matched.applicantCount,
    averageScore: matched.averageScore,
    oneMultipleCutScore: matched.oneMultipleCutScore,
    sureMinScore: matched.sureMinScore,
    likelyMinScore: matched.likelyMinScore,
    possibleMinScore: matched.possibleMinScore,
  };
}
