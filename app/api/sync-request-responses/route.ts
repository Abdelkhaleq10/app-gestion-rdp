import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseResponseFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  const data: Record<string, string> = {};

  for (const line of lines) {
    const index = line.indexOf("=");

    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();

    data[key] = value;
  }

  return data;
}

function ensureColumns(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(access_requests)").all() as Array<{
    name: string;
  }>;

  const names = columns.map((c) => c.name);

  function addColumnIfMissing(column: string, definition: string) {
    if (!names.includes(column)) {
      db.prepare(`ALTER TABLE access_requests ADD COLUMN ${column} ${definition}`).run();
    }
  }

  addColumnIfMissing("current_user_response", "TEXT DEFAULT ''");
  addColumnIfMissing("response_message", "TEXT DEFAULT ''");
  addColumnIfMissing("response_at", "TEXT DEFAULT ''");
}

function getFinalStatus(response: string): {
  status: string;
  responseMessage: string;
} {
  const value = normalizeText(response).toLowerCase();

  if (value === "accepted") {
    return {
      status: "authorized",
      responseMessage: "L'utilisateur actif a accepte de liberer la session.",
    };
  }

  if (value === "rejected") {
    return {
      status: "rejected",
      responseMessage: "L'utilisateur actif a refuse de liberer la session.",
    };
  }

  if (value === "timeout") {
    return {
      status: "rejected",
      responseMessage: "Aucune reponse recue. La demande a ete refusee automatiquement.",
    };
  }

  if (value === "no_active_session") {
    return {
      status: "pending",
      responseMessage: "Aucune session active trouvee. La demande reste en attente.",
    };
  }

  if (value === "error") {
    return {
      status: "pending",
      responseMessage: "Erreur lors de l'envoi de la notification. La demande reste en attente.",
    };
  }

  return {
    status: "pending",
    responseMessage: "Reponse inconnue. La demande reste en attente.",
  };
}

export async function GET() {
  let db: Database.Database | null = null;

  try {
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json(
        {
          success: false,
          message: "Base de donnees introuvable",
          dbPath: DB_PATH,
        },
        { status: 404 }
      );
    }

    if (!fs.existsSync(RESPONSE_DIR)) {
      fs.mkdirSync(RESPONSE_DIR, { recursive: true });
    }

    db = new Database(DB_PATH);
    ensureColumns(db);

    const files = fs
      .readdirSync(RESPONSE_DIR)
      .filter((file) => file.startsWith("request_") && file.endsWith(".txt"));

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    const details: Array<{
      file: string;
      requestId: number | null;
      response: string;
      status: string;
      updated: boolean;
    }> = [];

    for (const file of files) {
      const filePath = path.join(RESPONSE_DIR, file);
      const data = parseResponseFile(filePath);

      const requestIdText = normalizeText(data.request_id);
      const requestId = Number(requestIdText);
      const response = normalizeText(data.response);
      const sessionUser = normalizeText(data.session_user);
      const responseDate = normalizeText(data.date) || new Date().toISOString();

      processed++;

      if (!requestId || Number.isNaN(requestId)) {
        skipped++;
        details.push({
          file,
          requestId: null,
          response,
          status: "invalid_request_id",
          updated: false,
        });
        continue;
      }

      const existing = db
        .prepare("SELECT id, status FROM access_requests WHERE id = ?")
        .get(requestId) as { id: number; status: string } | undefined;

      if (!existing) {
        skipped++;
        details.push({
          file,
          requestId,
          response,
          status: "request_not_found",
          updated: false,
        });
        continue;
      }

      const final = getFinalStatus(response);

      db.prepare(
        `
        UPDATE access_requests
        SET
          status = ?,
          current_user_response = ?,
          response_message = ?,
          response_at = ?
        WHERE id = ?
        `
      ).run(
        final.status,
        response,
        sessionUser
          ? `${final.responseMessage} Utilisateur actif: ${sessionUser}.`
          : final.responseMessage,
        responseDate,
        requestId
      );

      updated++;

      details.push({
        file,
        requestId,
        response,
        status: final.status,
        updated: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Synchronisation des reponses terminee",
      processed,
      updated,
      skipped,
      details,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur sync-request-responses",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  } finally {
    if (db) {
      db.close();
    }
  }
}

export async function POST() {
  return GET();
}