import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface PublicEventItem {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
  bgColor: string;
  isActive: boolean;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_EVENTS_TAG = "active-events";

const getCachedActiveEvents = unstable_cache(
  async (): Promise<PublicEventItem[]> => {
    try {
      const now = new Date();
      const events = await prisma.eventSection.findMany({
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
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      return events.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl,
        linkText: item.linkText,
        bgColor: item.bgColor,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
        startAt: item.startAt ? item.startAt.toISOString() : null,
        endAt: item.endAt ? item.endAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error("활성 이벤트 조회 중 오류가 발생했습니다.", error);
      return [];
    }
  },
  ["events:active"],
  {
    revalidate: 60,
    tags: [ACTIVE_EVENTS_TAG],
  }
);

export async function getActiveEvents(): Promise<PublicEventItem[]> {
  return getCachedActiveEvents();
}

export function revalidateEventsCache() {
  revalidateTag(ACTIVE_EVENTS_TAG, "max");
}
