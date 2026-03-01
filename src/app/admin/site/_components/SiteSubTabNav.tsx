"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SITE_SUB_TABS = [
  { href: "/admin/site/basic", label: "기본" },
  { href: "/admin/site/policies", label: "약관" },
  { href: "/admin/site/visibility", label: "메뉴 공개" },
  { href: "/admin/site/operations", label: "운영" },
  { href: "/admin/site/auto-pass-cut", label: "자동 합격컷" },
] as const;

export default function SiteSubTabNav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-2">
      <ul className="flex flex-wrap gap-2">
        {SITE_SUB_TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-fire-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
