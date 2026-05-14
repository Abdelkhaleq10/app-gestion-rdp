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

function normalizeDbStatus(status: string) {
  const normalized = normalizeStatus(status);
  return normalized || "pending";
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
  addColumnIfMissing("access_requests", "current_user_response", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_at", "TEXT DEFAULT ''");
}

export async function GET(req: NextRequest) {
  try {
    ensureAccessRequestsColumns();

    const searchParams = req.nextUrl.searchParams;

    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);

    const pageSize = Math.max(
      parseInt(searchParams.get("pageSize") || "20", 10),
      1
    );

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

    const orderClause = sort === "oldest" ? "ORDER BY id ASC" : "ORDER BY id DESC";

    const totalRow = db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM access_requests
        ${whereClause}
        `
      )
      .get(...params) as { total: number } | undefined;

    const total = totalRow?.total || 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const offset = (page - 1) * pageSize;

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
        LIMIT ? OFFSET ?
        `
      )
      .all(...params, pageSize, offset) as Array<{
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

    const items = requests.map((item) => ({
      ...item,
      ip: normalizeIp(item.ip),
      status: normalizeDbStatus(item.status),
      Utilisateur: normalizeText(item.Utilisateur) || "N/A",
      pc_name: normalizeText(item.pc_name),
      request_time: normalizeText(item.request_time),
      reason: normalizeText(item.reason),
      priority: normalizeText(item.priority) || "normal",
      priority_level: Number(item.priority_level || 1),
      message: normalizeText(item.message),
      active_user_name: normalizeText(item.active_user_name),
      current_user_response: normalizeText(item.current_user_response),
      response_message: normalizeText(item.response_message),
      response_at: normalizeText(item.response_at),
    }));

    return NextResponse.json({
      success: true,
      items,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error: any) {
    console.error("Erreur /api/requests :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du chargement des demandes.",
        error: error?.message ?? String(error),
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      },
      { status: 500 }
    );
  }
}