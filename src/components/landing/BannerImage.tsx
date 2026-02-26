import type { PublicBannerItem } from "@/lib/banners";
import { sanitizeBannerHtml } from "@/lib/sanitize-banner-html";

interface BannerImageProps {
  banner: PublicBannerItem;
  className?: string;
  fullWidth?: boolean;
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 모바일 전용 이미지 (md 미만에서만 표시) */
function MobileImage({ banner, safeLinkUrl }: { banner: PublicBannerItem; safeLinkUrl: string | null }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.mobileImageUrl!}
      alt={banner.altText || "배너 이미지"}
      className="block h-auto w-full object-cover bg-white"
    />
  );

  if (!safeLinkUrl) return img;

  const external = isExternalUrl(safeLinkUrl);
  return (
    <a
      href={safeLinkUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="block"
    >
      {img}
    </a>
  );
}

export default function BannerImage({ banner, className, fullWidth = false }: BannerImageProps) {
  const safeHtmlContent = banner.htmlContent ? sanitizeBannerHtml(banner.htmlContent) : null;
  const hasMobileImage = !!banner.mobileImageUrl;
  const safeLinkUrl = banner.linkUrl && !banner.linkUrl.startsWith("//") ? banner.linkUrl : null;

  // fullWidth 모드 + 모바일 이미지 있음 → PC/모바일 분기 렌더링
  if (fullWidth && hasMobileImage) {
    return (
      <>
        {/* 모바일: md 미만 */}
        <div className="block md:hidden">
          <MobileImage banner={banner} safeLinkUrl={safeLinkUrl} />
        </div>
        {/* PC: md 이상 */}
        <div className="hidden md:block">
          {safeHtmlContent ? (
            <div
              className="flex w-full justify-center overflow-hidden"
              dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
            />
          ) : banner.imageUrl ? (
            <FullWidthImage banner={banner} safeLinkUrl={safeLinkUrl} className={className} />
          ) : null}
        </div>
      </>
    );
  }

  // HTML 콘텐츠 모드 (모바일 이미지 없음)
  if (safeHtmlContent) {
    return (
      <div
        className={fullWidth ? "flex w-full justify-center overflow-hidden" : "block"}
        dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
      />
    );
  }

  // 이미지 모드
  if (!banner.imageUrl) return null;

  if (fullWidth) {
    return <FullWidthImage banner={banner} safeLinkUrl={safeLinkUrl} className={className} />;
  }

  // 일반(비 fullWidth) 이미지
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.altText || "배너 이미지"}
      className={joinClassNames("block h-auto w-full border border-slate-200 object-cover bg-white", className)}
    />
  );

  if (!safeLinkUrl) return image;

  const external = isExternalUrl(safeLinkUrl);
  return (
    <a
      href={safeLinkUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="block"
    >
      {image}
    </a>
  );
}

/** fullWidth PC 이미지 — 히어로 확대 문제 수정: w-full max-w-[1920px] */
function FullWidthImage({
  banner,
  safeLinkUrl,
  className,
}: {
  banner: PublicBannerItem;
  safeLinkUrl: string | null;
  className?: string;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl!}
      alt={banner.altText || "배너 이미지"}
      className={joinClassNames("block h-auto w-full max-w-[1920px] object-cover object-center bg-white", className)}
    />
  );

  const wrapper = (children: React.ReactNode) => (
    <div className="flex w-full justify-center overflow-hidden">{children}</div>
  );

  if (!safeLinkUrl) return wrapper(img);

  const external = isExternalUrl(safeLinkUrl);
  return wrapper(
    <a
      href={safeLinkUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="flex w-full justify-center"
    >
      {img}
    </a>
  );
}