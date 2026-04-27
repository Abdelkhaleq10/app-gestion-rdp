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

function toTimestamp(date: string, heure: string) {
  const [day, month, year] = (date || "").split("/");
  if (!day || !month || !year) return 0;
  const iso = `${year}-${month}-${day}T${heure || "00:00:00"}`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function toRequestTimestamp(requestTime: string) {
  const [datePart, timePart] = (requestTime || "").split(" ");
  if (!datePart) return 0;

  const [day, month, year] = datePart.split("/");
  if (!day || !month || !year) return 0;

  const iso = `${year}-${month}-${day}T${timePart || "00:00:00"}`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

type AccessRequest = {
  Utilisateur: string | null;
  ip: string;
  request_time: string;
  status: string;
};

type Row = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  sessionId: string;
  nomSession: string;
  ip: string;
  typeIP: string;
  action: string;
  sessionActive: string;
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const search = (searchParams.get("search") || "").trim();
    const actionFilter = (searchParams.get("action") || "").trim();
    const typeIpFilter = (searchParams.get("typeIP") || "").trim();
    const dateFilter = (searchParams.get("date") || "").trim();
    const sort = (searchParams.get("sort") || "recent").trim().toLowerCase();

    const accessRequests = db
      .prepare(
        `
        SELECT COALESCE("Utilisateur",'') as Utilisateur, ip, request_time, status
        FROM access_requests
        WHERE status = 'autorise'
        ORDER BY id DESC
        `
      )
      .all() as AccessRequest[];

    const whereParts: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      const likeValue = `%${search}%`;
      whereParts.push(`
        (
          utilisateur LIKE ?
          OR ip LIKE ?
          OR nom_session LIKE ?
          OR action LIKE ?
        )
      `);
      params.push(likeValue, likeValue, likeValue, likeValue);
    }

    if (actionFilter) {
      whereParts.push(`action = ?`);
      params.push(actionFilter);
    }

    if (typeIpFilter) {
      whereParts.push(`type_ip = ?`);
      params.push(typeIpFilter);
    }

    if (dateFilter) {
      whereParts.push(`date = ?`);
      params.push(dateFilter);
    }

    const whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const orderClause =
      sort === "oldest"
        ? `
          ORDER BY
            substr(date, 7, 4) ASC,
            substr(date, 4, 2) ASC,
            substr(date, 1, 2) ASC,
            heure ASC,
            id ASC
        `
        : `
          ORDER BY
            substr(date, 7, 4) DESC,
            substr(date, 4, 2) DESC,
            substr(date, 1, 2) DESC,
            heure DESC,
            id DESC
        `;

    const rawItems = db
      .prepare(
        `
        SELECT
          id,
          COALESCE(date, '') as date,
          COALESCE(heure, '') as heure,
          COALESCE(utilisateur, '-') as utilisateur,
          COALESCE(session_id, '') as sessionId,
          COALESCE(nom_session, '') as nomSession,
          COALESCE(ip, '') as ip,
          COALESCE(type_ip, '') as typeIP,
          COALESCE(action, '') as action,
          COALESCE(session_active, '') as sessionActive
        FROM rdp_events
        ${whereClause}
        ${orderClause}
        `
      )
      .all(...params) as Row[];

    const items = rawItems.map((row) => {
      let displayUtilisateur = row.utilisateur || "-";
      const eventIp = normalizeIp(row.ip);
      const eventTime = toTimestamp(row.date, row.heure);

      if (
        displayUtilisateur.toLowerCase() === "autocad_user" &&
        eventIp &&
        eventIp !== "LOCAL"
      ) {
        const matched = accessRequests.find((req) => {
          const reqIp = normalizeIp(req.ip);
          const reqTime = toRequestTimestamp(req.request_time || "");
          return reqIp === eventIp && reqTime <= eventTime && !!req.Utilisateur;
        });

        if (matched?.Utilisateur) {
          displayUtilisateur = matched.Utilisateur;
        }
      }

      return {
        ...row,
        utilisateur: displayUtilisateur,
      };
    });

    const headers = [
      "ID",
      "Date",
      "Heure",
      "Utilisateur",
      "SessionID",
      "NomSession",
      "IP",
      "TypeIP",
      "Action",
      "SessionActive",
    ];

    const csvLines = [
      headers.join(","),
      ...items.map((item) =>
        [
          item.id,
          item.date,
          item.heure,
          item.utilisateur,
          item.sessionId,
          item.nomSession,
          item.ip,
          item.typeIP,
          item.action,
          item.sessionActive,
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
          'attachment; filename="historique_rdp_export.csv"',
      },
    });
  } catch (error) {
    console.error("Erreur /api/export-history :", error);
    return NextResponse.json(
      { success: false, message: "Erreur export historique." },
      { status: 500 }
    );
  }
}