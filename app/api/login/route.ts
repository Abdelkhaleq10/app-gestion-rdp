import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = String(body?.password || "").trim();

    if (password !== "admin123") {
      return NextResponse.json(
        { success: false, message: "Mot de passe incorrect." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Connexion reussie.",
    });

    response.cookies.set("responsable_auth", "true", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Erreur /api/login :", error);
    return NextResponse.json(
      { success: false, message: "Erreur de connexion." },
      { status: 500 }
    );
  }
}