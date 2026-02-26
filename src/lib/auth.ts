import "server-only";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindowRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { normalizePhone } from "@/lib/validations";

const INSECURE_SECRETS = new Set([
  "change-this-to-a-long-random-string",
  "secret",
  "nextauth-secret",
  "",
]);

const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "";
const isProduction = process.env.NODE_ENV === "production";
const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (!nextAuthSecret || INSECURE_SECRETS.has(nextAuthSecret)) {
  if (isProduction && !isNextBuildPhase) {
    throw new Error(
      "[auth] NEXTAUTH_SECRET이 설정되지 않았거나 기본값입니다. " +
        "프로덕션 환경에서는 반드시 안전한 랜덤 문자열로 변경해 주세요."
    );
  }
  console.warn(
    "[auth] 경고: NEXTAUTH_SECRET이 기본값입니다. 프로덕션 배포 전 반드시 변경하세요."
  );
}

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_IP_WINDOW_MS = 60 * 1000;
const LOGIN_IP_LIMIT = 20;

type LoginFailureRecord = {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil: number;
};

const loginFailuresByPhone = new Map<string, LoginFailureRecord>();

function cleanupExpiredLoginFailures(now: number) {
  for (const [phone, record] of loginFailuresByPhone.entries()) {
    const isWindowExpired = now - record.firstFailedAt > LOGIN_FAILURE_WINDOW_MS;
    const isLockExpired = record.lockedUntil > 0 && record.lockedUntil <= now;

    if (isWindowExpired || isLockExpired) {
      loginFailuresByPhone.delete(phone);
    }
  }
}

function getPhoneLockSeconds(phone: string): number {
  const now = Date.now();
  cleanupExpiredLoginFailures(now);

  const record = loginFailuresByPhone.get(phone);
  if (!record || record.lockedUntil <= now) {
    return 0;
  }

  return Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
}

function recordLoginFailure(phone: string) {
  const now = Date.now();
  cleanupExpiredLoginFailures(now);

  const current = loginFailuresByPhone.get(phone);
  if (!current) {
    loginFailuresByPhone.set(phone, {
      failedCount: 1,
      firstFailedAt: now,
      lockedUntil: 0,
    });
    return;
  }

  if (current.lockedUntil > now) {
    return;
  }

  if (now - current.firstFailedAt > LOGIN_FAILURE_WINDOW_MS) {
    current.failedCount = 1;
    current.firstFailedAt = now;
    current.lockedUntil = 0;
    loginFailuresByPhone.set(phone, current);
    return;
  }

  current.failedCount += 1;
  if (current.failedCount >= LOGIN_FAILURE_LIMIT) {
    current.lockedUntil = now + LOGIN_FAILURE_WINDOW_MS;
    current.failedCount = 0;
    current.firstFailedAt = now;
  }

  loginFailuresByPhone.set(phone, current);
}

function clearLoginFailures(phone: string) {
  loginFailuresByPhone.delete(phone);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "연락처 로그인",
      credentials: {
        phone: {
          label: "연락처",
          type: "text",
          placeholder: "010-1234-5678",
        },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials, request) {
        const phone = normalizePhone(credentials?.phone ?? "");
        const password = credentials?.password?.trim();
        const clientIp = getClientIp(request);

        const ipRateLimit = consumeFixedWindowRateLimit({
          namespace: "auth-login-ip",
          key: clientIp,
          limit: LOGIN_IP_LIMIT,
          windowMs: LOGIN_IP_WINDOW_MS,
        });
        if (!ipRateLimit.allowed) {
          return null;
        }

        if (!phone || !password) {
          return null;
        }

        const lockSeconds = getPhoneLockSeconds(phone);
        if (lockSeconds > 0) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { phone },
        });

        if (!user) {
          recordLoginFailure(phone);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          recordLoginFailure(phone);
          return null;
        }

        clearLoginFailures(phone);

        return {
          id: String(user.id),
          name: user.name,
          phone: user.phone,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.phone = (user as { phone: string }).phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.phone = typeof token.phone === "string" ? token.phone : "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
