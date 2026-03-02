import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "이메일 재설정은 비활성화되어 있습니다. 복구코드로 비밀번호를 재설정해 주세요.",
    },
    { status: 410 }
  );
}
