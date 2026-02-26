"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import NotificationBell from "@/components/layout/NotificationBell";
import { Button } from "@/components/ui/button";

interface SiteSettingsResponse {
  settings?: {
    "site.title"?: string;
  };
}

export default function Header() {
  const { data: session, status } = useSession();
  const [siteTitle, setSiteTitle] = useState("소방 필기 합격예측");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/site-settings", { method: "GET", cache: "no-store" });
        const data = (await response.json()) as SiteSettingsResponse;
        const title = data.settings?.["site.title"];
        if (typeof title === "string" && title.trim()) {
          setSiteTitle(title);
        }
      } catch {
        // 헤더는 기본값으로 안전하게 표시
      }
    })();
  }, []);

  return (
    <header className="border-b border-[#111111] bg-[#111111] text-white">
      <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="text-base font-black tracking-tight text-white sm:text-lg">
          {siteTitle}
        </Link>

        {status === "loading" ? (
          <p className="text-sm text-white/60">세션 확인 중...</p>
        ) : session?.user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-sm leading-tight text-white/80 sm:block">
              <p className="font-medium">{session.user.name}</p>
              <p>{session.user.phone}</p>
            </div>
            <NotificationBell />
            {session.user.role === "ADMIN" ? (
              <Link href="/admin">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20"
                >
                  관리자
                </Button>
              </Link>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              로그아웃
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login">
              <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700">
                로그인
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="sm"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                회원가입
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
