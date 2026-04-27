import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/db";

function normalizeIp(ip: string) {
  return (ip || "").trim().replace("::ffff:", "");
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.max(
      parseInt(searchParams.get("pageSize") || "20", 10),
      1
    );

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

    const totalRow = db
      .prepare(
        `
        SELECT COUNT(*) as total
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
          COALESCE("Utilisateur", '') as Utilisateur,
          ip,
          request_time,
          status,
          reason
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
        request_time: string;
        status: string;
        reason: string;
      }>;

    const items = requests.map((item) => ({
      ...item,
      ip: normalizeIp(item.ip),
    }));

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Erreur /api/requests :", error);
    return NextResponse.json({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  }
}