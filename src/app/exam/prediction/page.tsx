"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PassCutHistoryTable from "@/components/prediction/PassCutHistoryTable";
import PassCutTrendChart from "@/components/prediction/PassCutTrendChart";
import PredictionLiveDashboard from "@/components/prediction/PredictionLiveDashboard";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";

interface PredictionPageResponse {
  summary: {
    submissionId: number;
    examId: number;
    examName: string;
    examYear: number;
    examRound: number;
    userName: string;
    examType: "PUBLIC" | "CAREER_RESCUE" | "CAREER_ACADEMIC" | "CAREER_EMT";
    examTypeLabel: string;
    regionId: number;
    regionName: string;
    recruitCount: number;
    applicantCount: number | null;
    estimatedApplicants: number;
    isApplicantCountExact: boolean;
    totalParticipants: number;
    myScore: number;
    myRank: number;
    myMultiple: number;
    oneMultipleBaseRank: number;
    oneMultipleActualRank: number | null;
    oneMultipleCutScore: number | null;
    oneMultipleTieCount: number | null;
    isOneMultipleCutConfirmed: boolean;
    passMultiple: number;
    likelyMultiple: number;
    passCount: number;
    passLineScore: number | null;
    predictionGrade: "확실권" | "유력권" | "가능권" | "도전권";
    disclaimer: string;
  };
  pyramid: {
    levels: Array<{
      key: "sure" | "likely" | "possible" | "challenge" | "belowChallenge";
      label: string;
      count: number;
      minScore: number | null;
      maxScore: number | null;
      minMultiple: number | null;
      maxMultiple: number | null;
      isCurrent: boolean;
    }>;
    counts: {
      sure: number;
      likely: number;
      possible: number;
      challenge: number;
      belowChallenge: number;
    };
  };
  competitors: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    items: Array<{
      submissionId: number;
      userId: number;
      rank: number;
      score: number;
      maskedName: string;
      isMine: boolean;
    }>;
  };
  updatedAt: string;
}

interface CompetitorDetailResponse {
  competitor: {
    submissionId: number;
    rank: number;
    maskedName: string;
    score: number;
    isMine: boolean;
    totalParticipants: number;
    examTypeLabel: string;
    regionName: string;
  };
  subjectScores: Array<{
    subjectId: number;
    subjectName: string;
    rawScore: number;
    maxScore: number;
    percentage: number;
    isFailed: boolean;
  }>;
}

interface PassCutSnapshot {
  participantCount: number;
  recruitCount: number;
  applicantCount: number | null;
  targetParticipantCount: number | null;
  coverageRate: number | null;
  stabilityScore: number | null;
  status:
    | "READY"
    | "COLLECTING_LOW_PARTICIPATION"
    | "COLLECTING_UNSTABLE"
    | "COLLECTING_MISSING_APPLICANT_COUNT"
    | "COLLECTING_INSUFFICIENT_SAMPLE";
  statusReason: string | null;
  averageScore: number | null;
  oneMultipleCutScore: number | null;
  sureMinScore: number | null;
  likelyMinScore: number | null;
  possibleMinScore: number | null;
}

interface PassCutHistoryResponse {
  releases: Array<{
    releaseNumber: number;
    releasedAt: string;
    totalParticipantCount: number;
    snapshot: PassCutSnapshot | null;
  }>;
  current: PassCutSnapshot;
}

interface ExamPredictionPageProps {
  embedded?: boolean;
}

function formatScore(value: number | null): string {
  if (value === null) return "-";
  return value.toFixed(2);
}

/** 스마트 소수점 포맷: 정수면 소수점 제거, 아니면 1자리 유지 */
function formatScoreSmart(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getParticipationRate(participants: number, estimated: number): number {
  if (estimated <= 0) return 0;
  return (participants / estimated) * 100;
}

function getConfidenceLevel(rate: number): {
  label: string;
  message: string;
  barColor: string;
  badgeClass: string;
} {
  if (rate >= 30)
    return {
      label: "확정적",
      message: "충분한 데이터가 모여 신뢰도가 높습니다.",
      barColor: "bg-emerald-500",
      badgeClass: "bg-emerald-200 text-emerald-800 font-bold",
    };
  if (rate >= 15)
    return {
      label: "신뢰도 높음",
      message: "어느 정도 신뢰할 수 있는 데이터입니다.",
      barColor: "bg-blue-500",
      badgeClass: "bg-emerald-100 text-emerald-700",
    };
  if (rate >= 5)
    return {
      label: "집계 중",
      message: "데이터 수집 중입니다. 순위 변동 가능성이 있습니다.",
      barColor: "bg-blue-400",
      badgeClass: "bg-blue-100 text-blue-700",
    };
  return {
    label: "초기 집계",
    message: "초기 데이터입니다. 순위가 크게 변동될 수 있습니다.",
    barColor: "bg-amber-400",
    badgeClass: "bg-amber-100 text-amber-700",
  };
}

/** 등급별 비율 바 색상 */
function levelBarColor(key: PredictionPageResponse["pyramid"]["levels"][number]["key"]): string {
  if (key === "sure") return "bg-blue-600";
  if (key === "likely") return "bg-blue-400";
  if (key === "possible") return "bg-cyan-400";
  if (key === "challenge") return "bg-slate-400";
  return "bg-slate-300";
}

function levelColor(
  key: PredictionPageResponse["pyramid"]["levels"][number]["key"],
  current: boolean
): string {
  if (key === "sure") return current ? "bg-blue-900" : "bg-blue-800";
  if (key === "likely") return current ? "bg-blue-700" : "bg-blue-600";
  if (key === "possible") return current ? "bg-cyan-600" : "bg-cyan-500";
  if (key === "challenge") return current ? "bg-slate-500" : "bg-slate-400";
  return current ? "bg-slate-300" : "bg-slate-200";
}

function levelTextColor(key: PredictionPageResponse["pyramid"]["levels"][number]["key"]): string {
  return key === "belowChallenge" ? "text-slate-700" : "text-white";
}

function buildPageNumbers(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

export default function ExamPredictionPage({ embedded = false }: ExamPredictionPageProps = {}) {
  const router = useRouter();
  const { showErrorToast } = useToast();

  const [page, setPage] = useState(1);
  const [prediction, setPrediction] = useState<PredictionPageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [passCutHistory, setPassCutHistory] = useState<PassCutHistoryResponse | null>(null);
  const [isPassCutLoading, setIsPassCutLoading] = useState(false);

  const [isCompetitorModalOpen, setIsCompetitorModalOpen] = useState(false);
  const [isCompetitorDetailLoading, setIsCompetitorDetailLoading] = useState(false);
  const [competitorDetailError, setCompetitorDetailError] = useState("");
  const [competitorDetail, setCompetitorDetail] = useState<CompetitorDetailResponse | null>(null);

  const pageRef = useRef(page);

  const fetchPrediction = useCallback(
    async (targetPage: number, silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const response = await fetch(`/api/prediction?page=${targetPage}&limit=20`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as PredictionPageResponse & { error?: string };

        if (!response.ok) {
          if (response.status === 401) {
            if (embedded) {
              setErrorMessage("로그인이 필요합니다.");
            } else {
              router.replace("/login?callbackUrl=/exam/prediction");
            }
            return;
          }

          if (response.status === 404 || response.status === 400) {
            const apiMessage = data.error ?? "";
            // "제출 데이터가 없습니다" — 진짜 미제출인 경우에만 입력 페이지로 이동
            const isNoSubmission = apiMessage.includes("제출 데이터가 없습니다");
            if (isNoSubmission && !embedded) {
              router.replace("/exam/input");
              return;
            }
            setErrorMessage(apiMessage || "합격예측 데이터를 불러오지 못했습니다.");
            return;
          }

          throw new Error(data.error ?? "합격예측 데이터를 불러오지 못했습니다.");
        }

        setPrediction(data);
        if (targetPage !== data.competitors.page) {
          setPage(data.competitors.page);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "합격예측 데이터를 불러오지 못했습니다.";
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [embedded, router, showErrorToast]
  );

  useEffect(() => {
    void fetchPrediction(page);
  }, [fetchPrediction, page]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchPrediction(pageRef.current, true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchPrediction]);

  useEffect(() => {
    const summary = prediction?.summary;
    if (!summary) {
      setPassCutHistory(null);
      return;
    }

    let cancelled = false;
    setIsPassCutLoading(true);
    (async () => {
      try {
        const query = new URLSearchParams({
          examId: String(summary.examId),
          regionId: String(summary.regionId),
          examType: summary.examType,
        });
        const response = await fetch(`/api/pass-cut-history?${query.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) {
            setPassCutHistory(null);
          }
          return;
        }
        const data = (await response.json()) as PassCutHistoryResponse;
        if (!cancelled) {
          setPassCutHistory(data);
        }
      } catch {
        if (!cancelled) {
          setPassCutHistory(null);
        }
      } finally {
        if (!cancelled) {
          setIsPassCutLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prediction?.summary]);

  useEffect(() => {
    if (!isCompetitorModalOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCompetitorModalOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCompetitorModalOpen]);

  const handleOpenCompetitorDetail = useCallback(
    async (submissionId: number) => {
      setIsCompetitorModalOpen(true);
      setIsCompetitorDetailLoading(true);
      setCompetitorDetailError("");
      setCompetitorDetail(null);

      try {
        const response = await fetch(`/api/prediction/competitor?submissionId=${submissionId}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as CompetitorDetailResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "세부 성적 조회에 실패했습니다.");
        }

        setCompetitorDetail(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "세부 성적 조회에 실패했습니다.";
        setCompetitorDetailError(message);
        showErrorToast(message);
      } finally {
        setIsCompetitorDetailLoading(false);
      }
    },
    [showErrorToast]
  );

  const pageNumbers = useMemo(() => {
    if (!prediction) return [];
    return buildPageNumbers(prediction.competitors.page, prediction.competitors.totalPages);
  }, [prediction]);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        합격예측 데이터를 불러오는 중입니다...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
        {errorMessage}
      </section>
    );
  }

  if (!prediction) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        합격예측 데이터가 없습니다.
      </section>
    );
  }

  const { summary, pyramid, competitors } = prediction;
  const participationRate = getParticipationRate(
    summary.totalParticipants,
    summary.applicantCount ?? 0
  );
  const confidence = getConfidenceLevel(participationRate);

  // 트랙용 역순 (좌→우: 도전이하 → 확실권)
  const trackLevels = pyramid.levels.slice().reverse();
  // 내 위치 마커 (rank 1 = 우측 100%, 최하위 = 좌측 0%)
  const markerPercent = summary.totalParticipants <= 1
    ? 50
    : ((summary.totalParticipants - summary.myRank) / (summary.totalParticipants - 1)) * 100;
  // 내 등급 라벨
  const myLevelLabel = pyramid.levels.find((l) => l.isCurrent)?.label ?? "";

  return (
    <div className="space-y-6">
      <PredictionLiveDashboard prediction={prediction} />

      {isPassCutLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          합격컷 발표 이력을 불러오는 중입니다...
        </section>
      ) : passCutHistory ? (
        <>
          <PassCutHistoryTable releases={passCutHistory.releases} current={passCutHistory.current} myScore={summary.myScore} />
          <PassCutTrendChart releases={passCutHistory.releases} current={passCutHistory.current} myScore={summary.myScore} />
        </>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900">경쟁자 순위</h2>
          <p className="text-xs text-slate-500">
            {competitors.totalCount.toLocaleString("ko-KR")}명 중 {competitors.page}/{competitors.totalPages} 페이지
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-3 py-2 text-left">석차</th>
                <th className="border border-slate-200 px-3 py-2 text-left">이름</th>
                <th className="border border-slate-200 px-3 py-2 text-right">점수</th>
                <th className="border border-slate-200 px-3 py-2 text-center">세부성적보기</th>
              </tr>
            </thead>
            <tbody>
              {competitors.items.map((competitor) => (
                <tr
                  key={competitor.submissionId}
                  className={competitor.isMine ? "bg-blue-50 font-semibold text-blue-900" : "bg-white"}
                >
                  <td className="border border-slate-200 px-3 py-2">{competitor.rank}</td>
                  <td className="border border-slate-200 px-3 py-2">
                    {competitor.isMine ? "본인" : competitor.maskedName}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right">
                    {competitor.score.toFixed(2)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center">
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
                      onClick={() => void handleOpenCompetitorDetail(competitor.submissionId)}
                    >
                      [성적보기]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={competitors.page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </Button>
          {pageNumbers.map((number) => (
            <Button
              key={number}
              type="button"
              variant={number === competitors.page ? "default" : "outline"}
              onClick={() => setPage(number)}
            >
              {number}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={competitors.page >= competitors.totalPages}
            onClick={() => setPage((prev) => Math.min(competitors.totalPages, prev + 1))}
          >
            다음
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-1.5">
        <p className="font-semibold">안내사항</p>
        <p>{summary.disclaimer}</p>
        <p>
          본 서비스의 모든 분석은 <strong>서비스 참여자({summary.totalParticipants.toLocaleString()}명) 기준</strong>이며,
          실제 시험 결과와 차이가 있을 수 있습니다.
          참여율({participationRate.toFixed(1)}%)이 낮을수록 예측 정확도가 떨어지며,
          참여자가 늘어남에 따라 순위 및 합격등급이 변동될 수 있습니다.
        </p>
      </section>

      {isCompetitorModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setIsCompetitorModalOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">세부 성적 보기</h3>
                <p className="mt-1 text-xs text-slate-500">
                  동일 {summary.examTypeLabel} · {summary.regionName} 입력자 기준
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsCompetitorModalOpen(false)}>
                닫기
              </Button>
            </div>

            {isCompetitorDetailLoading ? (
              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                세부 성적을 불러오는 중입니다...
              </p>
            ) : competitorDetailError ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {competitorDetailError}
              </p>
            ) : competitorDetail ? (
              <>
                <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">석차</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {competitorDetail.competitor.rank} / {competitorDetail.competitor.totalParticipants}
                    </p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">아이디</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {competitorDetail.competitor.maskedName}
                    </p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">점수</p>
                    <p className="mt-1 text-lg font-bold text-blue-700">
                      {formatScoreSmart(competitorDetail.competitor.score)}
                    </p>
                  </article>
                </section>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-200 px-3 py-2 text-left">과목</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">원점수</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">만점</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">백분율</th>
                        <th className="border border-slate-200 px-3 py-2 text-center">과락</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitorDetail.subjectScores.map((subject) => (
                        <tr key={subject.subjectId} className="bg-white">
                          <td className="border border-slate-200 px-3 py-2 text-slate-900">
                            {subject.subjectName}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right text-slate-700">
                            {formatScoreSmart(subject.rawScore)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right text-slate-700">
                            {Math.round(subject.maxScore)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right text-slate-700">
                            {subject.percentage.toFixed(1)}%
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-center">
                            {subject.isFailed ? (
                              <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                                과락
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
