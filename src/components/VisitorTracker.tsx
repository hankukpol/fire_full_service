"use client";

import { useEffect } from "react";

const ANON_ID_KEY = "fire_visitor_id";
const SESSION_KEY_PREFIX = "visitor_tracked_";

// localStorage에서 익명 UUID를 가져오거나 새로 생성
function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const uuid = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, uuid);
    return uuid;
  } catch {
    // localStorage 접근 불가 시 임시 UUID 반환 (기록 안 됨)
    return crypto.randomUUID();
  }
}

// 로그인/비회원 구분 없이 모든 방문자를 하루 1회 기록하는 컴포넌트.
// 로그인 사용자: 서버 세션의 userId로 기록
// 비회원: localStorage UUID(anonymousId)로 기록
export default function VisitorTracker() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `${SESSION_KEY_PREFIX}${today}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const anonymousId = getOrCreateAnonId();

    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId }),
    })
      .then((res) => {
        if (res.ok) sessionStorage.setItem(sessionKey, "1");
      })
      .catch(() => {
        // 무시
      });
  }, []);

  return null;
}
