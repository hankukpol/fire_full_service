import {
  BonusType,
  DifficultyRatingLevel,
  ExamType,
  Gender,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MOCK_USER_PREFIX = "[MOCK]";
const MOCK_PHONE_PREFIX = "090999";
const MOCK_EXAM_NUMBER_PREFIX = "MOCK";
const MOCK_PASSWORD_HASH = "$2b$10$HAfAnxSKfZT/tKe9Gy7TquBLOLCOYOcunzMXDAbmX0CtjayhJBb5S";

const DEFAULT_PUBLIC_PER_REGION = 40;
const DEFAULT_CAREER_RESCUE_PER_REGION = 20;
const DEFAULT_CAREER_ACADEMIC_PER_REGION = 20;
const DEFAULT_CAREER_EMT_PER_REGION = 20;
const MIN_PER_REGION = 1;
const MAX_PER_REGION = 200;

interface SubjectInfo {
  id: number;
  name: string;
  examType: ExamType;
  maxScore: number;
}

interface RegionInfo {
  id: number;
  name: string;
  recruitPublicMale: number;
  recruitPublicFemale: number;
  recruitRescue: number;
  recruitAcademicMale: number;
  recruitAcademicFemale: number;
  recruitAcademicCombined: number;
  recruitEmtMale: number;
  recruitEmtFemale: number;
}

interface RegionRaw {
  id: number;
  name: string;
}

interface SubmissionDraft {
  phone: string;
  examType: ExamType;
  regionId: number;
  examNumber: string;
  gender: Gender;
  totalScore: number;
  bonusType: BonusType;
  bonusRate: number;
  finalScore: number;
  subjectScores: Array<{
    subjectId: number;
    rawScore: number;
    isFailed: boolean;
    rating: DifficultyRatingLevel;
  }>;
}

interface FinalPredictionSeedRow {
  submissionId: number;
  userId: number;
  regionId: number;
  examType: ExamType;
  bonusType: BonusType;
  writtenScore: number;
  fitnessPassed: boolean;
  martialBonusPoint: number;
  additionalBonusPoint: number;
  knownBonusPoint: number;
  knownFinalScore: number | null;
}

export interface GenerateMockDataOptions {
  examId?: number;
  publicPerRegion?: number;
  careerRescuePerRegion?: number;
  careerAcademicPerRegion?: number;
  careerEmtPerRegion?: number;
  careerRescueEnabled?: boolean;
  careerAcademicEnabled?: boolean;
  careerEmtEnabled?: boolean;
  resetBeforeGenerate?: boolean;
  includeFinalPredictionMock?: boolean;
}

export interface GenerateMockDataResult {
  examId: number;
  examName: string;
  runKey: string;
  deletedBeforeGenerate: {
    submissions: number;
    users: number;
  };
  created: {
    users: number;
    submissions: number;
    subjectScores: number;
    difficultyRatings: number;
    finalPredictions: number;
  };
}

export interface ResetMockDataOptions {
  examId?: number;
}

export interface ResetMockDataResult {
  examId: number | null;
  deleted: {
    submissions: number;
    users: number;
  };
}

type MockDbClient = Prisma.TransactionClient | typeof prisma;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSafeInt(value: unknown, fallbackValue: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackValue;
  return clamp(Math.floor(parsed), min, max);
}

function roundOne(value: number): number {
  return Number(value.toFixed(1));
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function randomGender(): Gender {
  return Math.random() < 0.7 ? Gender.MALE : Gender.FEMALE;
}

function chooseBonusType(recruitCount: number): BonusType {
  const roll = Math.random();
  if (roll < 0.8) return BonusType.NONE;
  if (roll < 0.9) return BonusType.VETERAN_5;
  if (roll < 0.95) return BonusType.VETERAN_10;

  if (recruitCount >= 10) {
    return roll < 0.975 ? BonusType.HERO_3 : BonusType.HERO_5;
  }

  return BonusType.NONE;
}

function bonusRateOf(type: BonusType): number {
  if (type === BonusType.VETERAN_5) return 0.05;
  if (type === BonusType.VETERAN_10) return 0.1;
  if (type === BonusType.HERO_3) return 0.03;
  if (type === BonusType.HERO_5) return 0.05;
  return 0;
}

function isVeteranPreferredBonus(type: BonusType): boolean {
  return type === BonusType.VETERAN_5 || type === BonusType.VETERAN_10;
}

function pickMartialDanLevel(): number {
  const roll = Math.random();
  if (roll < 0.16) return 4 + Math.floor(Math.random() * 3); // 4~6단
  if (roll < 0.38) return 2 + Math.floor(Math.random() * 2); // 2~3단
  if (roll < 0.52) return 1;
  return 0;
}

function martialBonusPointByDanLevel(danLevel: number): number {
  if (danLevel >= 4) return 2;
  if (danLevel >= 2) return 1;
  return 0;
}

function pickAdditionalBonusPoint(): number {
  const roll = Math.random();
  if (roll < 0.72) return 0;
  if (roll < 0.92) return roundTwo(0.5 + Math.random() * 1.5); // 0.5 ~ 2.0
  return roundTwo(2 + Math.random()); // 2.0 ~ 3.0
}

function compareFinalPredictionSeedRow(left: FinalPredictionSeedRow, right: FinalPredictionSeedRow): number {
  const leftScore = left.knownFinalScore ?? -1;
  const rightScore = right.knownFinalScore ?? -1;
  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const veteranCompare = Number(isVeteranPreferredBonus(right.bonusType)) - Number(isVeteranPreferredBonus(left.bonusType));
  if (veteranCompare !== 0) {
    return veteranCompare;
  }

  if (right.writtenScore !== left.writtenScore) {
    return right.writtenScore - left.writtenScore;
  }

  if (right.knownBonusPoint !== left.knownBonusPoint) {
    return right.knownBonusPoint - left.knownBonusPoint;
  }

  return left.submissionId - right.submissionId;
}

function buildFinalPredictionRankMap(rows: FinalPredictionSeedRow[]): Map<number, number> {
  const passRows = rows.filter((row) => row.fitnessPassed && row.knownFinalScore !== null);
  const grouped = new Map<string, FinalPredictionSeedRow[]>();

  for (const row of passRows) {
    const key = `${row.regionId}:${row.examType}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }
    grouped.set(key, [row]);
  }

  const rankMap = new Map<number, number>();

  for (const groupRows of grouped.values()) {
    const sorted = [...groupRows].sort(compareFinalPredictionSeedRow);
    for (let index = 0; index < sorted.length; index += 1) {
      rankMap.set(sorted[index].submissionId, index + 1);
    }
  }

  return rankMap;
}

function pickDifficultyByPercent(percent: number): DifficultyRatingLevel {
  if (percent >= 90) return DifficultyRatingLevel.VERY_EASY;
  if (percent >= 80) return DifficultyRatingLevel.EASY;
  if (percent >= 65) return DifficultyRatingLevel.NORMAL;
  if (percent >= 50) return DifficultyRatingLevel.HARD;
  return DifficultyRatingLevel.VERY_HARD;
}

function createScoreDraft(
  subjects: SubjectInfo[],
  scorePercent: number,
  allowFailNoise: boolean
): SubmissionDraft["subjectScores"] {
  return subjects.map((subject) => {
    const localNoise = (Math.random() - 0.5) * 0.12;
    let percent = clamp(scorePercent + localNoise, 0.22, 0.99);

    // Keep a small low-tail to mimic real-world cutoff failures.
    if (allowFailNoise && Math.random() < 0.07) {
      percent = clamp(percent - 0.28, 0.18, 0.5);
    }

    const rawScore = roundOne(subject.maxScore * percent);
    const isFailed = rawScore < subject.maxScore * 0.4;
    const rating = pickDifficultyByPercent((rawScore / subject.maxScore) * 100);

    return {
      subjectId: subject.id,
      rawScore,
      isFailed,
      rating,
    };
  });
}

function buildFinalPredictionSeedRow(params: {
  submissionId: number;
  userId: number;
  draft: SubmissionDraft;
}): FinalPredictionSeedRow {
  const hasCutoff = params.draft.subjectScores.some((score) => score.isFailed);
  const passChance = hasCutoff
    ? 0.08
    : clamp(0.58 + (params.draft.finalScore / 250) * 0.35, 0.58, 0.95);
  const fitnessPassed = Math.random() < passChance;

  if (!fitnessPassed) {
    return {
      submissionId: params.submissionId,
      userId: params.userId,
      regionId: params.draft.regionId,
      examType: params.draft.examType,
      bonusType: params.draft.bonusType,
      writtenScore: params.draft.finalScore,
      fitnessPassed: false,
      martialBonusPoint: 0,
      additionalBonusPoint: 0,
      knownBonusPoint: 0,
      knownFinalScore: null,
    };
  }

  const martialDanLevel = pickMartialDanLevel();
  const martialBonusPoint = martialBonusPointByDanLevel(martialDanLevel);
  const additionalBonusPoint = pickAdditionalBonusPoint();
  const knownBonusPoint = roundTwo(martialBonusPoint + additionalBonusPoint);

  return {
    submissionId: params.submissionId,
    userId: params.userId,
    regionId: params.draft.regionId,
    examType: params.draft.examType,
    bonusType: params.draft.bonusType,
    writtenScore: params.draft.finalScore,
    fitnessPassed: true,
    martialBonusPoint,
    additionalBonusPoint,
    knownBonusPoint,
    knownFinalScore: roundTwo(params.draft.finalScore + knownBonusPoint),
  };
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (items.length < 1) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function resolveExam(examId?: number, db: MockDbClient = prisma) {
  if (examId && Number.isInteger(examId) && examId > 0) {
    const selected = await db.exam.findUnique({
      where: { id: examId },
      select: { id: true, name: true },
    });
    if (selected) return selected;
  }

  return db.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true, name: true },
  });
}

async function resetMockDataWithClient(
  db: MockDbClient,
  options: ResetMockDataOptions = {}
): Promise<ResetMockDataResult> {
  const examId = options.examId;
  const submissionWhere: Prisma.SubmissionWhereInput = {
    examNumber: {
      startsWith: `${MOCK_EXAM_NUMBER_PREFIX}-`,
    },
    ...(examId ? { examId } : {}),
  };

  const existing = await db.submission.findMany({
    where: submissionWhere,
    select: {
      id: true,
      userId: true,
    },
  });

  const submissionIds = existing.map((row) => row.id);
  const candidateUserIds: number[] = Array.from(new Set<number>(existing.map((row) => row.userId)));

  let deletedSubmissionCount = 0;
  for (const ids of chunkArray(submissionIds, 500)) {
    const deleted = await db.submission.deleteMany({
      where: {
        id: { in: ids },
      },
    });
    deletedSubmissionCount += deleted.count;
  }

  const userDeleteWhere: Prisma.UserWhereInput =
    examId && candidateUserIds.length > 0
      ? {
          id: { in: candidateUserIds },
          name: { startsWith: `${MOCK_USER_PREFIX}:` },
          phone: { startsWith: MOCK_PHONE_PREFIX },
          role: Role.USER,
          submissions: { none: {} },
          comments: { none: {} },
          answerKeyLogs: { none: {} },
        }
      : {
          name: { startsWith: `${MOCK_USER_PREFIX}:` },
          phone: { startsWith: MOCK_PHONE_PREFIX },
          role: Role.USER,
          submissions: { none: {} },
          comments: { none: {} },
          answerKeyLogs: { none: {} },
        };

  let deletedUserCount = 0;
  const deletableUsers = await db.user.findMany({
    where: userDeleteWhere,
    select: { id: true },
  });

  for (const ids of chunkArray(deletableUsers.map((row) => row.id), 500)) {
    const deleted = await db.user.deleteMany({
      where: { id: { in: ids } },
    });
    deletedUserCount += deleted.count;
  }

  return {
    examId: examId ?? null,
    deleted: {
      submissions: deletedSubmissionCount,
      users: deletedUserCount,
    },
  };
}

export async function resetMockData(options: ResetMockDataOptions = {}): Promise<ResetMockDataResult> {
  return prisma.$transaction(async (tx) => resetMockDataWithClient(tx, options));
}

export async function generateMockData(
  options: GenerateMockDataOptions = {}
): Promise<GenerateMockDataResult> {
  const targetExam = await resolveExam(options.examId);
  if (!targetExam) {
    throw new Error("활성 시험이 없어 목업 데이터를 생성할 수 없습니다.");
  }

  const publicPerRegion = toSafeInt(
    options.publicPerRegion,
    DEFAULT_PUBLIC_PER_REGION,
    MIN_PER_REGION,
    MAX_PER_REGION
  );
  const careerRescuePerRegion = toSafeInt(
    options.careerRescuePerRegion,
    DEFAULT_CAREER_RESCUE_PER_REGION,
    MIN_PER_REGION,
    MAX_PER_REGION
  );
  const careerAcademicPerRegion = toSafeInt(
    options.careerAcademicPerRegion,
    DEFAULT_CAREER_ACADEMIC_PER_REGION,
    MIN_PER_REGION,
    MAX_PER_REGION
  );
  const careerEmtPerRegion = toSafeInt(
    options.careerEmtPerRegion,
    DEFAULT_CAREER_EMT_PER_REGION,
    MIN_PER_REGION,
    MAX_PER_REGION
  );
  const careerRescueEnabled = options.careerRescueEnabled !== false;
  const careerAcademicEnabled = options.careerAcademicEnabled !== false;
  const careerEmtEnabled = options.careerEmtEnabled !== false;
  const resetBeforeGenerate = options.resetBeforeGenerate !== false;
  const includeFinalPredictionMock = options.includeFinalPredictionMock !== false;

  const [regionsRaw, quotas, subjects] = await Promise.all([
    prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.examRegionQuota.findMany({
      where: { examId: targetExam.id },
      select: {
        regionId: true,
        recruitPublicMale: true,
        recruitPublicFemale: true,
        recruitRescue: true,
        recruitAcademicMale: true,
        recruitAcademicFemale: true,
        recruitAcademicCombined: true,
        recruitEmtMale: true,
        recruitEmtFemale: true,
      },
    }),
    prisma.subject.findMany({
      orderBy: [{ examType: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        examType: true,
        maxScore: true,
      },
    }),
  ]);

  const quotaByRegionId = new Map(quotas.map((q) => [q.regionId, q]));
  const regions: RegionInfo[] = regionsRaw.map((r: RegionRaw) => ({
    id: r.id,
    name: r.name,
    recruitPublicMale: quotaByRegionId.get(r.id)?.recruitPublicMale ?? 0,
    recruitPublicFemale: quotaByRegionId.get(r.id)?.recruitPublicFemale ?? 0,
    recruitRescue: quotaByRegionId.get(r.id)?.recruitRescue ?? 0,
    recruitAcademicMale: quotaByRegionId.get(r.id)?.recruitAcademicMale ?? 0,
    recruitAcademicFemale: quotaByRegionId.get(r.id)?.recruitAcademicFemale ?? 0,
    recruitAcademicCombined: quotaByRegionId.get(r.id)?.recruitAcademicCombined ?? 0,
    recruitEmtMale: quotaByRegionId.get(r.id)?.recruitEmtMale ?? 0,
    recruitEmtFemale: quotaByRegionId.get(r.id)?.recruitEmtFemale ?? 0,
  }));

  // CAREER_ACADEMIC 과 CAREER_RESCUE 는 동일 시험과목(소방학개론 + 소방관계법규)이므로
  // CAREER_RESCUE 의 과목을 공유한다
  const subjectsByType: Record<ExamType, SubjectInfo[]> = {
    [ExamType.PUBLIC]: subjects
      .filter((subject) => subject.examType === ExamType.PUBLIC)
      .map((subject) => ({
        ...subject,
        maxScore: Number(subject.maxScore),
      })),
    [ExamType.CAREER_RESCUE]: subjects
      .filter((subject) => subject.examType === ExamType.CAREER_RESCUE)
      .map((subject) => ({
        ...subject,
        maxScore: Number(subject.maxScore),
      })),
    [ExamType.CAREER_ACADEMIC]: subjects
      .filter((subject) => subject.examType === ExamType.CAREER_RESCUE)
      .map((subject) => ({
        ...subject,
        maxScore: Number(subject.maxScore),
      })),
    [ExamType.CAREER_EMT]: subjects
      .filter((subject) => subject.examType === ExamType.CAREER_EMT)
      .map((subject) => ({
        ...subject,
        maxScore: Number(subject.maxScore),
      })),
  };

  const runKey = `${Date.now()}`;
  const runPhoneSeed = runKey.slice(-8);

  const drafts: SubmissionDraft[] = [];
  const mockUsers: Array<{
    name: string;
    phone: string;
    password: string;
    role: Role;
  }> = [];

  let serial = 0;

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region: RegionInfo = regions[regionIndex];

    const examTypes: readonly ExamType[] = [
      ExamType.PUBLIC,
      ...(careerRescueEnabled ? [ExamType.CAREER_RESCUE] : []),
      ...(careerAcademicEnabled ? [ExamType.CAREER_ACADEMIC] : []),
      ...(careerEmtEnabled ? [ExamType.CAREER_EMT] : []),
    ];

    for (const examType of examTypes) {
      const subjectsOfType = subjectsByType[examType];
      if (subjectsOfType.length < 1) continue;

      const recruitCount =
        examType === ExamType.PUBLIC
          ? region.recruitPublicMale + region.recruitPublicFemale
          : examType === ExamType.CAREER_RESCUE
            ? region.recruitRescue
            : examType === ExamType.CAREER_ACADEMIC
              ? (region.recruitAcademicCombined > 0
                  ? region.recruitAcademicCombined
                  : region.recruitAcademicMale + region.recruitAcademicFemale)
              : region.recruitEmtMale + region.recruitEmtFemale;
      if (!Number.isInteger(recruitCount) || recruitCount < 1) continue;

      const perRegionCount =
        examType === ExamType.PUBLIC
          ? publicPerRegion
          : examType === ExamType.CAREER_RESCUE
            ? careerRescuePerRegion
            : examType === ExamType.CAREER_ACADEMIC
              ? careerAcademicPerRegion
              : careerEmtPerRegion;
      const maxTotal = subjectsOfType.reduce((sum, subject) => sum + subject.maxScore, 0);
      const regionBias = ((regionIndex % 9) - 4) * 0.028;

      for (let localIndex = 0; localIndex < perRegionCount; localIndex += 1) {
        serial += 1;
        const rankRatio = perRegionCount > 1 ? localIndex / (perRegionCount - 1) : 0;
        const basePercent = 0.92 - rankRatio * 0.36 + regionBias + (Math.random() - 0.5) * 0.03;
        const scorePercent = clamp(basePercent, 0.4, 0.98);
        const subjectScores = createScoreDraft(subjectsOfType, scorePercent, rankRatio > 0.82);

        const totalScore = roundOne(subjectScores.reduce((sum, item) => sum + item.rawScore, 0));
        const bonusType = chooseBonusType(recruitCount);
        const bonusRate = bonusRateOf(bonusType);
        const bonusScore = roundTwo(
          subjectScores.reduce((sum, item) => {
            if (item.isFailed) {
              return sum;
            }
            const subject = subjectsOfType.find((candidate) => candidate.id === item.subjectId);
            if (!subject) {
              return sum;
            }
            return sum + subject.maxScore * bonusRate;
          }, 0)
        );
        const finalScore = roundTwo(totalScore + bonusScore);

        const phone = `${MOCK_PHONE_PREFIX}${runPhoneSeed}${String(serial).padStart(4, "0")}`;
        const examNumber = `${MOCK_EXAM_NUMBER_PREFIX}-${targetExam.id}-${runKey}-${region.id}-${examType}-${String(
          localIndex + 1
        ).padStart(3, "0")}`;

        mockUsers.push({
          name: `${MOCK_USER_PREFIX}:${targetExam.id}:${runKey}:${serial}`,
          phone,
          password: MOCK_PASSWORD_HASH,
          role: Role.USER,
        });

        drafts.push({
          phone,
          examType,
          regionId: region.id,
          examNumber,
          gender: randomGender(),
          totalScore: clamp(totalScore, 0, maxTotal),
          bonusType,
          bonusRate,
          finalScore: clamp(finalScore, 0, maxTotal * 1.12),
          subjectScores,
        });
      }
    }
  }

  if (drafts.length < 1) {
    throw new Error("생성 가능한 지역/직렬 데이터가 없어 목업 데이터 생성을 건너뛰었습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const deletedBeforeGenerate = resetBeforeGenerate
      ? await resetMockDataWithClient(tx, { examId: targetExam.id })
      : { examId: targetExam.id, deleted: { submissions: 0, users: 0 } };

    await tx.user.createMany({
      data: mockUsers,
    });

    const createdUsers = await tx.user.findMany({
      where: {
        name: {
          startsWith: `${MOCK_USER_PREFIX}:${targetExam.id}:${runKey}:`,
        },
        phone: {
          startsWith: `${MOCK_PHONE_PREFIX}${runPhoneSeed}`,
        },
      },
      select: {
        id: true,
        phone: true,
      },
    });

    const userIdByPhone = new Map<string, number>(
      createdUsers.map((user) => [user.phone, user.id] as const)
    );
    const submissionCreateData: Prisma.SubmissionCreateManyInput[] = drafts.map((draft) => {
      const userId = userIdByPhone.get(draft.phone);
      if (!userId) {
        throw new Error("Failed to map generated mock users.");
      }

      return {
        examId: targetExam.id,
        userId,
        regionId: draft.regionId,
        examType: draft.examType,
        gender: draft.gender,
        examNumber: draft.examNumber,
        totalScore: draft.totalScore,
        bonusType: draft.bonusType,
        bonusRate: draft.bonusRate,
        finalScore: draft.finalScore,
      };
    });

    for (const chunk of chunkArray(submissionCreateData, 500)) {
      await tx.submission.createMany({
        data: chunk,
      });
    }

    const createdSubmissions = await tx.submission.findMany({
      where: {
        examId: targetExam.id,
        examNumber: {
          startsWith: `${MOCK_EXAM_NUMBER_PREFIX}-${targetExam.id}-${runKey}-`,
        },
      },
      select: {
        id: true,
        examNumber: true,
      },
    });

    const submissionIdByExamNumber = new Map<string, number>(
      createdSubmissions.map((submission) => [submission.examNumber, submission.id] as const)
    );

    const subjectScoreRows: Prisma.SubjectScoreCreateManyInput[] = [];
    const difficultyRows: Prisma.DifficultyRatingCreateManyInput[] = [];
    const finalPredictionSeeds: FinalPredictionSeedRow[] = [];

    for (const draft of drafts) {
      const submissionId = submissionIdByExamNumber.get(draft.examNumber);
      if (!submissionId) {
        throw new Error("Failed to map generated mock submissions.");
      }

      const userId = userIdByPhone.get(draft.phone);
      if (!userId) {
        throw new Error("Failed to map generated mock users.");
      }

      for (const score of draft.subjectScores) {
        subjectScoreRows.push({
          submissionId,
          subjectId: score.subjectId,
          rawScore: score.rawScore,
          isFailed: score.isFailed,
        });

        difficultyRows.push({
          submissionId,
          subjectId: score.subjectId,
          rating: score.rating,
        });
      }

      if (includeFinalPredictionMock) {
        finalPredictionSeeds.push(
          buildFinalPredictionSeedRow({
            submissionId,
            userId,
            draft,
          })
        );
      }
    }

    for (const chunk of chunkArray(subjectScoreRows, 1000)) {
      await tx.subjectScore.createMany({
        data: chunk,
      });
    }

    for (const chunk of chunkArray(difficultyRows, 1000)) {
      await tx.difficultyRating.createMany({
        data: chunk,
      });
    }

    let createdFinalPredictionCount = 0;
    if (includeFinalPredictionMock && finalPredictionSeeds.length > 0) {
      const rankMap = buildFinalPredictionRankMap(finalPredictionSeeds);
      const finalPredictionRows: Prisma.FinalPredictionCreateManyInput[] = finalPredictionSeeds.map((row) => ({
        submissionId: row.submissionId,
        userId: row.userId,
        fitnessScore: row.martialBonusPoint,
        interviewScore: row.additionalBonusPoint,
        interviewGrade: row.fitnessPassed ? "PASS" : "FAIL",
        finalScore: row.knownFinalScore,
        finalRank:
          row.fitnessPassed && row.knownFinalScore !== null
            ? (rankMap.get(row.submissionId) ?? null)
            : null,
      }));

      for (const chunk of chunkArray(finalPredictionRows, 1000)) {
        await tx.finalPrediction.createMany({
          data: chunk,
        });
      }

      createdFinalPredictionCount = finalPredictionRows.length;
    }

    return {
      examId: targetExam.id,
      examName: targetExam.name,
      runKey,
      deletedBeforeGenerate: deletedBeforeGenerate.deleted,
      created: {
        users: createdUsers.length,
        submissions: createdSubmissions.length,
        subjectScores: subjectScoreRows.length,
        difficultyRatings: difficultyRows.length,
        finalPredictions: createdFinalPredictionCount,
      },
    };
  });
}
