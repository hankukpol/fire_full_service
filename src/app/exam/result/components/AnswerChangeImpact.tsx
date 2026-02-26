"use client";

import { useEffect, useState } from "react";

interface AnswerChangeImpactData {
  hasChanges: boolean;
  rescoreEventId: number | null;
  rescoreDate: string | null;
  reason: string | null;
  changedQuestions: Array<{
    subjectName: string;
    questionNumber: number;
    oldAnswer: number | null;
    newAnswer: number;
    myAnswer: number | null;
    impact: "GAINED" | "LOST" | "NO_CHANGE";
  }>;
  scoreChange: {
    subjects: Array<{
      subjectName: string;
      oldScore: number;
      newScore: number;
      delta: number;
    }>;
    oldTotalScore: number;
    newTotalScore: number;
    totalDelta: number;
    oldFinalScore: number | null;
    newFinalScore: number | null;
    oldRank: number | null;
    newRank: number | null;
    rankDelta: number | null;
  } | null;
  analysisComment: string;
}

interface AnswerChangeImpactProps {
  submissionId: number;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function impactText(impact: "GAINED" | "LOST" | "NO_CHANGE"): string {
  if (impact === "GAINED") return "득점";
  if (impact === "LOST") return "실점";
  return "변동 없음";
}

function impactClass(impact: "GAINED" | "LOST" | "NO_CHANGE"): string {
  if (impact === "GAINED") return "text-emerald-700";
  if (impact === "LOST") return "text-rose-700";
  return "text-slate-600";
}

export default function AnswerChangeImpact({ submissionId }: AnswerChangeImpactProps) {
  const [data, setData] = useState<AnswerChangeImpactData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("전체");

  useEffect(() => {
    let mounted = true;

    async function fetchImpact() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const response = await fetch(`/api/analysis/answer-change-impact?submissionId=${submissionId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as { success?: boolean; error?: string; data?: AnswerChangeImpactData };

        if (!response.ok) {
          if (response.status === 404) {
            if (!mounted) return;
            setData({
              hasChanges: false,
              rescoreEventId: null,
              rescoreDate: null,
              reason: null,
              changedQuestions: [],
              scoreChange: null,
              analysisComment: "아직 정답 변경이 없습니다.",
            });
            return;
          }
          throw new Error(payload.error ?? "정답 변경 분석 데이터를 불러오지 못했습니다.");
        }

        if (!mounted) return;
        setData(payload.data ?? null);
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(error instanceof Error ? error.message : "정답 변경 분석 데이터를 불러오지 못했습니다.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchImpact();
    return () => {
      mounted = false;
    };
  }, [submissionId]);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        정답 변경 영향 분석을 불러오는 중입니다...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {errorMessage}
      </section>
    );
  }

  if (!data || !data.hasChanges) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">정답 변경 영향 분석</h2>
        <p className="mt-3 text-sm text-slate-600">아직 정답 변경이 없습니다. 확정답안이 발표되면 자동으로 분석 결과가 표시됩니다.</p>
      </section>
    );
  }

  const subjects = ["전체", ...Array.from(new Set(data.changedQuestions.map((q) => q.subjectName)))];
  const filteredQuestions = selectedSubject === "전체"
    ? data.changedQuestions
    : data.changedQuestions.filter((q) => q.subjectName === selectedSubject);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">정답 변경 영향 분석</h2>
        <p className="text-xs text-slate-500">변경 일시: {formatDateTime(data.rescoreDate)}</p>
      </div>

      {data.reason ? <p className="text-sm text-slate-600">사유: {data.reason}</p> : null}

      {subjects.length > 2 && (
        <div className="flex flex-wrap gap-2 pt-1 pb-2">
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${selectedSubject === subject
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {subject}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-200 px-3 py-2 text-left w-[120px]">과목</th>
              <th className="border border-slate-200 px-3 py-2 text-center">문항</th>
              <th className="border border-slate-200 px-3 py-2 text-center">변경 전</th>
              <th className="border border-slate-200 px-3 py-2 text-center">변경 후</th>
              <th className="border border-slate-200 px-3 py-2 text-center">내 답안</th>
              <th className="border border-slate-200 px-3 py-2 text-center">영향</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((item) => (
                <tr key={`${item.subjectName}-${item.questionNumber}`}>
                  <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">{item.subjectName}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{item.questionNumber}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{item.oldAnswer ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-blue-600">{item.newAnswer}</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{item.myAnswer ?? "-"}</td>
                  <td className={`border border-slate-200 px-3 py-2 text-center font-semibold ${impactClass(item.impact)}`}>
                    {impactText(item.impact)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="border border-slate-200 px-3 py-8 text-center text-slate-500">
                  해당 과목의 정답 변경 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.scoreChange ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-3 py-2 text-left">구분</th>
                <th className="border border-slate-200 px-3 py-2 text-right">변경 전</th>
                <th className="border border-slate-200 px-3 py-2 text-right">변경 후</th>
                <th className="border border-slate-200 px-3 py-2 text-right">변동</th>
              </tr>
            </thead>
            <tbody>
              {data.scoreChange.subjects.map((subject) => (
                <tr key={subject.subjectName}>
                  <td className="border border-slate-200 px-3 py-2">{subject.subjectName}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{subject.oldScore.toFixed(1)}점</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{subject.newScore.toFixed(1)}점</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{subject.delta > 0 ? "+" : ""}{subject.delta.toFixed(1)}점</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="border border-slate-200 px-3 py-2">총점</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{data.scoreChange.oldTotalScore.toFixed(1)}점</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{data.scoreChange.newTotalScore.toFixed(1)}점</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{data.scoreChange.totalDelta > 0 ? "+" : ""}{data.scoreChange.totalDelta.toFixed(1)}점</td>
              </tr>
              {data.scoreChange.oldRank !== null && data.scoreChange.newRank !== null ? (
                <tr>
                  <td className="border border-slate-200 px-3 py-2">석차</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{data.scoreChange.oldRank}등</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{data.scoreChange.newRank}등</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">
                    {data.scoreChange.rankDelta === null ? "-" : `${data.scoreChange.rankDelta > 0 ? "+" : ""}${data.scoreChange.rankDelta}`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-sm font-medium text-slate-700">안내: {data.analysisComment}</p>
    </section>
  );
}
