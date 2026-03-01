"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import useConfirmModal from "@/hooks/useConfirmModal";
import { Button } from "@/components/ui/button";
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

export default function AdminSitePoliciesTabPage() {
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
          message: error instanceof Error ? error.message : "약관 설정을 불러오지 못했습니다.",
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
      title: "약관 저장",
      description: "이용 약관/개인정보 처리방침을 저장하시겠습니까?",
    });
    if (!ok) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const payload: Record<string, SettingValue> = {
        "site.termsOfService": asString(settings["site.termsOfService"]),
        "site.privacyPolicy": asString(settings["site.privacyPolicy"]),
      };

      await saveSettings(payload);
      setSettings(await loadSettings());
      setNotice({ type: "success", message: "약관 설정이 저장되었습니다." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "약관 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">약관 설정을 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">약관 관리</h2>

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
        <Label htmlFor="terms-of-service">이용약관</Label>
        <textarea
          id="terms-of-service"
          className="min-h-56 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-fire-300 transition focus:ring"
          value={asString(settings["site.termsOfService"])}
          onChange={(event) => updateSettingString("site.termsOfService", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="privacy-policy">개인정보 처리방침</Label>
        <textarea
          id="privacy-policy"
          className="min-h-56 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-fire-300 transition focus:ring"
          value={asString(settings["site.privacyPolicy"])}
          onChange={(event) => updateSettingString("site.privacyPolicy", event.target.value)}
        />
      </div>

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "저장 중..." : "약관 설정 저장"}
      </Button>

      <ConfirmModal {...modalProps} />
    </section>
  );
}
