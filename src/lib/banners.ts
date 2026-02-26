import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sanitizeBannerHtml } from "@/lib/sanitize-banner-html";

export const BANNER_ZONES = ["hero", "middle", "bottom"] as const;
export type BannerZone = (typeof BANNER_ZONES)[number];

export interface PublicBannerItem {
  id: number;
  zone: BannerZone;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  altText: string;
  htmlContent: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_BANNERS_TAG = "active-banners";

export function isBannerZone(value: string): value is BannerZone {
  return (BANNER_ZONES as readonly string[]).includes(value);
}

async function fetchActiveBannersFromDb(): Promise<PublicBannerItem[]> {
  const banners = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ zone: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  return banners
    .filter((banner) => isBannerZone(banner.zone))
    .map((banner) => ({
      id: banner.id,
      zone: banner.zone as BannerZone,
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl,
      linkUrl: banner.linkUrl,
      altText: banner.altText,
      htmlContent: banner.htmlContent ? sanitizeBannerHtml(banner.htmlContent) : null,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
      createdAt: banner.createdAt.toISOString(),
      updatedAt: banner.updatedAt.toISOString(),
    }));
}

const getCachedActiveBanners = unstable_cache(
  fetchActiveBannersFromDb,
  ["banners:active"],
  {
    revalidate: 60,
    tags: [ACTIVE_BANNERS_TAG],
  }
);

export async function getActiveBanners(): Promise<PublicBannerItem[]> {
  try {
    return await getCachedActiveBanners();
  } catch (error) {
    console.error("활성 배너 캐시 조회 중 오류가 발생해 DB 직접 조회를 시도합니다.", error);
    return fetchActiveBannersFromDb();
  }
}

export function getPrimaryBannerByZone(banners: PublicBannerItem[]) {
  const grouped: Record<BannerZone, PublicBannerItem | null> = {
    hero: null,
    middle: null,
    bottom: null,
  };

  for (const banner of banners) {
    if (!grouped[banner.zone]) {
      grouped[banner.zone] = banner;
    }
  }

  return grouped;
}

export function groupBannersByZone(banners: PublicBannerItem[]) {
  const grouped: Record<BannerZone, PublicBannerItem[]> = {
    hero: [],
    middle: [],
    bottom: [],
  };

  for (const banner of banners) {
    grouped[banner.zone].push(banner);
  }

  return grouped;
}

export function revalidateBannerCache() {
  revalidateTag(ACTIVE_BANNERS_TAG, "max");
}
