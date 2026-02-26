"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ExamTabNavigationProps {
  hasSubmission: boolean;
  finalPredictionEnabled?: boolean;
  commentsEnabled?: boolean;
}

interface TabItem {
  href: string;
  label: string;
  disabled: boolean;
  tooltip?: string;
}

function tabClassName(active: boolean, disabled: boolean): string {
  const base =
    "inline-flex w-full min-w-0 items-center justify-center rounded-md px-2 py-2 text-xs font-semibold transition sm:w-auto sm:min-w-[120px] sm:rounded-none sm:border-b-2 sm:px-4 sm:py-3 sm:text-sm";

  if (disabled) {
    return `${base} cursor-not-allowed text-slate-400 sm:border-transparent`;
  }

  if (active) {
    return `${base} bg-slate-100 text-slate-900 sm:bg-transparent sm:border-slate-900`;
  }

  return `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:bg-transparent sm:border-transparent sm:hover:border-slate-300 sm:hover:bg-transparent`;
}

export default function ExamTabNavigation({
  hasSubmission,
  finalPredictionEnabled = false,
  commentsEnabled = true,
}: ExamTabNavigationProps) {
  const pathname = usePathname();

  const tabs: TabItem[] = [
    { href: "/exam/main", label: "풀서비스 메인", disabled: false },
    { href: "/exam/input", label: "응시정보 입력", disabled: false },
    {
      href: "/exam/result",
      label: "내 성적 분석",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
    {
      href: "/exam/final",
      label: "최종 환산 예측",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
    {
      href: "/exam/prediction",
      label: "합격 예측",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
    {
      href: "/exam/comments",
      label: "실시간 댓글",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
  ];
  const visibleTabs = tabs.filter((tab) => {
    if (tab.href === "/exam/final") return finalPredictionEnabled;
    if (tab.href === "/exam/comments") return commentsEnabled;
    return true;
  });

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid w-full grid-cols-3 gap-1 p-1 sm:flex sm:min-w-max sm:max-w-7xl sm:gap-0 sm:p-0">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href;
          if (tab.disabled) {
            return (
              <span
                key={tab.href}
                className={tabClassName(active, true)}
                title={tab.tooltip}
                aria-disabled="true"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <Link key={tab.href} href={tab.href} className={tabClassName(active, false)} title={tab.tooltip}>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
