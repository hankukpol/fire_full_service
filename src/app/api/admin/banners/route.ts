import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminRoute } from "@/lib/admin-auth";
import { isBannerZone, revalidateBannerCache } from "@/lib/banners";
import { prisma } from "@/lib/prisma";
import { sanitizeBannerHtml } from "@/lib/sanitize-banner-html";
import { deleteUploadedFileByPublicUrl, saveImageUpload, validateImageFile } from "@/lib/upload";

export const runtime = "nodejs";

function parseBannerId(request: NextRequest): number | null {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("id");
  if (!rawId) return null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSortOrder(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const parsed = Number(String(value));
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseBooleanOrNull(value: FormDataEntryValue | null): boolean | null {
  if (value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function isValidLinkUrl(value: string | null): boolean {
  if (!value) return true;
  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** htmlContent 저장 전 <script> 태그만 제거하는 최소 sanitize */
// htmlContent is sanitized before persistence by sanitizeBannerHtml.
function isJsonContentType(request: NextRequest): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

async function safeDeleteUploadedFile(publicUrl: string | null | undefined, context: string): Promise<void> {
  if (!publicUrl) return;

  try {
    await deleteUploadedFileByPublicUrl(publicUrl);
  } catch (cleanupError) {
    console.error(`${context} 중 오류가 발생했습니다.`, cleanupError);
  }
}

function safeRevalidateBannerCache(): void {
  try {
    revalidateBannerCache();
  } catch (error) {
    console.error("배너 캐시 무효화 중 오류가 발생했습니다.", error);
  }
}

export async function GET() {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ banners });
  } catch (error) {
    console.error("배너 목록 조회 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 목록 조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  // HTML 에디터 모드 (JSON body)
  if (isJsonContentType(request)) {
    return handlePostJson(request);
  }

  // 레거시 이미지 모드 (FormData)
  return handlePostFormData(request);
}

/** HTML 에디터 모드: JSON body로 htmlContent 저장 */
async function handlePostJson(request: NextRequest) {
  try {
    const body = await request.json();
    const zoneRaw = String(body.zone ?? "").trim();
    if (!isBannerZone(zoneRaw)) {
      return NextResponse.json({ error: "배너 존(zone) 값이 올바르지 않습니다." }, { status: 400 });
    }

    const htmlContent = typeof body.htmlContent === "string" ? sanitizeBannerHtml(body.htmlContent) : "";
    if (!htmlContent.trim()) {
      return NextResponse.json({ error: "배너 HTML 콘텐츠가 비어있습니다." }, { status: 400 });
    }

    const altText = typeof body.altText === "string" ? body.altText.trim() : "";
    const mobileImageUrl = typeof body.mobileImageUrl === "string" && body.mobileImageUrl.trim()
      ? body.mobileImageUrl.trim() : null;
    const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0
      ? body.sortOrder : 0;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    const created = await prisma.banner.create({
      data: {
        zone: zoneRaw,
        imageUrl: null,
        mobileImageUrl,
        htmlContent,
        altText,
        isActive,
        sortOrder,
      },
    });

    safeRevalidateBannerCache();

    return NextResponse.json({ success: true, banner: created }, { status: 201 });
  } catch (error) {
    console.error("배너 생성(HTML 모드) 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 생성에 실패했습니다." }, { status: 500 });
  }
}

/** 레거시 이미지 모드: FormData로 이미지 파일 업로드 */
async function handlePostFormData(request: NextRequest) {
  let uploadedImageUrl: string | null = null;
  let isCreated = false;

  try {
    const formData = await request.formData();

    const zoneRaw = String(formData.get("zone") ?? "").trim();
    if (!isBannerZone(zoneRaw)) {
      return NextResponse.json({ error: "배너 존(zone) 값이 올바르지 않습니다." }, { status: 400 });
    }

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "업로드할 배너 이미지가 필요합니다." }, { status: 400 });
    }

    const imageValidation = await validateImageFile(image);
    if (!imageValidation.ok) {
      return NextResponse.json({ error: imageValidation.error }, { status: 400 });
    }

    const linkUrl = normalizeOptionalText(formData.get("linkUrl"));
    const altText = normalizeOptionalText(formData.get("altText")) ?? "";
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const isActive = parseBooleanOrNull(formData.get("isActive"));

    if (!isValidLinkUrl(linkUrl)) {
      return NextResponse.json({ error: "배너 링크 URL 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (sortOrder === null && formData.get("sortOrder") !== null) {
      return NextResponse.json({ error: "sortOrder는 0 이상의 정수여야 합니다." }, { status: 400 });
    }

    if (isActive === null && formData.get("isActive") !== null) {
      return NextResponse.json({ error: "isActive 값이 올바르지 않습니다." }, { status: 400 });
    }

    const savedImage = await saveImageUpload({
      file: image,
      prefix: zoneRaw,
      uploadSubdir: "banners",
    });
    uploadedImageUrl = savedImage.publicUrl;

    const created = await prisma.banner.create({
      data: {
        zone: zoneRaw,
        imageUrl: savedImage.publicUrl,
        linkUrl,
        altText,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });
    isCreated = true;

    safeRevalidateBannerCache();

    return NextResponse.json(
      {
        success: true,
        banner: created,
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedImageUrl && !isCreated) {
      await safeDeleteUploadedFile(uploadedImageUrl, "배너 생성 실패 후 업로드 파일 정리");
    }
    console.error("배너 생성 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 생성에 실패했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const bannerId = parseBannerId(request);
  if (!bannerId) {
    return NextResponse.json({ error: "수정할 배너 ID가 필요합니다." }, { status: 400 });
  }

  // HTML 에디터 모드 (JSON body)
  if (isJsonContentType(request)) {
    return handlePutJson(request, bannerId);
  }

  // 레거시 이미지 모드 (FormData)
  return handlePutFormData(request, bannerId);
}

/** HTML 에디터 모드: JSON body로 htmlContent 수정 */
async function handlePutJson(request: NextRequest, bannerId: number) {
  try {
    const existing = await prisma.banner.findUnique({ where: { id: bannerId } });
    if (!existing) {
      return NextResponse.json({ error: "수정할 배너를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();

    const zoneRaw = typeof body.zone === "string" ? body.zone.trim() : null;
    if (zoneRaw !== null && !isBannerZone(zoneRaw)) {
      return NextResponse.json({ error: "배너 존(zone) 값이 올바르지 않습니다." }, { status: 400 });
    }

    const htmlContent = typeof body.htmlContent === "string" ? sanitizeBannerHtml(body.htmlContent) : null;
    if (htmlContent !== null && !htmlContent.trim()) {
      return NextResponse.json({ error: "배너 HTML 콘텐츠가 비어있습니다." }, { status: 400 });
    }

    const altText = typeof body.altText === "string" ? body.altText.trim() : undefined;
    const mobileImageUrl = typeof body.mobileImageUrl === "string"
      ? (body.mobileImageUrl.trim() || null)
      : undefined;
    const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) && body.sortOrder >= 0
      ? body.sortOrder : undefined;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

    // 모바일 이미지가 변경되면 이전 파일 삭제
    const shouldDeleteOldMobileImage = mobileImageUrl !== undefined && existing.mobileImageUrl && existing.mobileImageUrl !== mobileImageUrl;

    const updated = await prisma.banner.update({
      where: { id: bannerId },
      data: {
        zone: zoneRaw ?? existing.zone,
        htmlContent: htmlContent ?? existing.htmlContent,
        imageUrl: null,
        linkUrl: null,
        ...(altText !== undefined && { altText }),
        ...(mobileImageUrl !== undefined && { mobileImageUrl }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (shouldDeleteOldMobileImage) {
      await safeDeleteUploadedFile(existing.mobileImageUrl, "배너 수정 후 이전 모바일 이미지 정리");
    }

    safeRevalidateBannerCache();

    return NextResponse.json({ success: true, banner: updated });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "수정할 배너를 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("배너 수정(HTML 모드) 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 수정에 실패했습니다." }, { status: 500 });
  }
}

/** 레거시 이미지 모드: FormData로 이미지 파일 수정 */
async function handlePutFormData(request: NextRequest, bannerId: number) {
  let uploadedImageUrl: string | null = null;
  let isUpdated = false;

  try {
    const existing = await prisma.banner.findUnique({
      where: { id: bannerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "수정할 배너를 찾을 수 없습니다." }, { status: 404 });
    }

    const formData = await request.formData();

    const hasLinkUrl = formData.has("linkUrl");
    const zoneRaw = normalizeOptionalText(formData.get("zone"));
    if (zoneRaw !== null && !isBannerZone(zoneRaw)) {
      return NextResponse.json({ error: "배너 존(zone) 값이 올바르지 않습니다." }, { status: 400 });
    }

    const linkUrl = normalizeOptionalText(formData.get("linkUrl"));
    const altText = normalizeOptionalText(formData.get("altText"));
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const isActive = parseBooleanOrNull(formData.get("isActive"));

    if (hasLinkUrl && !isValidLinkUrl(linkUrl)) {
      return NextResponse.json({ error: "배너 링크 URL 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (sortOrder === null && formData.get("sortOrder") !== null) {
      return NextResponse.json({ error: "sortOrder는 0 이상의 정수여야 합니다." }, { status: 400 });
    }
    if (isActive === null && formData.get("isActive") !== null) {
      return NextResponse.json({ error: "isActive 값이 올바르지 않습니다." }, { status: 400 });
    }

    const image = formData.get("image");
    let nextImageUrl = existing.imageUrl;
    let shouldDeletePreviousImage = false;

    if (image instanceof File) {
      const imageValidation = await validateImageFile(image);
      if (!imageValidation.ok) {
        return NextResponse.json({ error: imageValidation.error }, { status: 400 });
      }

      const savedImage = await saveImageUpload({
        file: image,
        prefix: zoneRaw ?? existing.zone,
        uploadSubdir: "banners",
      });

      nextImageUrl = savedImage.publicUrl;
      uploadedImageUrl = savedImage.publicUrl;
      shouldDeletePreviousImage = true;
    }

    const updated = await prisma.banner.update({
      where: { id: bannerId },
      data: {
        zone: zoneRaw ?? existing.zone,
        imageUrl: nextImageUrl,
        linkUrl: hasLinkUrl ? linkUrl : existing.linkUrl,
        altText: altText ?? existing.altText,
        isActive: isActive ?? existing.isActive,
        sortOrder: sortOrder ?? existing.sortOrder,
      },
    });
    isUpdated = true;

    if (shouldDeletePreviousImage && existing.imageUrl !== nextImageUrl) {
      await safeDeleteUploadedFile(existing.imageUrl, "배너 수정 후 이전 이미지 정리");
    }

    safeRevalidateBannerCache();

    return NextResponse.json({
      success: true,
      banner: updated,
    });
  } catch (error) {
    if (uploadedImageUrl && !isUpdated) {
      await safeDeleteUploadedFile(uploadedImageUrl, "배너 수정 실패 후 신규 업로드 파일 정리");
    }

    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "수정할 배너를 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("배너 수정 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const bannerId = parseBannerId(request);
  if (!bannerId) {
    return NextResponse.json({ error: "삭제할 배너 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const deleted = await prisma.banner.delete({
      where: { id: bannerId },
    });

    await safeDeleteUploadedFile(deleted.imageUrl, "배너 삭제 후 이미지 정리");
    await safeDeleteUploadedFile(deleted.mobileImageUrl, "배너 삭제 후 모바일 이미지 정리");
    safeRevalidateBannerCache();

    return NextResponse.json({
      success: true,
      deletedId: bannerId,
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "삭제할 배너를 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("배너 삭제 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 삭제에 실패했습니다." }, { status: 500 });
  }
}
