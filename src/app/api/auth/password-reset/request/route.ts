import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import { createPasswordResetToken } from "@/lib/password-recovery";
import { consumeFixedWindowRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { isValidEmail, normalizeEmail, normalizePhone } from "@/lib/validations";

export const runtime = "nodejs";

const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_LIMIT_PER_IP = 8;
const PASSWORD_RESET_EXPIRE_MINUTES = 15;

interface RequestBody {
  identifier?: unknown;
  email?: unknown;
  phone?: unknown;
}

function buildResetUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3200";
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

function sanitizeIdentifier(body: RequestBody): { email: string | null; phone: string | null } {
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const email = typeof body.email === "string" ? body.email : "";
  const phone = typeof body.phone === "string" ? body.phone : "";

  const normalizedEmail = normalizeEmail(email || identifier);
  const normalizedPhone = normalizePhone(phone || identifier);

  const emailValue = normalizedEmail.length > 0 && isValidEmail(normalizedEmail) ? normalizedEmail : null;
  const phoneValue = /^010-\d{4}-\d{4}$/.test(normalizedPhone) ? normalizedPhone : null;
  return { email: emailValue, phone: phoneValue };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = consumeFixedWindowRateLimit({
    namespace: "password-reset-request-ip",
    key: ip,
    limit: REQUEST_LIMIT_PER_IP,
    windowMs: REQUEST_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      }
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "요청 본문(JSON) 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { email, phone } = sanitizeIdentifier(body);
  if (!email && !phone) {
    return NextResponse.json({ error: "이메일 또는 연락처(010-XXXX-XXXX)를 입력해 주세요." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
    },
  });

  const genericResponse: Record<string, unknown> = {
    success: true,
    message: "입력한 정보와 일치하는 계정이 있으면 비밀번호 재설정 안내를 전송했습니다.",
  };

  if (!user || !user.email) {
    return NextResponse.json(genericResponse);
  }

  const { token, tokenHash, expiresAt } = createPasswordResetToken(PASSWORD_RESET_EXPIRE_MINUTES);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestedIp: ip,
        requestedAgent: request.headers.get("user-agent"),
      },
    });
  });

  const resetUrl = buildResetUrl(token);
  const mailResult = await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
    expiresMinutes: PASSWORD_RESET_EXPIRE_MINUTES,
  });

  if (!mailResult.sent) {
    if (process.env.NODE_ENV !== "production" || process.env.PASSWORD_RESET_DEBUG_LINK === "true") {
      genericResponse.debugResetUrl = resetUrl;
      genericResponse.delivery = "debug";
    } else {
      genericResponse.delivery = "unavailable";
    }
  } else {
    genericResponse.delivery = "sent";
  }

  return NextResponse.json(genericResponse);
}
