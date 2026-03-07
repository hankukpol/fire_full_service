"use client";

import { useEffect } from "react";

// 로그인한 사용자의 방문을 하루 1회 기록하는 컴포넌트.
// 세션스토리지로 중복 호출을 방지하며, 실패해도 사용자 경험에 영향 없음.
export default function VisitorTracker() {
  useEffect(() => {
    const key = `visitor_tracked_${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;

    fetch("/api/track-visit", { method: "POST" })
      .then((res) => {
        if (res.ok) sessionStorage.setItem(key, "1");
      })
      .catch(() => {
        // 무시
      });
  }, []);

  return null;
}
