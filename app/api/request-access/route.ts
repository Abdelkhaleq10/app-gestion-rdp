import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import { execFile, execSync } from "child_process";

export const dynamic = "force-dynamic";

const DB_PATH = "C:\\Logs\\rdp_access.db";
const NOTIFY_SCRIPT_PATH = "C:\\script_RDP\\notify_rdp_user.ps1";

type RequestBody = {
  fullName?: string;
  employeeName?: string;
  nom_complet?: string;
  pcName?: string;
  pc_name?: string;
  priority?: string;
  reason?: string;
  message?: string;
};

const PRIORITIES: Record<string, { label: string; level: number }> = {
  urgent: { label: "Urgent", level: 5 },
  assistance: { label: "Assistance", level: 4 },
  verification: { label: "Verification", level: 3 },
  consultation: { label: "Consultation", level: 2 },
  impression: { label: "Impression", level: 2 },
  autre: { label: "Autre", level: 1 },
  other: { label: "Autre", level: 1 },
  normal: { label: "Autre", level: 1 },
};

const TECHNICAL_USERS = ["autocad_user", "s.cotti", "n/a", "na", "domaine", "domain"];

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function cleanIp(ip: string): string {
  let value = String(ip ?? "").trim();

  if (!value) return "IP inconnue";

  if (value.startsWith("::ffff:")) {
    value = value.replace("::ffff:", "");
  }

  if (value === "::1" || value === "127.0.0.1") {
    return "127.0.0.1";
  }

  return value;
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return cleanIp(forwardedFor.split(",")[0]);

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return cleanIp(realIp);

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cleanIp(cfConnectingIp);

  return "127.0.0.1";
}

function getPriority(priority: string | undefined) {
  const key = normalizeLower(priority);

  if (PRIORITIES[key]) {
    return {
      key,
      label: PRIORITIES[key].label,
      level: PRIORITIES[key].level,
    };
  }

  return {
    key: "autre",
    label: "Autre",
    level: 1,
  };
}

function isTechnicalUser(user: string): boolean {
  const value = normalizeLower(user);

  if (!value) return true;
  if (TECHNICAL_USERS.includes(value)) return true;
  if (value.startsWith("domaine")) return true;
  if (value.startsWith("domain")) return true;

  return false;
}

function getRealRdpSession(): {
  occupied: boolean;
  user: string;
  session: string;
  id: string;
  raw: string;
} {
  try {
    const output = execSync("query user", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.includes("UTILISATEUR") || line.includes("USERNAME")) {
        continue;
      }

      const isActive = /\bActif\b/i.test(line) || /\bActive\b/i.test(line);
      if (!isActive) continue;

      const cleanLine = line.replace(/^>/, "").trim();
      const parts = cleanLine.split(/\s+/);

      const user = parts[0] || "";
      const session = parts[1] || "";
      const id = parts.find((part) => /^\d+$/.test(part)) || "";

      const technical = isTechnicalUser(user);
      const localConsole = normalizeLower(session) === "console";

      // Important:
      // autocad_user / s.cotti / console local = PC responsable, donc pas occupe pour l'app.
      if (technical || localConsole) {
        continue;
      }

      return {
        occupied: true,
        user,
        session,
        id,
        raw: line,
      };
    }

    return {
      occupied: false,
      user: "",
      session: "",
      id: "",
      raw: output,
    };
  } catch {
    return {
      occupied: false,
      user: "",
      session: "",
      id: "",
      raw: "",
    };
  }
}

function runNotification(params: {
  requestId: number;
  employeeName: string;
  priorityLabel: string;
  reason: string;
  message: string;
}) {
  if (!fs.existsSync(NOTIFY_SCRIPT_PATH)) {
    console.log("Script notification introuvable:", NOTIFY_SCRIPT_PATH);
    return;
  }

  const args = [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    NOTIFY_SCRIPT_PATH,
    "-RequestId",
    String(params.requestId),
    "-EmployeeName",
    params.employeeName,
    "-Priority",
    params.priorityLabel,
    "-Reason",
    params.reason,
    "-Message",
    params.message,
  ];

  execFile("powershell.exe", args, { windowsHide: true }, (error, stdout, stderr) => {
    if (error) console.error("Erreur notification:", error.message);
    if (stdout) console.log("Notification stdout:", stdout);
    if (stderr) console.error("Notification stderr:", stderr);
  });
}

function ensureAccessRequestsTable(db: Database.Database) {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pc_name TEXT,
      ip TEXT,
      request_time TEXT,
      status TEXT,
      reason TEXT,
      Utilisateur TEXT,
      priority TEXT DEFAULT 'normal',
      message TEXT DEFAULT '',
      priority_level INTEGER DEFAULT 1,
      current_user_response TEXT DEFAULT '',
      response_message TEXT DEFAULT '',
      response_at TEXT DEFAULT ''
    )
    `
  ).run();
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((c) => c.name === column);
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  definition: string
) {
  if (!columnExists(db, table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureColumns(db: Database.Database) {
  addColumnIfMissing(db, "access_requests", "priority", "TEXT DEFAULT 'normal'");
  addColumnIfMissing(db, "access_requests", "message", "TEXT DEFAULT ''");
  addColumnIfMissing(db, "access_requests", "priority_level", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "access_requests", "current_user_response", "TEXT DEFAULT ''");
  addColumnIfMissing(db, "access_requests", "response_message", "TEXT DEFAULT ''");
  addColumnIfMissing(db, "access_requests", "response_at", "TEXT DEFAULT ''");
}

function getStatusLabel(status: string): string {
  if (status === "authorized") return "Autorisee";
  if (status === "rejected") return "Refusee";
  if (status === "waiting_current_user") return "En attente de reponse utilisateur";
  return "En attente";
}

export async function POST(req: NextRequest) {
  let db: Database.Database | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    const employeeName = normalizeText(
      body.fullName || body.employeeName || body.nom_complet
    );

    const pcName = normalizeText(body.pcName || body.pc_name || "PC inconnu");
    const clientIp = getClientIp(req);

    const priorityInfo = getPriority(body.priority);
    const reason = normalizeText(body.reason || priorityInfo.label);
    const employeeMessage = normalizeText(body.message || "");

    if (!employeeName) {
      return NextResponse.json(
        {
          success: false,
          message: "Nom employe obligatoire",
        },
        { status: 400 }
      );
    }

    db = new Database(DB_PATH);
    ensureAccessRequestsTable(db);
    ensureColumns(db);

    const rdpSession = getRealRdpSession();

    let status = "authorized";
    let responseMessage = "Poste libre. Acces autorise.";

    if (rdpSession.occupied) {
      status = "waiting_current_user";
      responseMessage =
        "Poste occupe. Demande envoyee a l'utilisateur actuellement connecte.";
    }

    const now = new Date().toISOString();

    const result = db
      .prepare(
        `
        INSERT INTO access_requests (
          pc_name,
          ip,
          request_time,
          status,
          reason,
          Utilisateur,
          priority,
          message,
          priority_level,
          current_user_response,
          response_message,
          response_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        pcName,
        clientIp,
        now,
        status,
        reason,
        employeeName,
        priorityInfo.key,
        employeeMessage,
        priorityInfo.level,
        "",
        responseMessage,
        ""
      );

    const requestId = Number(result.lastInsertRowid);

    if (status === "waiting_current_user") {
      runNotification({
        requestId,
        employeeName,
        priorityLabel: priorityInfo.label,
        reason,
        message: employeeMessage,
      });
    }

    return NextResponse.json({
      success: true,
      requestId,
      status,
      statusLabel: getStatusLabel(status),
      employeeName,
      ip: clientIp,
      pcName,
      priority: priorityInfo.key,
      priorityLabel: priorityInfo.label,
      priorityLevel: priorityInfo.level,
      reason,
      employeeMessage,
      message: responseMessage,
      workstationStatus: rdpSession.occupied ? "occupe" : "libre",
      currentRdpUser: rdpSession.user || "Aucun",
    });
  } catch (error: any) {
    console.error("Erreur request-access:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la creation de la demande",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  } finally {
    if (db) db.close();
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "API demande d'acces disponible",
  });
}