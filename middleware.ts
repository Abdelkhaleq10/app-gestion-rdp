import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicResponsableRoutes = [
    "/responsable/login",
    "/responsable/logout",
  ];

  const isResponsableRoute = pathname.startsWith("/responsable");
  const isPublicResponsableRoute = publicResponsableRoutes.includes(pathname);

  if (!isResponsableRoute || isPublicResponsableRoute) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("responsable_auth")?.value;

  if (authCookie === "true") {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/responsable/login", request.url));
}

export const config = {
  matcher: ["/responsable/:path*"],
};