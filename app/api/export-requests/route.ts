import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/db";

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

function escapeCsv(value: unknown) {
  const str = String(value ?? "");

  if (
    str.includes(";") ||
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function normalizeStatus(status: string) {
  const value = normalizeText(status).toLowerCase();

  if (!value) return "";

  if (
    value === "authorized" ||
    value === "autorise" ||
    value === "autorisé" ||
    value === "autorisee" ||
    value === "autorisée"
  ) {
    return "authorized";
  }

  if (
    value === "rejected" ||
    value === "refuse" ||
    value === "refusé" ||
    value === "refusee" ||
    value === "refusée"
  ) {
    return "rejected";
  }

  if (value === "waiting_current_user") {
    return "waiting_current_user";
  }

  if (value === "waiting_release") {
    return "waiting_release";
  }

  if (value === "pending" || value === "en attente") {
    return "pending";
  }

  return value;
}

function statusLabel(status: string) {
  const value = normalizeStatus(status);

  if (value === "authorized") return "Autorisee";
  if (value === "rejected") return "Refusee";
  if (value === "waiting_current_user") return "En attente de reponse";
  if (value === "waiting_release") return "En attente de liberation";
  if (value === "pending") return "En attente";

  return value || "En attente";
}

function responseLabel(response: string) {
  const value = normalizeText(response).toLowerCase();

  if (value === "accepted") return "Acceptee";
  if (value === "rejected") return "Refusee";
  if (value === "timeout") return "Expiree";
  if (value === "no_active_session") return "Aucune session active";
  if (value === "error") return "Erreur notification";

  return "Aucune reponse";
}

function priorityLabel(priority: string, reason: string) {
  const value = normalizeText(priority || reason).toLowerCase();

  if (value === "urgent") return "Urgent";
  if (value === "consultation") return "Consultation";
  if (value === "verification") return "Verification";
  if (value === "impression") return "Impression";
  if (value === "assistance") return "Assistance";
  if (value === "autre" || value === "other") return "Autre";

  return normalizeText(reason || priority || "Normal");
}

function columnExists(table: string, column: string): boolean {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>;

    return columns.some((item) => item.name === column);
  } catch {
    return false;
  }
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!columnExists(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureAccessRequestsColumns() {
  addColumnIfMissing("access_requests", "pc_name", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "priority", "TEXT DEFAULT 'normal'");
  addColumnIfMissing("access_requests", "message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "priority_level", "INTEGER DEFAULT 1");
  addColumnIfMissing("access_requests", "active_user_name", "TEXT DEFAULT ''");
  addColumnIfMissing(
    "access_requests",
    "current_user_response",
    "TEXT DEFAULT ''"
  );
  addColumnIfMissing("access_requests", "response_message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_at", "TEXT DEFAULT ''");
}

export async function GET(req: NextRequest) {
  try {
    ensureAccessRequestsColumns();

    const searchParams = req.nextUrl.searchParams;

    const search = normalizeText(searchParams.get("search"));
    const rawStatus = normalizeText(searchParams.get("status"));
    const statusFilter = rawStatus ? normalizeStatus(rawStatus) : "";
    const dateFilter = normalizeText(searchParams.get("date"));
    const sort = normalizeText(searchParams.get("sort") || "recent").toLowerCase();

    const whereParts: string[] = [];
    const params: Array<string | number> = [];

    if (search) {
      const likeValue = `%${search}%`;

      whereParts.push(`
        (
          COALESCE("Utilisateur", '') LIKE ?
          OR COALESCE(ip, '') LIKE ?
          OR COALESCE(pc_name, '') LIKE ?
          OR COALESCE(reason, '') LIKE ?
          OR COALESCE(priority, '') LIKE ?
          OR COALESCE(message, '') LIKE ?
          OR COALESCE(active_user_name, '') LIKE ?
          OR COALESCE(current_user_response, '') LIKE ?
          OR COALESCE(response_message, '') LIKE ?
        )
      `);

      params.push(
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue
      );
    }

    if (statusFilter) {
      whereParts.push(`status = ?`);
      params.push(statusFilter);
    }

    if (dateFilter) {
      whereParts.push(`request_time LIKE ?`);
      params.push(`%${dateFilter}%`);
    }

    const whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const orderClause =
      sort === "oldest" ? "ORDER BY id ASC" : "ORDER BY id DESC";

    const requests = db
      .prepare(
        `
        SELECT
          id,
          COALESCE("Utilisateur", '') AS Utilisateur,
          COALESCE(ip, '') AS ip,
          COALESCE(pc_name, '') AS pc_name,
          COALESCE(request_time, '') AS request_time,
          COALESCE(status, 'pending') AS status,
          COALESCE(reason, '') AS reason,
          COALESCE(priority, 'normal') AS priority,
          COALESCE(priority_level, 1) AS priority_level,
          COALESCE(message, '') AS message,
          COALESCE(active_user_name, '') AS active_user_name,
          COALESCE(current_user_response, '') AS current_user_response,
          COALESCE(response_message, '') AS response_message,
          COALESCE(response_at, '') AS response_at
        FROM access_requests
        ${whereClause}
        ${orderClause}
        `
      )
      .all(...params) as Array<{
        id: number;
        Utilisateur: string;
        ip: string;
        pc_name: string;
        request_time: string;
        status: string;
        reason: string;
        priority: string;
        priority_level: number;
        message: string;
        active_user_name: string;
        current_user_response: string;
        response_message: string;
        response_at: string;
      }>;

    const headers = [
      "ID",
      "Demandeur",
      "IP",
      "PC",
      "Date demande",
      "Statut",
      "Priorite",
      "Niveau priorite",
      "Motif",
      "Message employe",
      "Utilisateur actif",
      "Reponse utilisateur actif",
      "Message reponse",
      "Date reponse",
    ];

    const rows = requests.map((item) => [
      item.id,
      normalizeText(item.Utilisateur) || "N/A",
      normalizeIp(item.ip),
      normalizeText(item.pc_name),
      normalizeText(item.request_time),
      statusLabel(item.status),
      priorityLabel(item.priority, item.reason),
      Number(item.priority_level || 1),
      normalizeText(item.reason),
      normalizeText(item.message),
      normalizeText(item.active_user_name),
      responseLabel(item.current_user_response),
      normalizeText(item.response_message),
      normalizeText(item.response_at),
    ]);

    const separator = ";";

    const csvLines = [
      headers.map(escapeCsv).join(separator),
      ...rows.map((row) => row.map(escapeCsv).join(separator)),
    ];

    const csvContent = "\uFEFF" + csvLines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="export_demandes_acces_rdp.csv"',
      },
    });
  } catch (error: any) {
    console.error("Erreur /api/export-requests :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de l'export des demandes.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}