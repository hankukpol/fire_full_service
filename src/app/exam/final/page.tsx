"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminPreviewCandidate {
  submissionId: number;
  label: string;
}

interface FinalPredictionGetResponse {
  isAdminPreview: boolean;
  adminPreviewCandidates?: AdminPreviewCandidate[];
  submissionId: number | null;
  writtenScore: number | null;
  finalPrediction: {
    fitnessPassed: boolean;
    martialBonusPoint: number;
    additionalBonusPoint: number;
    knownBonusPoint: number;
    knownFinalScore: number | null;
    finalRank: number | null;
    totalParticipants: number;
    updatedAt: string;
  } | null;
}

interface FinalPredictionPostResponse {
  success: boolean;
  calculation: {
    martialBonusPoint: number;
    knownBonusPoint: number;
    knownFinalScore: number | null;
  };
  rank: {
    finalRank: number | null;
    totalParticipants: number;
  };
}

interface ExamFinalPageProps {
  embedded?: boolean;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSavedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("ko-KR");
}

export default function ExamFinalPage({ embedded = false }: ExamFinalPageProps = {}) {
  const router = useRouter();
  const { showErrorToast, showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<FinalPredictionGetResponse | null>(null);
  const [result, setResult] = useState<FinalPredictionPostResponse | null>(null);

  const [fitnessPassed, setFitnessPassed] = useState(true);
  const [martialDanLevelInput, setMartialDanLevelInput] = useState("0");
  const [additionalBonusInput, setAdditionalBonusInput] = useState("0");

  const [adminPreviewCandidates, setAdminPreviewCandidates] = useState<AdminPreviewCandidate[]>([]);
  const [selectedAdminSubmissionId, setSelectedAdminSubmissionId] = useState("");

  const load = useCallback(async (submissionId?: number): Promise<void> => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const query = submissionId ? `?submissionId=${submissionId}` : "";
      const response = await fetch(`/api/final-prediction${query}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as FinalPredictionGetResponse & { error?: string };

      if (!response.ok) {
        if (response.status === 403) {
          const message = payload.error ?? "최종 환산 예측 기능은 아직 공개되지 않았습니다.";
          if (embedded) {
            setErrorMessage(message);
          } else {
            router.replace("/exam/prediction");
          }
          return;
        }

        if (response.status === 404 && !embedded) {
          router.replace("/exam/input");
          return;
        }
        throw new Error(payload.error ?? "최종 환산 예측 정보를 불러오지 못했습니다.");
      }

      setData(payload);
      setAdminPreviewCandidates(payload.adminPreviewCandidates ?? []);

      if (payload.isAdminPreview && payload.submissionId === null && (payload.adminPreviewCandidates?.length ?? 0) > 0) {
        const firstSubmissionId = payload.adminPreviewCandidates?.[0]?.submissionId;
        if (firstSubmissionId) {
          setSelectedAdminSubmissionId(String(firstSubmissionId));
          await load(firstSubmissionId);
          return;
        }
      }

      if (payload.submissionId !== null) {
        setSelectedAdminSubmissionId(String(payload.submissionId));
      }

      if (payload.finalPrediction) {
        setFitnessPassed(payload.finalPrediction.fitnessPassed);
        setAdditionalBonusInput(String(payload.finalPrediction.additionalBonusPoint));
        setMartialDanLevelInput(
          payload.finalPrediction.martialBonusPoint >= 2
            ? "4"
            : payload.finalPrediction.martialBonusPoint >= 1
              ? "2"
              : "0"
        );
      } else {
        setFitnessPassed(true);
        setMartialDanLevelInput("0");
        setAdditionalBonusInput("0");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "최종 환산 예측 정보를 불러오지 못했습니다.";
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  }, [embedded, router, showErrorToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    if (!data?.submissionId) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/final-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: data.submissionId,
          fitnessPassed,
          martialDanLevel: toNumber(martialDanLevelInput, 0),
          additionalBonusPoint: toNumber(additionalBonusInput, 0),
        }),
      });
      const payload = (await response.json()) as FinalPredictionPostResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "최종 환산 예측 계산에 실패했습니다.");
      }

      setResult(payload);
      showToast("면접 제외 최종 환산 점수가 계산되었습니다.", "success");
      await load(data.submissionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "최종 환산 예측 계산에 실패했습니다.";
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAdminPreviewLoad() {
    const submissionId = toNumber(selectedAdminSubmissionId, 0);
    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      showErrorToast("관리자 미리보기 대상 제출 ID를 선택해 주세요.");
      return;
    }
    await load(submissionId);
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        최종 환산 예측 정보를 불러오는 중입니다...
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

  if (!data) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        최종 환산 예측 계산을 위한 데이터가 없습니다.
      </section>
    );
  }

  const hasTargetSubmission = data.submissionId !== null && data.writtenScore !== null;

  return (
    <div className="space-y-6">
      {data.isAdminPreview ? (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-sm font-semibold text-indigo-900">관리자 미리보기</h2>
          <p className="mt-1 text-xs text-indigo-800">
            MOCK 제출 데이터를 선택해 최종 환산 예측 계산을 검증할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              className="h-10 flex-1 rounded-md border border-indigo-300 bg-white px-3 text-sm"
              value={selectedAdminSubmissionId}
              onChange={(event) => setSelectedAdminSubmissionId(event.target.value)}
            >
              <option value="">미리보기 대상 제출 선택</option>
              {adminPreviewCandidates.map((candidate) => (
                <option key={candidate.submissionId} value={candidate.submissionId}>
                  {candidate.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={() => void handleAdminPreviewLoad()}>
              불러오기
            </Button>
          </div>
        </section>
      ) : null}

      {!hasTargetSubmission ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          최종 환산 예측 대상 제출이 없습니다. {data.isAdminPreview ? "관리자 미리보기 대상을 선택해 주세요." : "먼저 답안을 제출해 주세요."}
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="text-lg font-semibold text-slate-900">면접 제외 최종 환산 예측 (준비 기능)</h1>
            <p className="mt-1 text-sm text-slate-600">
              현재는 면접 점수 비공개를 전제로 필기점수 + 체력(통과/무도) + 추가 가산점 기준의 임시 순위를 계산합니다.
            </p>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              체력 통과 여부가 `통과`가 아니면 면접 제외 최종 환산 예측 순위에서 제외됩니다.
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              {data.finalPrediction ? (
                <>
                  현재 저장된 체력 통과 여부:{" "}
                  <span className="font-semibold">{data.finalPrediction.fitnessPassed ? "통과" : "미통과"}</span>{" "}
                  (저장 시각: {formatSavedAt(data.finalPrediction.updatedAt)})
                </>
              ) : (
                "아직 저장된 최종 환산 예측 정보가 없습니다. 체력 통과 여부를 입력한 뒤 계산 버튼을 누르면 저장됩니다."
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fitness-passed">체력 통과 여부</Label>
                <select
                  id="fitness-passed"
                  value={fitnessPassed ? "pass" : "fail"}
                  onChange={(event) => setFitnessPassed(event.target.value === "pass")}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="pass">통과</option>
                  <option value="fail">미통과</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="martial-dan">무도 단수 (0~20)</Label>
                <Input
                  id="martial-dan"
                  type="number"
                  min={0}
                  max={20}
                  step="1"
                  value={martialDanLevelInput}
                  onChange={(event) => setMartialDanLevelInput(event.target.value)}
                />
                <p className="text-xs text-slate-500">2~3단 +1점, 4단 이상 +2점</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="additional-bonus">추가 가산점 (0~10)</Label>
                <Input
                  id="additional-bonus"
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={additionalBonusInput}
                  onChange={(event) => setAdditionalBonusInput(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                {isSubmitting ? "계산 중..." : "면접 제외 최종 환산 예측 계산"}
              </Button>
            </div>
          </section>

          {result ? (
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
              <h2 className="text-base font-semibold text-slate-900">계산 결과</h2>
              <div className="mt-3 grid gap-3 rounded-lg bg-white p-4 text-sm sm:grid-cols-2">
                <p>필기 점수: {(data.writtenScore ?? 0).toFixed(2)}</p>
                <p>무도 가점: +{result.calculation.martialBonusPoint.toFixed(2)}</p>
                <p>추가 가산점: +{toNumber(additionalBonusInput, 0).toFixed(2)}</p>
                <p>합산 가산점: +{result.calculation.knownBonusPoint.toFixed(2)}</p>
                <p className="font-semibold text-slate-900">
                  면접 제외 최종 환산 점수:{" "}
                  {result.calculation.knownFinalScore === null ? "-" : result.calculation.knownFinalScore.toFixed(2)}
                </p>
              </div>
              <p className="mt-3 text-sm text-slate-700">
                임시 순위: {result.rank.finalRank ?? "-"} / {result.rank.totalParticipants}
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
