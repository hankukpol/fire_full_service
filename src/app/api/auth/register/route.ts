import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/password-recovery";
import { prisma } from "@/lib/prisma";
import { validateRegisterInput } from "@/lib/validations";

export const runtime = "nodejs";

interface RegisterRequestBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  agreedToTerms?: unknown;
  agreedToPrivacy?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequestBody;
    const validationResult = validateRegisterInput({
      name: typeof body.name === "string" ? body.name : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      agreedToTerms: body.agreedToTerms === true,
      agreedToPrivacy: body.agreedToPrivacy === true,
    });

    if (!validationResult.isValid || !validationResult.data) {
      return NextResponse.json(
        { error: validationResult.errors[0], errors: validationResult.errors },
        { status: 400 }
      );
    }

    const { name, email, phone, password } = validationResult.data;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          ...(email ? [{ email }] : []),
        ],
      },
      select: { phone: true, email: true },
    });
    if (existingUser) {
      if (existingUser.phone === phone) {
        return NextResponse.json({ error: "이미 등록된 연락처입니다." }, { status: 409 });
      }

      if (email && existingUser.email === email) {
        return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const recoveryCodes = generateRecoveryCodes(8);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          termsAgreedAt: now,
          privacyAgreedAt: now,
        },
        select: { id: true },
      });

      await tx.recoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          userId: created.id,
          codeHash: hashRecoveryCode(code),
        })),
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "회원가입이 완료되었습니다.",
        recoveryCodes,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "이미 등록된 연락처 또는 이메일입니다." }, { status: 409 });
    }

    console.error("회원가입 처리 중 오류가 발생했습니다.", error);
    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
