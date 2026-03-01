import Link from "next/link";
import SiteSubTabNav from "./_components/SiteSubTabNav";

export default function AdminSiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">시스템-사이트 설정</h1>
        <p className="mt-1 text-sm text-slate-600">
          사이트 문구, 이용 약관, 메뉴 공개, 운영 정책을 서브 탭으로 분리해 관리합니다.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          배너는{" "}
          <Link href="/admin/banners" className="font-semibold text-slate-800 underline">
            배너 관리
          </Link>
          , 공지사항은{" "}
          <Link href="/admin/notices" className="font-semibold text-slate-800 underline">
            공지사항 관리
          </Link>
          에서 설정합니다.
        </p>
      </header>

      <SiteSubTabNav />

      {children}
    </div>
  );
}
