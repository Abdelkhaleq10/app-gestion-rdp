import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/db";

function escapeCsv(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function normalizeIp(ip: string) {
  return (ip || "").trim().replace("::ffff:", "");
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const search = (searchParams.get("search") || "").trim();
    const statusFilter = (searchParams.get("status") || "").trim();
    const dateFilter = (searchParams.get("date") || "").trim();
    const sort = (searchParams.get("sort") || "recent").trim().toLowerCase();

    const whereParts: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      const likeValue = `%${search}%`;
      whereParts.push(`
        (
          COALESCE("Utilisateur",'') LIKE ?
          OR ip LIKE ?
          OR reason LIKE ?
        )
      `);
      params.push(likeValue, likeValue, likeValue);
    }

    if (statusFilter) {
      whereParts.push(`status = ?`);
      params.push(statusFilter);
    }

    if (dateFilter) {
      whereParts.push(`request_time LIKE ?`);
      params.push(`${dateFilter}%`);
    }

    const whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const orderClause =
      sort === "oldest" ? `ORDER BY id ASC` : `ORDER BY id DESC`;

    const requests = db
      .prepare(
        `
        SELECT
          id,
          COALESCE("Utilisateur", '') as Utilisateur,
          ip,
          request_time,
          status,
          reason
        FROM access_requests
        ${whereClause}
        ${orderClause}
        `
      )
      .all(...params) as Array<{
        id: number;
        Utilisateur: string;
        ip: string;
        request_time: string;
        status: string;
        reason: string;
      }>;

    const items = requests.map((item) => ({
      ...item,
      ip: normalizeIp(item.ip),
    }));

    const headers = ["ID", "Utilisateur", "IP", "DateHeure", "Statut", "Raison"];

    const csvLines = [
      headers.join(","),
      ...items.map((item) =>
        [
          item.id,
          item.Utilisateur,
          item.ip,
          item.request_time,
          item.status,
          item.reason,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];

    const csvContent = "\uFEFF" + csvLines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="historique_demandes_export.csv"',
      },
    });
  } catch (error) {
    console.error("Erreur /api/export-requests :", error);
    return NextResponse.json(
      { success: false, message: "Erreur export demandes." },
      { status: 500 }
    );
  }
}