import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  SITE_SETTING_DEFAULTS,
  SITE_SETTING_TYPES,
  type SiteSettingKey,
  type SiteSettingsMap,
} from "@/lib/site-settings.constants";

export interface PublicNoticeItem {
  id: number;
  title: string;
  content: string;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SITE_SETTINGS_TAG = "site-settings";
const ACTIVE_NOTICES_TAG = "active-notices";

function isSiteSettingKey(key: string): key is SiteSettingKey {
  return key in SITE_SETTING_TYPES;
}

export function isAllowedSiteSettingKey(key: string): key is SiteSettingKey {
  return isSiteSettingKey(key);
}

function parseBooleanValue(raw: string): boolean {
  return raw.trim().toLowerCase() === "true";
}

function parseStoredSiteSettingValue(key: SiteSettingKey, raw: string): string | boolean | number | null {
  const type = SITE_SETTING_TYPES[key];

  if (type === "boolean") {
    return parseBooleanValue(raw);
  }

  if (type === "number") {
    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
  }

  if (type === "nullable-string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return raw;
}

function serializeSiteSettingValue(
  key: SiteSettingKey,
  value: string | boolean | number | null
): { value?: string; error?: string } {
  const type = SITE_SETTING_TYPES[key];

  if (type === "boolean") {
    if (typeof value !== "boolean") {
      return { error: `${key} 값은 true/false 형식이어야 합니다.` };
    }

    return { value: value ? "true" : "false" };
  }

  if (type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { error: `${key} 값은 숫자여야 합니다.` };
    }
    return { value: String(value) };
  }

  if (type === "nullable-string") {
    if (value !== null && typeof value !== "string") {
      return { error: `${key} 값은 문자열 또는 null 이어야 합니다.` };
    }

    const normalized = typeof value === "string" ? value.trim() : "";

    if ((key === "site.bannerImageUrl" || key === "site.bannerLink") && normalized) {
      const isRelativePath = normalized.startsWith("/");
      let isAbsoluteUrl = false;

      try {
        const parsed = new URL(normalized);
        isAbsoluteUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        isAbsoluteUrl = false;
      }

      if (!isRelativePath && !isAbsoluteUrl) {
        return { error: `${key} 값은 유효한 URL이어야 합니다.` };
      }
    }

    return { value: normalized };
  }

  if (typeof value !== "string") {
    return { error: `${key} 값은 문자열이어야 합니다.` };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { error: `${key} 값은 비워둘 수 없습니다.` };
  }

  return { value: normalized };
}

async function readSiteSettingsFromDb(): Promise<SiteSettingsMap> {
  const merged: SiteSettingsMap = { ...SITE_SETTING_DEFAULTS };

  try {
    const rows = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: Object.keys(SITE_SETTING_TYPES),
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    for (const row of rows) {
      if (!isSiteSettingKey(row.key)) {
        continue;
      }

      merged[row.key] = parseStoredSiteSettingValue(row.key, row.value);
    }
  } catch (error) {
    console.error("사이트 설정 캐시 조회 중 오류가 발생했습니다.", error);
  }

  return merged;
}

const getCachedSiteSettings = unstable_cache(
  async (): Promise<SiteSettingsMap> => readSiteSettingsFromDb(),
  ["site-settings:all"],
  {
    revalidate: 60,
    tags: [SITE_SETTINGS_TAG],
  }
);

const getCachedActiveNotices = unstable_cache(
  async (): Promise<PublicNoticeItem[]> => {
    try {
      const now = new Date();

      const notices = await prisma.notice.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [{ startAt: null }, { startAt: { lte: now } }],
            },
            {
              OR: [{ endAt: null }, { endAt: { gte: now } }],
            },
          ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          title: true,
          content: true,
          priority: true,
          startAt: true,
          endAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        priority: notice.priority,
        startAt: notice.startAt ? notice.startAt.toISOString() : null,
        endAt: notice.endAt ? notice.endAt.toISOString() : null,
        createdAt: notice.createdAt.toISOString(),
        updatedAt: notice.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error("공지 캐시 조회 중 오류가 발생했습니다.", error);
      return [];
    }
  },
  ["notices:active"],
  {
    revalidate: 60,
    tags: [ACTIVE_NOTICES_TAG],
  }
);

export async function getSiteSettings(): Promise<SiteSettingsMap> {
  return getCachedSiteSettings();
}

export async function getSiteSettingsUncached(): Promise<SiteSettingsMap> {
  return readSiteSettingsFromDb();
}

export async function getActiveNotices(): Promise<PublicNoticeItem[]> {
  return getCachedActiveNotices();
}

export function normalizeSiteSettingUpdateEntries(input: Record<string, unknown>): {
  data?: Array<{ key: SiteSettingKey; value: string }>;
  error?: string;
} {
  const entries = Object.entries(input);
  if (entries.length === 0) {
    return { error: "변경할 설정 값이 없습니다." };
  }

  const normalized: Array<{ key: SiteSettingKey; value: string }> = [];

  for (const [rawKey, rawValue] of entries) {
    if (!isSiteSettingKey(rawKey)) {
      return { error: `지원하지 않는 설정 키입니다: ${rawKey}` };
    }

    const serialized = serializeSiteSettingValue(rawKey, rawValue as string | boolean | number | null);
    if (serialized.error || serialized.value === undefined) {
      return { error: serialized.error ?? `${rawKey} 값이 올바르지 않습니다.` };
    }

    normalized.push({ key: rawKey, value: serialized.value });
  }

  return { data: normalized };
}

export async function upsertSiteSettings(entries: Array<{ key: SiteSettingKey; value: string }>) {
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.siteSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: { key: entry.key, value: entry.value },
      })
    )
  );

  revalidateTag(SITE_SETTINGS_TAG, "max");
}

export function revalidateSiteSettingsCache() {
  revalidateTag(SITE_SETTINGS_TAG, "max");
}

export function revalidateNoticeCache() {
  revalidateTag(ACTIVE_NOTICES_TAG, "max");
}
