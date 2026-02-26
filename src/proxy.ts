import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const publicAuthPaths = new Set(["/login", "/register"]);
const maintenanceBypassPaths = new Set([
  "/maintenance",
  "/login",
  "/register",
  "/api/site-settings",
  "/api/notices",
]);

interface SiteSettingsResponse {
  settings?: {
    "site.maintenanceMode"?: boolean;
    "site.maintenanceMessage"?: string;
  };
}

function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth");
}

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/exam");
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/exam/admin");
}

function isMaintenanceBypassPath(pathname: string): boolean {
  if (maintenanceBypassPaths.has(pathname)) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

async function getMaintenanceMode(request: NextRequest): Promise<boolean> {
  try {
    const url = new URL("/api/site-settings", request.url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-maintenance-check": "1",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as SiteSettingsResponse;
    return data.settings?.["site.maintenanceMode"] === true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/site-settings")) {
    return NextResponse.next();
  }

  const maintenanceMode = await getMaintenanceMode(request);
  if (maintenanceMode && !isMaintenanceBypassPath(pathname)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "시스템 점검 중입니다." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  if (!isProtectedPath(pathname) || publicAuthPaths.has(pathname) || isAuthApiPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const callbackPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath(pathname) && token.role !== "ADMIN") {
    const loginUrl = new URL("/login", request.url);
    const callbackPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackPath);
    loginUrl.searchParams.set("error", "admin_only");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
