import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

export const dynamic = "force-dynamic";

const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";

type QueueRequest = {
  id: number;
  Utilisateur: string;
  priority: string;
  reason: string;
  message: string;
  priority_level: number;
};

const PRIORITIES: Record<string, { label: string; level: number }> = {
  urgent: { label: "Urgent", level: 5 },
  assistance: { label: "Assistance", level: 4 },
  verification: { label: "Verification", level: 3 },
  impression: { label: "Impression", level: 2 },
  consultation: { label: "Consultation", level: 2 },
  autre: { label: "Autre", level: 1 },
  other: { label: "Autre", level: 1 },
  normal: { label: "Normal", level: 1 },
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

  const names = columns.map((column) => column.name);

  function addColumnIfMissing(column: string, definition: string) {
    if (!names.includes(column)) {
      db.prepare(`ALTER TABLE access_requests ADD COLUMN ${column} ${definition}`).run();
    }
  }

  addColumnIfMissing("priority", "TEXT DEFAULT 'normal'");
  addColumnIfMissing("message", "TEXT DEFAULT ''");
  addColumnIfMissing("priority_level", "INTEGER DEFAULT 1");
  addColumnIfMissing("active_user_name", "TEXT DEFAULT ''");
  addColumnIfMissing("current_user_response", "TEXT DEFAULT ''");
  addColumnIfMissing("response_message", "TEXT DEFAULT ''");
  addColumnIfMissing("response_at", "TEXT DEFAULT ''");
}

function getExistingRequest(db: Database.Database, requestId: number) {
  return db
    .prepare(
      `
      SELECT
        id,
        status,
        Utilisateur,
        active_user_name,
        current_user_response,
        response_message,
        priority_level
      FROM access_requests
      WHERE id = ?
      `
    )
    .get(requestId) as
    | {
        id: number;
        status: string;
        Utilisateur: string;
        active_user_name: string;
        current_user_response: string;
        response_message: string;
        priority_level: number;
      }
    | undefined;
}

function getActiveUserName(existingActiveName: string, sessionUser: string) {
  const activeName = normalizeText(existingActiveName);
  if (activeName) return activeName;

  const sessionName = normalizeText(sessionUser);
  if (sessionName) return sessionName;

  return "l'utilisateur actuellement connecte";
}

function getFinalStatusAndMessage(response: string, activeUserName: string) {
  const value = normalizeKey(response);

  if (value === "accepted") {
    return {
      status: "waiting_release",
      message: `${activeUserName} a accepte de liberer la session. Veuillez patienter jusqu'a la fermeture de sa session.`,
    };
  }

  if (value === "rejected") {
    return {
      status: "rejected",
      message: `Demande refusee par ${activeUserName}.`,
    };
  }

  if (value === "timeout") {
    return {
      status: "rejected",
      message: "Aucune reponse recue. La demande a ete refusee automatiquement.",
    };
  }

  if (value === "no_active_session") {
    return {
      status: "pending",
      message: "Aucune session active trouvee. La demande reste en attente.",
    };
  }

  if (value === "error") {
    return {
      status: "pending",
      message: "Erreur lors de l'envoi de la notification. La demande reste en attente.",
    };
  }

  return {
    status: "pending",
    message: "Reponse inconnue. La demande reste en attente.",
  };
}

function getPriorityLabel(priority: string, reason: string) {
  const key = normalizeKey(priority || reason);
  return PRIORITIES[key]?.label || reason || "Normal";
}

function hasActiveQueueRequest(db: Database.Database): boolean {
  const row = db
    .prepare(
      `
      SELECT id
      FROM access_requests
      WHERE status IN ('waiting_current_user', 'waiting_release')
      ORDER BY id DESC
      LIMIT 1
      `
    )
    .get() as { id: number } | undefined;

  return Boolean(row?.id);
}

function getBestPendingRequest(db: Database.Database): QueueRequest | null {
  const row = db
    .prepare(
      `
      SELECT
        id,
        Utilisateur,
        priority,
        reason,
        message,
        priority_level
      FROM access_requests
      WHERE status = 'pending'
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 1
      `
    )
    .get() as QueueRequest | undefined;

  return row || null;
}

function rejectLowerPriorityRequests(
  db: Database.Database,
  acceptedRequestId: number,
  acceptedPriorityLevel: number,
  acceptedEmployee: string
) {
  const message = `Demande refusee automatiquement car une demande plus prioritaire de ${acceptedEmployee} a ete acceptee.`;

  const result = db
    .prepare(
      `
      UPDATE access_requests
      SET
        status = 'rejected',
        current_user_response = 'superseded',
        response_message = ?,
        response_at = datetime('now')
      WHERE id <> ?
        AND status IN ('pending', 'waiting_current_user')
        AND priority_level < ?
      `
    )
    .run(message, acceptedRequestId, acceptedPriorityLevel);

  return result.changes || 0;
}

function rejectOtherEqualOrLowerActiveRequests(
  db: Database.Database,
  acceptedRequestId: number,
  acceptedPriorityLevel: number,
  acceptedEmployee: string
) {
  const message = `Demande refusee automatiquement car la demande de ${acceptedEmployee} a ete acceptee.`;

  const result = db
    .prepare(
      `
      UPDATE access_requests
      SET
        status = 'rejected',
        current_user_response = 'superseded',
        response_message = ?,
        response_at = datetime('now')
      WHERE id <> ?
        AND status IN ('waiting_current_user')
        AND priority_level <= ?
      `
    )
    .run(message, acceptedRequestId, acceptedPriorityLevel);

  return result.changes || 0;
}

function notifyActiveRdpUser(params: {
  requestId: number;
  employeeName: string;
  priorityLabel: string;
  reason: string;
  message: string;
}) {
  const scriptPath = "C:\\script_RDP\\notify_rdp_user.ps1";

  if (!fs.existsSync(scriptPath)) {
    console.error("Script notification introuvable:", scriptPath);
    return;
  }

  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
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
    ],
    { windowsHide: true },
    (error, stdout, stderr) => {
      if (error) {
        console.error("Erreur notification RDP:", error.message);
        return;
      }

      if (stderr) console.error("Notification RDP stderr:", stderr);
      if (stdout) console.log("Notification RDP stdout:", stdout);
    }
  );
}

function promoteBestPendingRequest(
  db: Database.Database,
  activeUserName: string
): QueueRequest | null {
  if (hasActiveQueueRequest(db)) {
    return null;
  }

  const nextRequest = getBestPendingRequest(db);

  if (!nextRequest) {
    return null;
  }

  const waitingMessage =
    activeUserName === "l'utilisateur actuellement connecte"
      ? "Demande envoyee a l'utilisateur actuellement connecte. En attente de sa reponse."
      : `Demande envoyee a ${activeUserName}. En attente de sa reponse.`;

  db.prepare(
    `
    UPDATE access_requests
    SET
      status = 'waiting_current_user',
      active_user_name = ?,
      current_user_response = '',
      response_message = ?,
      response_at = ?
    WHERE id = ?
    `
  ).run(activeUserName, waitingMessage, new Date().toISOString(), nextRequest.id);

  notifyActiveRdpUser({
    requestId: nextRequest.id,
    employeeName: nextRequest.Utilisateur,
    priorityLabel: getPriorityLabel(nextRequest.priority, nextRequest.reason),
    reason: nextRequest.reason,
    message: nextRequest.message,
  });

  return nextRequest;
}

export async function GET() {
  let db: Database.Database | null = null;

  try {
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json(
        {
          success: false,
          message: "Base de donnees introuvable.",
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
    let promoted = 0;
    let autoRejected = 0;

    const details: Array<{
      file: string;
      requestId: number | null;
      response: string;
      activeUserName: string;
      status: string;
      updated: boolean;
      promotedNextRequestId?: number;
      autoRejectedCount?: number;
      reason?: string;
    }> = [];

    for (const file of files) {
      processed++;

      const filePath = path.join(RESPONSE_DIR, file);
      const data = parseResponseFile(filePath);

      const requestId = Number(normalizeText(data.request_id));
      const response = normalizeText(data.response);
      const sessionUser = normalizeText(data.session_user);
      const responseDate = normalizeText(data.date) || new Date().toISOString();

      if (!requestId || Number.isNaN(requestId)) {
        skipped++;

        details.push({
          file,
          requestId: null,
          response,
          activeUserName: "",
          status: "invalid_request_id",
          updated: false,
          reason: "Identifiant de demande invalide.",
        });

        continue;
      }

      const existing = getExistingRequest(db, requestId);

      if (!existing) {
        skipped++;

        details.push({
          file,
          requestId,
          response,
          activeUserName: "",
          status: "request_not_found",
          updated: false,
          reason: "Demande introuvable dans la base de donnees.",
        });

        continue;
      }

      const existingStatus = normalizeKey(existing.status);
      const currentStoredResponse = normalizeKey(existing.current_user_response);

      if (existingStatus !== "waiting_current_user") {
        skipped++;

        details.push({
          file,
          requestId,
          response,
          activeUserName: normalizeText(existing.active_user_name),
          status: existing.status,
          updated: false,
          reason: "Reponse ignoree car la demande n'est plus active.",
        });

        continue;
      }

      if (currentStoredResponse && currentStoredResponse === normalizeKey(response)) {
        skipped++;

        details.push({
          file,
          requestId,
          response,
          activeUserName: normalizeText(existing.active_user_name),
          status: existing.status,
          updated: false,
          reason: "Reponse deja synchronisee.",
        });

        continue;
      }

      const activeUserName = getActiveUserName(existing.active_user_name, sessionUser);
      const finalResult = getFinalStatusAndMessage(response, activeUserName);

      db.prepare(
        `
        UPDATE access_requests
        SET
          status = ?,
          current_user_response = ?,
          response_message = ?,
          response_at = ?,
          active_user_name = ?
        WHERE id = ?
        `
      ).run(
        finalResult.status,
        response,
        finalResult.message,
        responseDate,
        activeUserName,
        requestId
      );

      updated++;

      let promotedNextRequestId: number | undefined;
      let autoRejectedCount = 0;

      if (finalResult.status === "waiting_release") {
        autoRejectedCount += rejectLowerPriorityRequests(
          db,
          requestId,
          Number(existing.priority_level || 1),
          existing.Utilisateur
        );

        autoRejectedCount += rejectOtherEqualOrLowerActiveRequests(
          db,
          requestId,
          Number(existing.priority_level || 1),
          existing.Utilisateur
        );

        autoRejected += autoRejectedCount;
      }

      if (finalResult.status === "rejected") {
        const nextRequest = promoteBestPendingRequest(db, activeUserName);

        if (nextRequest) {
          promoted++;
          promotedNextRequestId = nextRequest.id;
        }
      }

      details.push({
        file,
        requestId,
        response,
        activeUserName,
        status: finalResult.status,
        updated: true,
        promotedNextRequestId,
        autoRejectedCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Synchronisation des reponses terminee.",
      processed,
      updated,
      skipped,
      promoted,
      autoRejected,
      details,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la synchronisation des reponses.",
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