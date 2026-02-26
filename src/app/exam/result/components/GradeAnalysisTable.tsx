"use client";

import type { ResultResponse } from "@/app/exam/result/types";

interface GradeAnalysisTableProps {
  result: ResultResponse;
}

function formatBonusType(type: ResultResponse["submission"]["bonusType"]): string {
  switch (type) {
    case "VETERAN_5":
      return "취업지원 5%";
    case "VETERAN_10":
      return "취업지원 10%";
    case "HERO_3":
      return "의사상자 3%";
    case "HERO_5":
      return "의사상자 5%";
    default:
      return "해당 없음";
  }
}

function formatRankingBasis(basis: ResultResponse["statistics"]["rankingBasis"]): string {
  if (basis === "NON_CUTOFF_PARTICIPANTS") return "과락 미해당자 기준";
  return "전체 참여자 기준";
}

/** 점수 포맷: 정수면 소수점 제거, 아니면 1자리 유지 (45→"45", 92.5→"92.5") */
function formatScore(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

/** 만점/최고점/최저점 포맷: 항상 정수 (50.0→"50") */
function formatInt(value: number): string {
  return Math.round(value).toString();
}

/** 백분율 포맷: 소수점 2자리 + % */
function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** 통계값 포맷 (평균 등): 소수점 있으면 유지, 정수면 제거 */
function formatStat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

const TH = "border border-slate-200 px-3 py-2 text-center text-slate-700";
const TD = "border border-slate-200 px-3 py-2 text-right";

export default function GradeAnalysisTable({ result }: GradeAnalysisTableProps) {
  const summary = result.analysisSummary;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">전체 성적 요약</h2>
        <p className="text-xs text-slate-500">순위 기준: {formatRankingBasis(result.statistics.rankingBasis)}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[960px] w-full border-collapse text-sm">
          <thead>
            {/* 1행: 그룹 헤더 */}
            <tr className="bg-slate-100">
              <th rowSpan={2} className={`${TH} w-[100px]`}>과목</th>
              <th colSpan={4} className={TH}>내 점수</th>
              <th colSpan={5} className={TH}>전체 입력자 기준</th>
            </tr>
            {/* 2행: 세부 헤더 */}
            <tr className="bg-slate-50 text-slate-600">
              <th className={TH}>정답수(개)</th>
              <th className={TH}>원점수</th>
              <th className={TH}>상위(%)</th>
              <th className={TH}>백분위(%)</th>
              <th className={TH}>상위10%{"\n"}평균</th>
              <th className={TH}>상위30%{"\n"}평균</th>
              <th className={TH}>전체 평균</th>
              <th className={TH}>과목{"\n"}최고점</th>
              <th className={TH}>과목{"\n"}최저점</th>
            </tr>
          </thead>
          <tbody>
            {summary.subjects.map((subject) => (
              <tr key={subject.subjectId} className="bg-white">
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">{subject.subjectName}</td>
                <td className={TD}>{subject.correctCount}/{subject.questionCount}</td>
                <td className={TD}>
                  {formatScore(subject.myScore)}/{formatInt(subject.maxScore)}
                </td>
                <td className={TD}>{formatPercent(subject.topPercent)}</td>
                <td className={TD}>{formatPercent(subject.percentile)}</td>
                <td className={TD}>{formatStat(subject.top10Average)}</td>
                <td className={TD}>{formatStat(subject.top30Average)}</td>
                <td className={TD}>{formatStat(subject.averageScore)}</td>
                <td className={TD}>{formatInt(subject.highestScore)}</td>
                <td className={TD}>{formatInt(subject.lowestScore)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold text-slate-900">
              <td className="border border-slate-200 px-3 py-2">총점</td>
              <td className={TD}>{summary.total.correctCount}/{summary.total.questionCount}</td>
              <td className={TD}>
                {formatScore(summary.total.myScore)}/{formatInt(summary.total.maxScore)}
              </td>
              <td className={TD}>{formatPercent(summary.total.topPercent)}</td>
              <td className={TD}>{formatPercent(summary.total.percentile)}</td>
              <td className={TD}>{formatStat(summary.total.top10Average)}</td>
              <td className={TD}>{formatStat(summary.total.top30Average)}</td>
              <td className={TD}>{formatStat(summary.total.averageScore)}</td>
              <td className={TD}>{formatInt(summary.total.highestScore)}</td>
              <td className={TD}>{formatInt(summary.total.lowestScore)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {result.statistics.hasCutoff && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-rose-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-200 text-sm text-rose-800">
                !
              </span>
              과락 과목이 있습니다
            </h3>
            <ul className="flex flex-col gap-2.5">
              {result.statistics.cutoffSubjects.map((subject) => (
                <li key={subject.subjectName} className="flex items-center justify-between rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm text-rose-700">
                  <span className="font-semibold">{subject.subjectName}</span>
                  <div className="text-right">
                    <span className="font-bold">{formatScore(subject.rawScore)}점</span>
                    <span className="ml-1.5 text-xs font-normal text-rose-500">(기준 {formatScore(subject.cutoffScore)}점 미만)</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`rounded-2xl border border-slate-200 bg-slate-50/50 p-5 ${!result.statistics.hasCutoff ? 'sm:col-span-2 sm:w-1/2 sm:mx-auto' : ''}`}>
          <div className="flex flex-col gap-0">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3.5">
              <span className="text-sm font-medium text-slate-500">원점수 합계</span>
              <span className="text-base font-semibold text-slate-700">{formatScore(result.submission.totalScore)}점</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 py-3.5">
              <span className="text-sm font-medium text-slate-500">
                가산점
                <span className="ml-2 inline-flex items-center rounded-md bg-slate-200/60 px-2 py-0.5 text-xs font-normal text-slate-600">
                  {formatBonusType(result.submission.bonusType)} {(result.submission.bonusRate * 100).toFixed(0)}%
                </span>
              </span>
              <span className="text-base font-semibold text-emerald-600">+{formatScore(result.statistics.bonusScore)}점</span>
            </div>
            <div className="flex items-center justify-between pt-4">
              <span className="text-base font-bold text-slate-900">최종점수</span>
              <span className="text-2xl font-bold tracking-tight text-blue-600">{formatScore(result.submission.finalScore)}점</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
