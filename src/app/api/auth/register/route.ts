import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateRegisterInput } from "@/lib/validations";

export const runtime = "nodejs";

interface RegisterRequestBody {
  name?: unknown;
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

    const { name, phone, password } = validationResult.data;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return NextResponse.json({ error: "이미 등록된 연락처입니다." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        termsAgreedAt: now,
        privacyAgreedAt: now,
      },
    });

    return NextResponse.json({ success: true, message: "회원가입이 완료되었습니다." }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "이미 등록된 연락처입니다." }, { status: 409 });
    }

    console.error("회원가입 처리 중 오류가 발생했습니다.", error);
    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
