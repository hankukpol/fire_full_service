"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import useConfirmModal from "@/hooks/useConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  asBoolean,
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

export default function AdminSiteVisibilityTabPage() {
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
          message: error instanceof Error ? error.message : "메뉴 공개 설정을 불러오지 못했습니다.",
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
      title: "메뉴 공개 설정 저장",
      description: "메뉴 공개 설정을 저장하시겠습니까?",
    });
    if (!ok) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const tabLockedMessage = asString(
        settings["site.tabLockedMessage"],
        "시험 후 오픈 예정입니다"
      ).trim();
      if (!tabLockedMessage) {
        throw new Error("잠금 안내 메시지를 입력해 주세요.");
      }

      const payload: Record<string, SettingValue> = {
        "site.tabMainEnabled": asBoolean(settings["site.tabMainEnabled"], true),
        "site.tabInputEnabled": asBoolean(settings["site.tabInputEnabled"], true),
        "site.tabResultEnabled": asBoolean(settings["site.tabResultEnabled"], true),
        "site.finalPredictionEnabled": asBoolean(settings["site.finalPredictionEnabled"], false),
        "site.tabPredictionEnabled": asBoolean(settings["site.tabPredictionEnabled"], true),
        "site.commentsEnabled": asBoolean(settings["site.commentsEnabled"], true),
        "site.tabNoticesEnabled": asBoolean(settings["site.tabNoticesEnabled"], true),
        "site.tabFaqEnabled": asBoolean(settings["site.tabFaqEnabled"], true),
        "site.tabLockedMessage": tabLockedMessage,
      };

      await saveSettings(payload);
      setSettings(await loadSettings());
      setNotice({ type: "success", message: "메뉴 공개 설정이 저장되었습니다." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "메뉴 공개 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">메뉴 공개 설정을 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">메뉴 공개 설정</h2>
      <p className="text-xs text-slate-500">
        비활성화된 메뉴는 사용자 화면에서 잠금 메시지로 대체됩니다.
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.tabMainEnabled"], true)}
              onChange={(event) => updateSettingBoolean("site.tabMainEnabled", event.target.checked)}
            />
            메인 탭
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.tabInputEnabled"], true)}
              onChange={(event) => updateSettingBoolean("site.tabInputEnabled", event.target.checked)}
            />
            입력 탭
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.tabResultEnabled"], true)}
              onChange={(event) => updateSettingBoolean("site.tabResultEnabled", event.target.checked)}
            />
            결과 탭
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.finalPredictionEnabled"], false)}
              onChange={(event) =>
                updateSettingBoolean("site.finalPredictionEnabled", event.target.checked)
              }
            />
            최종 환산 예측
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.tabPredictionEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.tabPredictionEnabled", event.target.checked)
              }
            />
            합격 예측 정보
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.commentsEnabled"], true)}
              onChange={(event) => updateSettingBoolean("site.commentsEnabled", event.target.checked)}
            />
            실시간 댓글
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.tabNoticesEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.tabNoticesEnabled", event.target.checked)
              }
            />
            공지사항 탭
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.tabFaqEnabled"], true)}
              onChange={(event) => updateSettingBoolean("site.tabFaqEnabled", event.target.checked)}
            />
            FAQ 탭
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              updateSettingBoolean("site.tabMainEnabled", true);
              updateSettingBoolean("site.tabInputEnabled", true);
              updateSettingBoolean("site.tabResultEnabled", true);
              updateSettingBoolean("site.finalPredictionEnabled", true);
              updateSettingBoolean("site.tabPredictionEnabled", true);
              updateSettingBoolean("site.commentsEnabled", true);
              updateSettingBoolean("site.tabNoticesEnabled", true);
              updateSettingBoolean("site.tabFaqEnabled", true);
            }}
          >
            전체 활성화
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              updateSettingBoolean("site.tabMainEnabled", false);
              updateSettingBoolean("site.tabInputEnabled", false);
              updateSettingBoolean("site.tabResultEnabled", false);
              updateSettingBoolean("site.finalPredictionEnabled", false);
              updateSettingBoolean("site.tabPredictionEnabled", false);
              updateSettingBoolean("site.commentsEnabled", false);
              updateSettingBoolean("site.tabNoticesEnabled", false);
              updateSettingBoolean("site.tabFaqEnabled", false);
            }}
          >
            전체 비활성화
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tab-locked-message">잠금 안내 메시지</Label>
        <Input
          id="tab-locked-message"
          value={asString(settings["site.tabLockedMessage"], "시험 후 오픈 예정입니다")}
          onChange={(event) => updateSettingString("site.tabLockedMessage", event.target.value)}
          placeholder="시험 후 오픈 예정입니다"
        />
        <p className="text-xs text-slate-500">
          비활성 메뉴 클릭 시 표시되는 공통 안내 메시지입니다.
        </p>
      </div>

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "저장 중..." : "메뉴 공개 설정 저장"}
      </Button>

      <ConfirmModal {...modalProps} />
    </section>
  );
}
