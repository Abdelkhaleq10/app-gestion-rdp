import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";

const DB_PATH = "C:\\Logs\\rdp_access.db";

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function sameName(a: unknown, b: unknown) {
  return normalize(a) === normalize(b);
}

function getTableColumns(db: Database.Database, tableName: string) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
      name: string;
    }[];

    return rows.map((row) => row.name);
  } catch {
    return [];
  }
}

function pickColumn(columns: string[], candidates: string[]) {
  for (const candidate of candidates) {
    if (columns.includes(candidate)) return candidate;
  }

  return null;
}

function tableExists(db: Database.Database, tableName: string) {
  const row = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      AND name = ?
      LIMIT 1
      `
    )
    .get(tableName) as { name?: string } | undefined;

  return Boolean(row?.name);
}

export async function GET(request: NextRequest) {
  let db: Database.Database | null = null;

  try {
    const { searchParams } = new URL(request.url);

    const employeeName =
      searchParams.get("employeeName") ||
      searchParams.get("employeName") ||
      searchParams.get("fullName") ||
      searchParams.get("nom") ||
      searchParams.get("user") ||
      "";

    if (!employeeName.trim()) {
      return NextResponse.json(
        {
          success: false,
          request: null,
          message: "Nom employe manquant.",
        },
        { status: 400 }
      );
    }

    db = new Database(DB_PATH);

    if (!tableExists(db, "access_requests")) {
      db.close();

      return NextResponse.json({
        success: true,
        request: null,
        message: "Table access_requests introuvable.",
      });
    }

    const columns = getTableColumns(db, "access_requests");

    const idColumn = pickColumn(columns, ["id"]) || "id";

    const userColumn =
      pickColumn(columns, [
        "Utilisateur",
        "utilisateur",
        "employee_name",
        "employeeName",
        "full_name",
        "fullName",
        "nom_complet",
        "nom",
        "user",
      ]) || "Utilisateur";

    const statusColumn =
      pickColumn(columns, ["status", "statut", "etat"]) || "status";

    const priorityColumn =
      pickColumn(columns, ["priority", "priorite", "reason", "motif"]) || null;

    const priorityLevelColumn =
      pickColumn(columns, ["priority_level", "niveau_priorite"]) || null;

    const responseMessageColumn =
      pickColumn(columns, ["response_message", "message_reponse"]) || null;

    const responseAtColumn =
      pickColumn(columns, ["response_at", "date_reponse"]) || null;

    const currentUserResponseColumn =
      pickColumn(columns, ["current_user_response", "reponse_utilisateur_actuel"]) ||
      null;

    const requestTimeColumn =
      pickColumn(columns, [
        "request_time",
        "created_at",
        "date_creation",
        "date_demande",
      ]) || null;

    const activeUserNameColumn =
      pickColumn(columns, ["active_user_name", "utilisateur_actif"]) || null;

    const selectParts = [
      `${idColumn} AS id`,
      `${userColumn} AS Utilisateur`,
      `${statusColumn} AS status`,
    ];

    if (priorityColumn) selectParts.push(`${priorityColumn} AS priority`);
    if (priorityLevelColumn)
      selectParts.push(`${priorityLevelColumn} AS priority_level`);
    if (responseMessageColumn)
      selectParts.push(`${responseMessageColumn} AS response_message`);
    if (responseAtColumn) selectParts.push(`${responseAtColumn} AS response_at`);
    if (currentUserResponseColumn)
      selectParts.push(`${currentUserResponseColumn} AS current_user_response`);
    if (requestTimeColumn) selectParts.push(`${requestTimeColumn} AS request_time`);
    if (activeUserNameColumn)
      selectParts.push(`${activeUserNameColumn} AS active_user_name`);

    const rows = db
      .prepare(
        `
        SELECT ${selectParts.join(", ")}
        FROM access_requests
        WHERE ${userColumn} = ?
        ORDER BY ${idColumn} DESC
        LIMIT 30
        `
      )
      .all(employeeName) as any[];

    db.close();

    const activeRequest =
      rows.find((row) => {
        const status = normalize(row.status);

        return (
          status === "pending" ||
          status === "waiting_current_user" ||
          status === "waiting_release" ||
          status.includes("attente")
        );
      }) || null;

    if (activeRequest) {
      return NextResponse.json({
        success: true,
        request: {
          ...activeRequest,
          Utilisateur: activeRequest.Utilisateur || employeeName,
        },
        source: "active_request",
      });
    }

    const latestRequest = rows[0] || null;

    if (!latestRequest) {
      return NextResponse.json({
        success: true,
        request: null,
        message: "Aucune demande trouvee.",
      });
    }

    return NextResponse.json({
      success: true,
      request: {
        ...latestRequest,
        Utilisateur: latestRequest.Utilisateur || employeeName,
      },
      source: "latest_request",
    });
  } catch (error) {
    if (db) {
      try {
        db.close();
      } catch {}
    }

    console.error("Erreur api my-last-request :", error);

    return NextResponse.json(
      {
        success: false,
        request: null,
        message: "Erreur lors du chargement de la derniere demande.",
      },
      { status: 500 }
    );
  }
}