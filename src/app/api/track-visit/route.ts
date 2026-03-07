import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    // 오늘 날짜 (시간 없이 자정 기준)
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // 하루 1회만 기록 (중복 시 무시)
    await prisma.visitorLog.upsert({
      where: { date_userId: { date: today, userId } },
      create: { date: today, userId },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    // 에러가 나도 사용자 경험에 영향 없도록 조용히 처리
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
