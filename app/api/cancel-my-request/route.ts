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

function getColumns(db: Database.Database, tableName: string) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
      name: string;
    }[];

    return rows.map((row) => row.name);
  } catch {
    return [];
  }
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  columnType: string
) {
  const columns = getColumns(db, tableName);

  if (!columns.includes(columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`).run();
  }
}

function ensureSchema(db: Database.Database) {
  if (!tableExists(db, "access_requests")) return;

  ensureColumn(db, "access_requests", "response_message", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_at", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "current_user_response", "TEXT DEFAULT ''");
}

export async function POST(request: NextRequest) {
  let db: Database.Database | null = null;

  try {
    const body = await request.json();

    const employeeName = String(
      body.employeeName ||
        body.employeName ||
        body.fullName ||
        body.nom_complet ||
        body.utilisateur ||
        ""
    ).trim();

    const requestId = Number(body.requestId || 0);

    if (!employeeName) {
      return NextResponse.json(
        {
          success: false,
          message: "Nom employe manquant.",
        },
        { status: 400 }
      );
    }

    db = new Database(DB_PATH);

    if (!tableExists(db, "access_requests")) {
      db.close();

      return NextResponse.json(
        {
          success: false,
          message: "Table access_requests introuvable.",
        },
        { status: 404 }
      );
    }

    ensureSchema(db);

    const columns = getColumns(db, "access_requests");

    const userColumns = [
      "Utilisateur",
      "utilisateur",
      "employee_name",
      "employeeName",
      "full_name",
      "fullName",
      "nom_complet",
      "nom",
      "user",
    ].filter((col) => columns.includes(col));

    const whereUser =
      userColumns.length > 0
        ? userColumns.map((col) => `LOWER(${col}) = LOWER(?)`).join(" OR ")
        : "1 = 0";

    const params = userColumns.map(() => employeeName);

    let row: any = null;

    if (requestId > 0) {
      row = db
        .prepare(
          `
          SELECT *
          FROM access_requests
          WHERE id = ?
          AND status IN ('pending', 'waiting_current_user', 'waiting_release', 'authorized')
          LIMIT 1
          `
        )
        .get(requestId);
    }

    if (!row) {
      row = db
        .prepare(
          `
          SELECT *
          FROM access_requests
          WHERE (${whereUser})
          AND status IN ('pending', 'waiting_current_user', 'waiting_release', 'authorized')
          ORDER BY id DESC
          LIMIT 1
          `
        )
        .get(...params);
    }

    if (!row) {
      db.close();

      return NextResponse.json({
        success: true,
        cancelled: false,
        message: "Aucune demande active a annuler.",
      });
    }

    db.prepare(
      `
      UPDATE access_requests
      SET status = 'cancelled',
          current_user_response = 'cancelled_by_employee',
          response_message = 'Demande annulee par l''employe pour reformulation.',
          response_at = datetime('now', 'localtime')
      WHERE id = ?
      `
    ).run(row.id);

    db.close();

    return NextResponse.json({
      success: true,
      cancelled: true,
      requestId: row.id,
      message: "Demande annulee. Vous pouvez reformuler une nouvelle demande.",
    });
  } catch (error) {
    if (db) {
      try {
        db.close();
      } catch {}
    }

    console.error("Erreur cancel-my-request:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de l'annulation de la demande.",
      },
      { status: 500 }
    );
  }
}