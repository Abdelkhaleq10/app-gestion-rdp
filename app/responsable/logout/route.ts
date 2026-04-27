import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/responsable/login", req.url)
  );

  response.cookies.set("responsable_auth", "", {
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  });

  return response;
}