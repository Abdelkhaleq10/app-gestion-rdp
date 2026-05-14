import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

export const dynamic = "force-dynamic";

type StatusData = {
  etat_poste: string;
  nombre_sessions_actives: number;
  date_verification: string;
};

type RequestBody = {
  fullName?: string;
  employeeName?: string;
  nom_complet?: string;
  utilisateur?: string;
  Utilisateur?: string;
  user?: string;
  name?: string;
  nom?: string;
  pcName?: string;
  pc_name?: string;
  priority?: string;
  reason?: string;
  message?: string;
};

type QueueRequest = {
  id: number;
  Utilisateur: string;
  priority: string;
  reason: string;
  message: string;
  priority_level: number;
  active_user_name?: string;
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
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function readStatusFile(): StatusData {
  const filePath = path.join("C:\\", "Logs", "RDP_Status.txt");

  if (!fs.existsSync(filePath)) {
    return {
      etat_poste: "Inconnu",
      nombre_sessions_actives: 0,
      date_verification: "",
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");

  const etatMatch =
    content.match(/etat_poste=(.*)/i) || content.match(/EtatPoste=(.*)/i);

  const sessionsMatch =
    content.match(/nombre_sessions_actives=(.*)/i) ||
    content.match(/NombreSessionsActives=(.*)/i);

  const dateMatch =
    content.match(/date_verification=(.*)/i) ||
    content.match(/DateVerification=(.*)/i);

  return {
    etat_poste: etatMatch?.[1]?.trim() || "Inconnu",
    nombre_sessions_actives: parseInt(sessionsMatch?.[1]?.trim() || "0", 10) || 0,
    date_verification: dateMatch?.[1]?.trim() || "",
  };
}

function cleanIp(ip: string): string {
  let value = normalizeText(ip);

  if (!value) return "N/A";
  if (value.startsWith("::ffff:")) value = value.replace("::ffff:", "");
  if (value === "::1") return "127.0.0.1";

  return value;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) return cleanIp(forwarded.split(",")[0]);
  if (realIp) return cleanIp(realIp);

  return "N/A";
}

function getEmployeeName(body: RequestBody): string {
  const name = normalizeText(
    body.fullName ||
      body.employeeName ||
      body.nom_complet ||
      body.utilisateur ||
      body.Utilisateur ||
      body.user ||
      body.name ||
      body.nom
  );

  return name || "Employe inconnu";
}

function getPriorityInfo(priority: unknown) {
  const key = normalizeKey(priority) || "normal";

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

function isPosteOccupe(status: StatusData): boolean {
  const etat = normalizeKey(status.etat_poste);

  return (
    etat === "occupe" ||
    etat === "occupee" ||
    status.nombre_sessions_actives > 0
  );
}

function columnExists(table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  return columns.some((item) => item.name === column);
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!columnExists(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureAccessRequestsColumns() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pc_name TEXT,
      ip TEXT,
      request_time TEXT,
      status TEXT,
      reason TEXT,
      Utilisateur TEXT
    )
    `
  ).run();

  addColumnIfMissing("access_requests", "priority", "TEXT DEFAULT 'normal'");
  addColumnIfMissing("access_requests", "message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "priority_level", "INTEGER DEFAULT 1");
  addColumnIfMissing("access_requests", "active_user_name", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "current_user_response", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_at", "TEXT DEFAULT ''");
}

function getActiveEmployeeName(): string {
  return "l'utilisateur actuellement connecte";
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

function getPriorityLabel(priority: string, reason: string) {
  const key = normalizeKey(priority || reason);
  return PRIORITIES[key]?.label || reason || "Normal";
}

function getActiveWaitingRequest(): QueueRequest | null {
  const row = db
    .prepare(
      `
      SELECT
        id,
        Utilisateur,
        priority,
        reason,
        message,
        priority_level,
        active_user_name
      FROM access_requests
      WHERE status = 'waiting_current_user'
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 1
      `
    )
    .get() as QueueRequest | undefined;

  return row || null;
}

function getWaitingReleaseRequest(): QueueRequest | null {
  const row = db
    .prepare(
      `
      SELECT
        id,
        Utilisateur,
        priority,
        reason,
        message,
        priority_level,
        active_user_name
      FROM access_requests
      WHERE status = 'waiting_release'
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 1
      `
    )
    .get() as QueueRequest | undefined;

  return row || null;
}

function rejectLowerPriorityRequests(params: {
  acceptedRequestId: number;
  acceptedPriorityLevel: number;
  acceptedEmployee: string;
}) {
  const message = `Demande refusee automatiquement car une demande plus prioritaire de ${params.acceptedEmployee} a ete traitee.`;

  const result = db
    .prepare(
      `
      UPDATE access_requests
      SET
        status = 'rejected',
        current_user_response = 'superseded',
        response_message = ?,
        response_at = ?
      WHERE id <> ?
        AND status IN ('pending', 'waiting_current_user')
        AND priority_level < ?
      `
    )
    .run(
      message,
      new Date().toISOString(),
      params.acceptedRequestId,
      params.acceptedPriorityLevel
    );

  return result.changes || 0;
}

function rejectNewRequestBecauseHigherExists(params: {
  requestId: number;
  activeEmployee: string;
}) {
  const message = `Demande refusee automatiquement car une demande plus prioritaire de ${params.activeEmployee} est deja en cours de traitement.`;

  db.prepare(
    `
    UPDATE access_requests
    SET
      status = 'rejected',
      current_user_response = 'superseded',
      response_message = ?,
      response_at = ?
    WHERE id = ?
    `
  ).run(message, new Date().toISOString(), params.requestId);

  return message;
}

function promoteRequestToWaiting(requestItem: QueueRequest, activeUserName: string) {
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
  ).run(activeUserName, waitingMessage, new Date().toISOString(), requestItem.id);

  notifyActiveRdpUser({
    requestId: requestItem.id,
    employeeName: requestItem.Utilisateur,
    priorityLabel: getPriorityLabel(requestItem.priority, requestItem.reason),
    reason: requestItem.reason,
    message: requestItem.message,
  });

  return waitingMessage;
}

function handlePriorityDecision(params: {
  requestId: number;
  employeeName: string;
  priorityKey: string;
  priorityLevel: number;
  reason: string;
  employeeMessage: string;
  activeUserName: string;
}) {
  const waitingRelease = getWaitingReleaseRequest();

  if (waitingRelease) {
    if (params.priorityLevel <= Number(waitingRelease.priority_level || 1)) {
      const rejectedMessage = rejectNewRequestBecauseHigherExists({
        requestId: params.requestId,
        activeEmployee: waitingRelease.Utilisateur,
      });

      return {
        status: "rejected",
        message: rejectedMessage,
        promoted: false,
        rejectedLowerCount: 0,
      };
    }

    const rejectedLowerCount = rejectLowerPriorityRequests({
      acceptedRequestId: params.requestId,
      acceptedPriorityLevel: params.priorityLevel,
      acceptedEmployee: params.employeeName,
    });

    const newRequest = db
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
        WHERE id = ?
        `
      )
      .get(params.requestId) as QueueRequest;

    const waitingMessage = promoteRequestToWaiting(newRequest, params.activeUserName);

    return {
      status: "waiting_current_user",
      message: waitingMessage,
      promoted: true,
      rejectedLowerCount,
    };
  }

  const activeWaiting = getActiveWaitingRequest();

  if (!activeWaiting) {
    const newRequest = db
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
        WHERE id = ?
        `
      )
      .get(params.requestId) as QueueRequest;

    const waitingMessage = promoteRequestToWaiting(newRequest, params.activeUserName);

    return {
      status: "waiting_current_user",
      message: waitingMessage,
      promoted: true,
      rejectedLowerCount: 0,
    };
  }

  if (params.priorityLevel > Number(activeWaiting.priority_level || 1)) {
    const rejectedLowerCount = rejectLowerPriorityRequests({
      acceptedRequestId: params.requestId,
      acceptedPriorityLevel: params.priorityLevel,
      acceptedEmployee: params.employeeName,
    });

    const newRequest = db
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
        WHERE id = ?
        `
      )
      .get(params.requestId) as QueueRequest;

    const waitingMessage = promoteRequestToWaiting(newRequest, params.activeUserName);

    return {
      status: "waiting_current_user",
      message: waitingMessage,
      promoted: true,
      rejectedLowerCount,
    };
  }

  const rejectedMessage = rejectNewRequestBecauseHigherExists({
    requestId: params.requestId,
    activeEmployee: activeWaiting.Utilisateur,
  });

  return {
    status: "rejected",
    message: rejectedMessage,
    promoted: false,
    rejectedLowerCount: 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    ensureAccessRequestsColumns();

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const employeeName = getEmployeeName(body);
    const pcName = normalizeText(body.pcName || body.pc_name || "PC employe");
    const ip = getClientIp(request);

    const priorityInfo = getPriorityInfo(body.priority);
    const reason = normalizeText(body.reason || priorityInfo.label);
    const employeeMessage = normalizeText(body.message || "");

    const status = readStatusFile();
    const occupe = isPosteOccupe(status);
    const requestTime = new Date().toISOString();

    if (!occupe) {
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
            active_user_name,
            current_user_response,
            response_message,
            response_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          pcName,
          ip,
          requestTime,
          "authorized",
          reason,
          employeeName,
          priorityInfo.key,
          employeeMessage,
          priorityInfo.level,
          "",
          "",
          "Poste libre. Acces autorise.",
          new Date().toISOString()
        );

      const requestId = Number(result.lastInsertRowid);

      return NextResponse.json({
        success: true,
        allowed: true,
        autorise: true,
        authorized: true,
        requestId,
        status: "authorized",
        statusLabel: "Autorisee",
        message: "Acces autorise. Le poste principal est libre.",
        employeeName,
        activeUserName: "",
        priority: priorityInfo.key,
        priorityLabel: priorityInfo.label,
        priorityLevel: priorityInfo.level,
        reason,
        employeeMessage,
        workstationStatus: "libre",
        etat_poste: status.etat_poste,
        nombre_sessions_actives: status.nombre_sessions_actives,
      });
    }

    const activeUserName = getActiveEmployeeName();

    const insertResult = db
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
          active_user_name,
          current_user_response,
          response_message,
          response_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        pcName,
        ip,
        requestTime,
        "pending",
        reason,
        employeeName,
        priorityInfo.key,
        employeeMessage,
        priorityInfo.level,
        "",
        "",
        "Demande enregistree. Elle sera traitee selon la priorite.",
        ""
      );

    const requestId = Number(insertResult.lastInsertRowid);

    const decision = handlePriorityDecision({
      requestId,
      employeeName,
      priorityKey: priorityInfo.key,
      priorityLevel: priorityInfo.level,
      reason,
      employeeMessage,
      activeUserName,
    });

    return NextResponse.json({
      success: true,
      allowed: false,
      autorise: false,
      authorized: false,
      requestId,
      status: decision.status,
      statusLabel:
        decision.status === "waiting_current_user"
          ? "En attente de reponse"
          : decision.status === "rejected"
          ? "Refusee automatiquement"
          : "En attente",
      message: decision.message,
      employeeName,
      activeUserName,
      priority: priorityInfo.key,
      priorityLabel: priorityInfo.label,
      priorityLevel: priorityInfo.level,
      reason,
      employeeMessage,
      workstationStatus: "occupe",
      etat_poste: status.etat_poste,
      nombre_sessions_actives: status.nombre_sessions_actives,
      promoted: decision.promoted,
      rejectedLowerCount: decision.rejectedLowerCount,
    });
  } catch (error) {
    console.error("Erreur /api/request-access:", error);

    return NextResponse.json(
      {
        success: false,
        allowed: false,
        autorise: false,
        authorized: false,
        status: "erreur",
        message: "Erreur serveur lors de la demande d'acces.",
      },
      { status: 500 }
    );
  }
}