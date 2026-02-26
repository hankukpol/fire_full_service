import type { Metadata } from "next";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import AuthSessionProvider from "@/components/providers/AuthSessionProvider";
import ToastProvider from "@/components/providers/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "소방 필기 합격예측",
  description: "소방공무원 채용시험 OMR 채점 및 합격 가능성 분석 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-slate-100 text-slate-100 antialiased">
        <AuthSessionProvider>
          <ToastProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <div className="flex-1 text-slate-900">{children}</div>
              <Footer />
            </div>
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
