"use client";

import { useEffect, useMemo, useState } from "react";
import ExamCommentsPage from "@/app/exam/comments/page";
import ExamFaqPage from "@/app/exam/faq/page";
import ExamFinalPage from "@/app/exam/final/page";
import ExamInputPage from "@/app/exam/input/page";
import ExamNoticesPage from "@/app/exam/notices/page";
import ExamPredictionPage from "@/app/exam/prediction/page";
import ExamResultPage from "@/app/exam/result/page";
import ExamMainOverviewPanel from "@/components/landing/ExamMainOverviewPanel";

type TabKey = "main" | "input" | "result" | "final" | "prediction" | "comments" | "notices" | "faq";

interface ExamFunctionAreaProps {
  isAuthenticated: boolean;
  hasSubmission: boolean;
  isAdmin?: boolean;
  finalPredictionEnabled?: boolean;
  commentsEnabled?: boolean;
}

interface TabItem {
  key: TabKey;
  label: string;
  requireSubmission: boolean;
}

const tabs: TabItem[] = [
  { key: "main", label: "풀서비스 메인", requireSubmission: false },
  { key: "input", label: "응시정보 입력", requireSubmission: false },
  { key: "result", label: "내 성적 분석", requireSubmission: true },
  { key: "final", label: "최종 환산 예측", requireSubmission: true },
  { key: "prediction", label: "합격 컷/경쟁자 정보", requireSubmission: true },
  { key: "comments", label: "실시간 댓글", requireSubmission: true },
  { key: "notices", label: "공지사항", requireSubmission: false },
  { key: "faq", label: "FAQ", requireSubmission: false },
];

function tabClassName(active: boolean, disabled: boolean): string {
  const base =
    "relative inline-flex w-full min-w-0 items-center justify-center rounded-md px-2 py-2 text-xs font-semibold transition sm:w-auto sm:px-6 sm:py-4 sm:text-base";
  if (disabled) {
    return `${base} cursor-not-allowed text-slate-400`;
  }
  if (active) {
    return `${base} bg-slate-100 text-slate-900 sm:bg-transparent sm:after:absolute sm:after:bottom-0 sm:after:left-0 sm:after:h-[2px] sm:after:w-full sm:after:bg-slate-900`;
  }
  return `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:bg-transparent sm:text-slate-400 sm:hover:bg-transparent sm:hover:text-slate-600`;
}

export default function ExamFunctionArea({
  isAuthenticated,
  hasSubmission,
  isAdmin = false,
  finalPredictionEnabled = false,
  commentsEnabled = true,
}: ExamFunctionAreaProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const [localHasSubmission, setLocalHasSubmission] = useState(hasSubmission);
  const canAccessRestrictedTabs = localHasSubmission || isAdmin;
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => {
      if (tab.key === "final") return finalPredictionEnabled;
      if (tab.key === "comments") return commentsEnabled;
      return true;
    }),
    [finalPredictionEnabled, commentsEnabled]
  );

  useEffect(() => {
    setLocalHasSubmission(hasSubmission);
  }, [hasSubmission]);

  const activeTabMeta = useMemo(
    () => visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0],
    [activeTab, visibleTabs]
  );

  useEffect(() => {
    if (activeTabMeta.requireSubmission && !canAccessRestrictedTabs) {
      setActiveTab("main");
    }
  }, [activeTabMeta.requireSubmission, canAccessRestrictedTabs]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("main");
    }
  }, [activeTab, visibleTabs]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <section
      id="exam-functions"
      className="border border-slate-200 bg-slate-50 p-0"
    >
      <div className="border-b border-slate-200 bg-white px-1 sm:px-3">
        <div className="grid grid-cols-3 gap-1 py-1 sm:flex sm:min-w-max sm:items-center sm:gap-0 sm:py-0">
          {visibleTabs.map((tab) => {
            const disabled = tab.requireSubmission && !canAccessRestrictedTabs;
            return (
              <button
                key={tab.key}
                type="button"
                className={tabClassName(activeTab === tab.key, disabled)}
                disabled={disabled}
                onClick={() => setActiveTab(tab.key)}
                title={disabled ? "답안 제출 후 활성화됩니다." : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-50 p-0 sm:p-0">
        <div className="border border-slate-200 border-t-0 bg-white p-4 sm:p-8">
          {activeTab === "main" ? <ExamMainOverviewPanel /> : null}
          {activeTab === "input" ? (
            <ExamInputPage
              embedded
              onSubmitted={() => {
                setLocalHasSubmission(true);
                setActiveTab("result");
              }}
            />
          ) : null}
          {activeTab === "result" ? <ExamResultPage embedded /> : null}
          {activeTab === "final" ? <ExamFinalPage embedded /> : null}
          {activeTab === "prediction" ? <ExamPredictionPage embedded /> : null}
          {activeTab === "comments" ? <ExamCommentsPage embedded /> : null}
          {activeTab === "notices" ? <ExamNoticesPage embedded /> : null}
          {activeTab === "faq" ? <ExamFaqPage embedded /> : null}
        </div>
      </div>
    </section>
  );
}
