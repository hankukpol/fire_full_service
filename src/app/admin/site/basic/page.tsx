"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import useConfirmModal from "@/hooks/useConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  asString,
  type SettingValue,
  loadSettings,
  saveSettings,
  type SiteSettingsMap,
} from "../_lib/site-settings-client";

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

export default function AdminSiteBasicTabPage() {
  const [settings, setSettings] = useState<SiteSettingsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const { confirm, modalProps } = useConfirmModal();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        setSettings(await loadSettings());
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "기본 설정을 불러오지 못했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function updateSettingString(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const ok = await confirm({
      title: "기본 설정 저장",
      description: "기본 설정을 저장하시겠습니까?",
    });
    if (!ok) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const payload: Record<string, SettingValue> = {
        "site.title": asString(settings["site.title"]),
        "site.heroBadge": asString(settings["site.heroBadge"]),
        "site.heroTitle": asString(settings["site.heroTitle"]),
        "site.heroSubtitle": asString(settings["site.heroSubtitle"]),
        "site.footerDisclaimer": asString(settings["site.footerDisclaimer"]),
      };

      await saveSettings(payload);
      setSettings(await loadSettings());
      setNotice({ type: "success", message: "기본 설정이 저장되었습니다." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "기본 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">기본 설정을 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">기본 설정</h2>

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
          className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-fire-300 transition focus:ring"
          value={asString(settings["site.heroTitle"])}
          onChange={(event) => updateSettingString("site.heroTitle", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hero-subtitle">히어로 부제목</Label>
        <textarea
          id="hero-subtitle"
          className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-fire-300 transition focus:ring"
          value={asString(settings["site.heroSubtitle"])}
          onChange={(event) => updateSettingString("site.heroSubtitle", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="footer-disclaimer">푸터 면책 문구</Label>
        <textarea
          id="footer-disclaimer"
          className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-fire-300 transition focus:ring"
          value={asString(settings["site.footerDisclaimer"])}
          onChange={(event) => updateSettingString("site.footerDisclaimer", event.target.value)}
        />
      </div>

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "저장 중..." : "기본 설정 저장"}
      </Button>

      <ConfirmModal {...modalProps} />
    </section>
  );
}
