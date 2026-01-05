import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // allow next-auth + assets + login
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/login")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // not logged in
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // non-admin blocked routes
  if (token.role !== "admin") {
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/mainthai") ||
      pathname.startsWith("/laos")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};