"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import useConfirmModal from "@/hooks/useConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  asBoolean,
  asNumber,
  asString,
  normalizeMode,
  normalizeProfile,
  type SettingValue,
  loadSettings,
  saveSettings,
  type SiteSettingsMap,
} from "../_lib/site-settings-client";

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

export default function AdminSiteAutoPassCutTabPage() {
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
          message: error instanceof Error ? error.message : "자동 합격컷 설정을 불러오지 못했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function updateSettingBoolean(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateSettingString(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const ok = await confirm({
      title: "자동 합격컷 설정 저장",
      description: "자동 합격컷 설정을 저장하시겠습니까?",
    });
    if (!ok) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const autoPassCutCheckIntervalSec = Math.floor(
        asNumber(settings["site.autoPassCutCheckIntervalSec"], 300)
      );
      if (!Number.isFinite(autoPassCutCheckIntervalSec) || autoPassCutCheckIntervalSec < 30) {
        throw new Error("합격컷 체크 주기는 30초 이상이어야 합니다.");
      }

      const payload: Record<string, SettingValue> = {
        "site.autoPassCutEnabled": asBoolean(settings["site.autoPassCutEnabled"], false),
        "site.autoPassCutMode": normalizeMode(asString(settings["site.autoPassCutMode"], "HYBRID")),
        "site.autoPassCutCheckIntervalSec": autoPassCutCheckIntervalSec,
        "site.autoPassCutThresholdProfile": normalizeProfile(
          asString(settings["site.autoPassCutThresholdProfile"], "BALANCED")
        ),
        "site.autoPassCutReadyRatioProfile": normalizeProfile(
          asString(settings["site.autoPassCutReadyRatioProfile"], "BALANCED")
        ),
      };

      await saveSettings(payload);
      setSettings(await loadSettings());
      setNotice({ type: "success", message: "자동 합격컷 설정이 저장되었습니다." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "자동 합격컷 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">자동 합격컷 설정을 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">자동 합격컷 설정</h2>
      <p className="text-xs text-slate-500">
        자동 체크 모드/주기/프로파일을 관리합니다. 저장 시 현재 탭의 설정 키만 업데이트됩니다.
      </p>

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
          <Label htmlFor="auto-pass-cut-threshold-profile">참여자수 임계치 프로파일</Label>
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
          <Label htmlFor="auto-pass-cut-ready-ratio-profile">준비비율 임계치 프로파일</Label>
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

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "저장 중..." : "자동 합격컷 설정 저장"}
      </Button>

      <ConfirmModal {...modalProps} />
    </section>
  );
}
