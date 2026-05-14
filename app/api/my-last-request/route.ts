import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeIp(ip: string) {
  const value = normalizeText(ip);

  if (!value) return "N/A";
  if (value === "::1") return "127.0.0.1";
  if (value.startsWith("::ffff:")) return value.replace("::ffff:", "");

  return value;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeName = normalizeText(searchParams.get("employeeName"));

    if (!employeeName) {
      return NextResponse.json(
        {
          success: false,
          message: "Nom employe obligatoire.",
          request: null,
        },
        { status: 400 }
      );
    }

    const row = db
      .prepare(
        `
        SELECT
          id,
          COALESCE("Utilisateur", '') AS Utilisateur,
          COALESCE(ip, '') AS ip,
          COALESCE(pc_name, '') AS pc_name,
          COALESCE(request_time, '') AS request_time,
          COALESCE(status, '') AS status,
          COALESCE(reason, '') AS reason,
          COALESCE(priority, '') AS priority,
          COALESCE(message, '') AS message,
          COALESCE(current_user_response, '') AS current_user_response,
          COALESCE(response_message, '') AS response_message,
          COALESCE(response_at, '') AS response_at
        FROM access_requests
        WHERE LOWER(COALESCE("Utilisateur", '')) = LOWER(?)
        ORDER BY id DESC
        LIMIT 1
        `
      )
      .get(employeeName) as
      | {
          id: number;
          Utilisateur: string;
          ip: string;
          pc_name: string;
          request_time: string;
          status: string;
          reason: string;
          priority: string;
          message: string;
          current_user_response: string;
          response_message: string;
          response_at: string;
        }
      | undefined;

    if (!row) {
      return NextResponse.json({
        success: true,
        request: null,
      });
    }

    return NextResponse.json({
      success: true,
      request: {
        ...row,
        ip: normalizeIp(row.ip),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du chargement de la derniere demande.",
        error: error?.message ?? String(error),
        request: null,
      },
      { status: 500 }
    );
  }
}