"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import useConfirmModal from "@/hooks/useConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE_SETTING_DEFAULTS } from "@/lib/site-settings.constants";

type SettingValue = string | boolean | number | null;

interface SiteSettingsResponse {
  settings: Record<string, SettingValue>;
}

interface NoticeItem {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NoticesResponse {
  notices: NoticeItem[];
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

function toDateTimeLocalInput(isoText: string | null): string {
  if (!isoText) return "";
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toDateRangeText(startAt: string | null, endAt: string | null): string {
  const format = (value: string | null) => {
    if (!value) return "상시";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Always";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  return `${format(startAt)} ~ ${format(endAt)}`;
}

function asNumber(value: SettingValue, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function asString(value: SettingValue, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: SettingValue, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeMode(value: string): "HYBRID" | "TRAFFIC_ONLY" | "CRON_ONLY" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRAFFIC_ONLY") return "TRAFFIC_ONLY";
  if (normalized === "CRON_ONLY") return "CRON_ONLY";
  return "HYBRID";
}

function normalizeProfile(value: string): "BALANCED" | "CONSERVATIVE" | "AGGRESSIVE" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "CONSERVATIVE") return "CONSERVATIVE";
  if (normalized === "AGGRESSIVE") return "AGGRESSIVE";
  return "BALANCED";
}

export default function AdminSitePage() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({
    ...SITE_SETTING_DEFAULTS,
  });
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const { confirm, modalProps } = useConfirmModal();

  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeIsActive, setNoticeIsActive] = useState(true);
  const [noticePriority, setNoticePriority] = useState(0);
  const [noticeStartAt, setNoticeStartAt] = useState("");
  const [noticeEndAt, setNoticeEndAt] = useState("");
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  const sortedNotices = useMemo(() => {
    return [...notices].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.id - a.id;
    });
  }, [notices]);

  async function loadSettings() {
    const response = await fetch("/api/admin/site", { method: "GET", cache: "no-store" });
    const data = (await response.json()) as SiteSettingsResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "사이트 설정을 불러오지 못했습니다.");
    }
    setSettings((prev) => ({ ...prev, ...data.settings }));
  }

  async function loadNotices() {
    const response = await fetch("/api/admin/notices", { method: "GET", cache: "no-store" });
    const data = (await response.json()) as NoticesResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "공지사항을 불러오지 못했습니다.");
    }
    setNotices(data.notices ?? []);
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        await Promise.all([loadSettings(), loadNotices()]);
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "관리자 페이지 초기화에 실패했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function updateSettingString(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateSettingBoolean(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(payload: Record<string, SettingValue>, successMessage: string) {
    const response = await fetch("/api/admin/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: payload }),
    });
    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "설정 저장에 실패했습니다.");
    }
    setNotice({ type: "success", message: successMessage });
  }

  async function handleSaveBasicSettings() {
    const ok = await confirm({ title: "기본 설정 저장", description: "기본 설정을 저장하시겠습니까?" });
    if (!ok) return;

    setIsSavingBasic(true);
    setNotice(null);
    try {
      await saveSettings(
        {
          "site.title": asString(settings["site.title"]),
          "site.heroBadge": asString(settings["site.heroBadge"]),
          "site.heroTitle": asString(settings["site.heroTitle"]),
          "site.heroSubtitle": asString(settings["site.heroSubtitle"]),
          "site.footerDisclaimer": asString(settings["site.footerDisclaimer"]),
        },
        "기본 설정이 저장되었습니다."
      );
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "기본 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingBasic(false);
    }
  }

  async function handleSaveSystemSettings() {
    const ok = await confirm({ title: "시스템 설정 저장", description: "시스템 설정을 저장하시겠습니까?" });
    if (!ok) return;

    setIsSavingSystem(true);
    setNotice(null);
    try {
      const refreshInterval = Math.floor(asNumber(settings["site.mainPageRefreshInterval"], 60));
      if (!Number.isFinite(refreshInterval) || refreshInterval < 10) {
        throw new Error("새로고침 주기는 10초 이상이어야 합니다.");
      }

      const submissionEditLimit = Math.floor(asNumber(settings["site.submissionEditLimit"], 3));
      if (!Number.isFinite(submissionEditLimit) || submissionEditLimit < 0) {
        throw new Error("수정 횟수 제한은 0 이상이어야 합니다.");
      }

      const autoPassCutCheckIntervalSec = Math.floor(
        asNumber(settings["site.autoPassCutCheckIntervalSec"], 300)
      );
      if (!Number.isFinite(autoPassCutCheckIntervalSec) || autoPassCutCheckIntervalSec < 30) {
        throw new Error("합격컷 체크 주기는 30초 이상이어야 합니다.");
      }

      const autoPassCutMode = normalizeMode(asString(settings["site.autoPassCutMode"], "HYBRID"));
      const autoPassCutThresholdProfile = normalizeProfile(
        asString(settings["site.autoPassCutThresholdProfile"], "BALANCED")
      );
      const autoPassCutReadyRatioProfile = normalizeProfile(
        asString(settings["site.autoPassCutReadyRatioProfile"], "BALANCED")
      );

      await saveSettings(
        {
          "site.commentsEnabled": asBoolean(settings["site.commentsEnabled"], true),
          "site.careerExamEnabled": asBoolean(settings["site.careerExamEnabled"], true),
          "site.maintenanceMode": asBoolean(settings["site.maintenanceMode"], false),
          "site.maintenanceMessage": asString(settings["site.maintenanceMessage"]),
          "site.mainPageAutoRefresh": asBoolean(settings["site.mainPageAutoRefresh"], true),
          "site.mainPageRefreshInterval": String(refreshInterval),
          "site.mainCardOverviewEnabled": asBoolean(settings["site.mainCardOverviewEnabled"], true),
          "site.mainCardDifficultyEnabled": asBoolean(
            settings["site.mainCardDifficultyEnabled"],
            true
          ),
          "site.mainCardCompetitiveEnabled": asBoolean(
            settings["site.mainCardCompetitiveEnabled"],
            true
          ),
          "site.mainCardScoreDistributionEnabled": asBoolean(
            settings["site.mainCardScoreDistributionEnabled"],
            true
          ),
          "site.submissionEditLimit": submissionEditLimit,
          "site.finalPredictionEnabled": asBoolean(settings["site.finalPredictionEnabled"], false),
          "site.autoPassCutEnabled": asBoolean(settings["site.autoPassCutEnabled"], false),
          "site.autoPassCutMode": autoPassCutMode,
          "site.autoPassCutCheckIntervalSec": autoPassCutCheckIntervalSec,
          "site.autoPassCutThresholdProfile": autoPassCutThresholdProfile,
          "site.autoPassCutReadyRatioProfile": autoPassCutReadyRatioProfile,
        },
        "시스템 설정이 저장되었습니다."
      );
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "시스템 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingSystem(false);
    }
  }

  function resetNoticeForm() {
    setEditingNoticeId(null);
    setNoticeTitle("");
    setNoticeContent("");
    setNoticeIsActive(true);
    setNoticePriority(0);
    setNoticeStartAt("");
    setNoticeEndAt("");
  }

  function startEditNotice(item: NoticeItem) {
    setEditingNoticeId(item.id);
    setNoticeTitle(item.title);
    setNoticeContent(item.content);
    setNoticeIsActive(item.isActive);
    setNoticePriority(item.priority);
    setNoticeStartAt(toDateTimeLocalInput(item.startAt));
    setNoticeEndAt(toDateTimeLocalInput(item.endAt));
  }

  async function handleSubmitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    try {
      if (!noticeTitle.trim()) {
        throw new Error("공지 제목을 입력해 주세요.");
      }
      if (!noticeContent.trim()) {
        throw new Error("공지 내용을 입력해 주세요.");
      }

      const ok = await confirm({ title: editingNoticeId ? "공지 수정" : "공지 등록", description: editingNoticeId ? "이 공지를 수정하시겠습니까?" : "새 공지를 등록하시겠습니까?" });
      if (!ok) return;

      setIsSavingNotice(true);
      const payload = {
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        isActive: noticeIsActive,
        priority: noticePriority,
        startAt: noticeStartAt ? new Date(noticeStartAt).toISOString() : null,
        endAt: noticeEndAt ? new Date(noticeEndAt).toISOString() : null,
      };

      const endpoint = editingNoticeId
        ? `/api/admin/notices?id=${editingNoticeId}`
        : "/api/admin/notices";
      const method = editingNoticeId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "공지 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: editingNoticeId ? "공지가 수정되었습니다." : "공지가 등록되었습니다.",
      });
      resetNoticeForm();
      await loadNotices();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "공지 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingNotice(false);
    }
  }

  async function handleDeleteNotice(id: number) {
    const ok = await confirm({ title: "공지 삭제", description: "이 공지를 삭제하시겠습니까?", variant: "danger" });
    if (!ok) return;

    setNotice(null);
    try {
      const response = await fetch(`/api/admin/notices?id=${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "공지 삭제에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: "공지가 삭제되었습니다.",
      });
      if (editingNoticeId === id) {
        resetNoticeForm();
      }
      await loadNotices();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "공지 삭제에 실패했습니다.",
      });
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">사이트 설정을 불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">사이트 설정</h1>
        <p className="mt-1 text-sm text-slate-600">
          사이트 문구, 공지사항, 시스템 설정, 자동 합격컷 발표를 관리합니다.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          배너 이미지는{" "}
          <Link href="/admin/banners" className="font-semibold text-slate-800 underline">
            배너 관리
          </Link>
          에서 관리합니다.
        </p>
      </header>

      {notice ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            notice.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">기본 설정</h2>

        <div className="space-y-2">
          <Label htmlFor="site-title">사이트 제목</Label>
          <Input
            id="site-title"
            value={asString(settings["site.title"])}
            onChange={(event) => updateSettingString("site.title", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-badge">히어로 배지</Label>
          <Input
            id="hero-badge"
            value={asString(settings["site.heroBadge"])}
            onChange={(event) => updateSettingString("site.heroBadge", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-title">히어로 제목</Label>
          <textarea
            id="hero-title"
            value={asString(settings["site.heroTitle"])}
            onChange={(event) => updateSettingString("site.heroTitle", event.target.value)}
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-subtitle">히어로 부제목</Label>
          <textarea
            id="hero-subtitle"
            value={asString(settings["site.heroSubtitle"])}
            onChange={(event) => updateSettingString("site.heroSubtitle", event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer-disclaimer">하단 면책조항</Label>
          <textarea
            id="footer-disclaimer"
            value={asString(settings["site.footerDisclaimer"])}
            onChange={(event) => updateSettingString("site.footerDisclaimer", event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <Button type="button" onClick={handleSaveBasicSettings} disabled={isSavingBasic}>
          {isSavingBasic ? "저장 중..." : "기본 설정 저장"}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">공지사항 관리</h2>
          <Button type="button" variant="outline" onClick={resetNoticeForm}>
            + 새 공지
          </Button>
        </div>

        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={handleSubmitNotice}
        >
          <div className="space-y-2">
            <Label htmlFor="notice-title">제목</Label>
            <Input
              id="notice-title"
              value={noticeTitle}
              onChange={(event) => setNoticeTitle(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-content">내용</Label>
            <textarea
              id="notice-content"
              value={noticeContent}
              onChange={(event) => setNoticeContent(event.target.value)}
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="notice-priority">우선순위</Label>
              <Input
                id="notice-priority"
                type="number"
                value={noticePriority}
                onChange={(event) => setNoticePriority(Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-start">시작일</Label>
              <Input
                id="notice-start"
                type="datetime-local"
                value={noticeStartAt}
                onChange={(event) => setNoticeStartAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-end">종료일</Label>
              <Input
                id="notice-end"
                type="datetime-local"
                value={noticeEndAt}
                onChange={(event) => setNoticeEndAt(event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={noticeIsActive}
              onChange={(event) => setNoticeIsActive(event.target.checked)}
            />
            활성화
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSavingNotice}>
              {isSavingNotice ? "저장 중..." : editingNoticeId ? "공지 수정" : "공지 등록"}
            </Button>
            {editingNoticeId ? (
              <Button type="button" variant="outline" onClick={resetNoticeForm} disabled={isSavingNotice}>
                입력 초기화
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">노출 기간</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedNotices.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>
                    등록된 공지사항이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedNotices.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-4 py-3 text-slate-700">{item.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-600">{item.content}</p>
                    </td>
                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {toDateRangeText(item.startAt, item.endAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEditNotice(item)}>
                          수정
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => void handleDeleteNotice(item.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">시스템 설정</h2>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.careerExamEnabled"], true)}
            onChange={(event) => updateSettingBoolean("site.careerExamEnabled", event.target.checked)}
          />
          경채 시험 활성화 (구조, 소방학과, 구급 경채)
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.commentsEnabled"], true)}
            onChange={(event) => updateSettingBoolean("site.commentsEnabled", event.target.checked)}
          />
          실시간 댓글 활성화
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.maintenanceMode"], false)}
            onChange={(event) => updateSettingBoolean("site.maintenanceMode", event.target.checked)}
          />
          점검 모드 (사이트 접근 차단)
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.mainPageAutoRefresh"], true)}
            onChange={(event) => updateSettingBoolean("site.mainPageAutoRefresh", event.target.checked)}
          />
          메인 페이지 자동 새로고침
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.finalPredictionEnabled"], false)}
            onChange={(event) => updateSettingBoolean("site.finalPredictionEnabled", event.target.checked)}
          />
          최종 환산 예측 공개
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">자동 합격컷 발표</p>
          <p className="mt-1 text-xs text-slate-500">
            HYBRID: 크론 + 트래픽 진입 시 자동 체크 / TRAFFIC_ONLY: 트래픽 진입 시만 / CRON_ONLY: 크론만
          </p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.autoPassCutEnabled"], false)}
                onChange={(event) => updateSettingBoolean("site.autoPassCutEnabled", event.target.checked)}
              />
              자동 발표 활성화
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-mode">동작 모드</Label>
                <select
                  id="auto-pass-cut-mode"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={asString(settings["site.autoPassCutMode"], "HYBRID")}
                  onChange={(event) => updateSettingString("site.autoPassCutMode", event.target.value)}
                >
                  <option value="HYBRID">HYBRID</option>
                  <option value="TRAFFIC_ONLY">TRAFFIC_ONLY</option>
                  <option value="CRON_ONLY">CRON_ONLY</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-interval">체크 주기 (초)</Label>
                <Input
                  id="auto-pass-cut-interval"
                  type="number"
                  min={30}
                  value={String(asNumber(settings["site.autoPassCutCheckIntervalSec"], 300))}
                  onChange={(event) =>
                    updateSettingString("site.autoPassCutCheckIntervalSec", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-threshold-profile">참여자 수 기준</Label>
                <select
                  id="auto-pass-cut-threshold-profile"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={asString(settings["site.autoPassCutThresholdProfile"], "BALANCED")}
                  onChange={(event) =>
                    updateSettingString("site.autoPassCutThresholdProfile", event.target.value)
                  }
                >
                  <option value="BALANCED">BALANCED</option>
                  <option value="CONSERVATIVE">CONSERVATIVE</option>
                  <option value="AGGRESSIVE">AGGRESSIVE</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-ready-ratio-profile">준비 비율 기준</Label>
                <select
                  id="auto-pass-cut-ready-ratio-profile"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={asString(settings["site.autoPassCutReadyRatioProfile"], "BALANCED")}
                  onChange={(event) =>
                    updateSettingString("site.autoPassCutReadyRatioProfile", event.target.value)
                  }
                >
                  <option value="BALANCED">BALANCED</option>
                  <option value="CONSERVATIVE">CONSERVATIVE</option>
                  <option value="AGGRESSIVE">AGGRESSIVE</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">메인 카드 표시 설정</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardOverviewEnabled"], true)}
                onChange={(event) => updateSettingBoolean("site.mainCardOverviewEnabled", event.target.checked)}
              />
              참여 현황 카드
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardDifficultyEnabled"], true)}
                onChange={(event) =>
                  updateSettingBoolean("site.mainCardDifficultyEnabled", event.target.checked)
                }
              />
              체감 난이도 카드
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardCompetitiveEnabled"], true)}
                onChange={(event) =>
                  updateSettingBoolean("site.mainCardCompetitiveEnabled", event.target.checked)
                }
              />
              경쟁률 TOP5 카드
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardScoreDistributionEnabled"], true)}
                onChange={(event) =>
                  updateSettingBoolean("site.mainCardScoreDistributionEnabled", event.target.checked)
                }
              />
              점수 분포 카드
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="main-refresh-interval">메인 페이지 새로고침 주기 (초)</Label>
          <Input
            id="main-refresh-interval"
            type="number"
            min={10}
            value={String(asString(settings["site.mainPageRefreshInterval"], "60"))}
            onChange={(event) => updateSettingString("site.mainPageRefreshInterval", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="submission-edit-limit">답안 수정 횟수 제한 (0 = 수정 불가)</Label>
          <Input
            id="submission-edit-limit"
            type="number"
            min={0}
            value={String(asNumber(settings["site.submissionEditLimit"], 3))}
            onChange={(event) => updateSettingString("site.submissionEditLimit", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance-message">점검 안내 메시지</Label>
          <Input
            id="maintenance-message"
            value={asString(settings["site.maintenanceMessage"])}
            onChange={(event) => updateSettingString("site.maintenanceMessage", event.target.value)}
          />
        </div>

        <Button type="button" onClick={handleSaveSystemSettings} disabled={isSavingSystem}>
          {isSavingSystem ? "저장 중..." : "시스템 설정 저장"}
        </Button>
      </section>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
