import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        priority: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        faqs: faqs.map((item) => ({
          ...item,
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("FAQ 조회 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "FAQ 조회에 실패했습니다." }, { status: 500 });
  }
}
