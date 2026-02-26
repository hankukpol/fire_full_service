import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { saveImageUpload, validateImageFile } from "@/lib/upload";

export const runtime = "nodejs";

/**
 * POST /api/admin/banners/upload-image
 * 배너 WYSIWYG 에디터 내 이미지 업로드 전용 엔드포인트.
 * SunEditor의 onImageUploadBefore 콜백에서 호출됨.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "업로드할 이미지 파일이 필요합니다." }, { status: 400 });
    }

    const validation = await validateImageFile(image);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const saved = await saveImageUpload({
      file: image,
      prefix: "editor",
      uploadSubdir: "banners",
    });

    return NextResponse.json({
      success: true,
      url: saved.publicUrl,
    });
  } catch (error) {
    console.error("에디터 이미지 업로드 중 오류가 발생했습니다.", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "이미지 업로드에 실패했습니다.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 }
    );
  }
}
