"use client";

import { useEffect, useState } from "react";

interface SiteSettingsResponse {
  settings?: {
    "site.footerDisclaimer"?: string;
  };
}

const DEFAULT_DISCLAIMER =
  "면책조항: 본 서비스는 수험생의 자기 점검을 위한 참고용 분석 도구이며, 실제 합격 여부를 보장하지 않습니다. 최종 선발 결과는 소방청 및 시·도 소방본부 공식 공고를 반드시 확인해 주세요.";

export default function Footer() {
  const [disclaimer, setDisclaimer] = useState(DEFAULT_DISCLAIMER);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/site-settings", { method: "GET", cache: "no-store" });
        const data = (await response.json()) as SiteSettingsResponse;
        const text = data.settings?.["site.footerDisclaimer"];
        if (typeof text === "string" && text.trim()) {
          setDisclaimer(text);
        }
      } catch {
        // 푸터는 기본 문구로 안전하게 동작
      }
    })();
  }, []);

  return (
    <footer className="border-t border-slate-800 bg-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-5">
        <p className="text-xs leading-relaxed text-white/70 sm:text-sm">{disclaimer}</p>
      </div>
    </footer>
  );
}
