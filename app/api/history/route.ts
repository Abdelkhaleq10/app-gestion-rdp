import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/db";

export const dynamic = "force-dynamic";

type DbColumn = {
  name: string;
};

type HistoryItem = {
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
  source: "rdp" | "app";
  timestamp: number;
};

type ActiveSession = {
  utilisateur: string;
  ip: string;
  startTimestamp: number;
};

function tableExists(tableName: string) {
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(tableName) as { name?: string } | undefined;

  return Boolean(result?.name);
}

function getTableColumns(tableName: string): string[] {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as DbColumn[];
    return columns.map((col) => col.name);
  } catch {
    return [];
  }
}

function hasColumn(columns: string[], name: string) {
  return columns.includes(name);
}

function pickColumn(columns: string[], possibleNames: string[], fallbackSql: string) {
  const found = possibleNames.find((name) => hasColumn(columns, name));
  return found ? found : fallbackSql;
}

function normalizePositiveNumber(
  value: string | null,
  defaultValue: number,
  maxValue: number
) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return defaultValue;
  }

  return Math.min(Math.floor(numberValue), maxValue);
}

function normalizeText(value: unknown, fallback = "N/A") {
  const text = String(value ?? "").trim();

  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
    return fallback;
  }

  return text;
}

function normalizeUtilisateur(value: unknown) {
  const text = normalizeText(value, "Acces direct non identifie");

  if (text === "N/A" || text === "-") {
    return "Acces direct non identifie";
  }

  return text;
}

function looksLikeIp(value: unknown) {
  const text = String(value ?? "").trim();
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(text);
}

function normalizeIp(value: unknown) {
  const text = normalizeText(value, "N/A");

  if (text === "::1" || text === "127.0.0.1") {
    return "Locale";
  }

  if (text.startsWith("::ffff:")) {
    return text.replace("::ffff:", "");
  }

  return text;
}

function isValidRemoteIp(ip: string) {
  return Boolean(
    ip &&
      ip !== "N/A" &&
      ip !== "-" &&
      ip !== "Locale" &&
      looksLikeIp(ip)
  );
}

function detectTypeIP(ip: string, currentTypeIP?: unknown) {
  const current = normalizeText(currentTypeIP, "");

  if (current === "Distante" || current === "Locale" || current === "Inconnue") {
    return current;
  }

  if (current === "Inconnu") {
    return "Inconnue";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(current)) {
    // ignore old wrong value stored in type_ip
  } else if (current) {
    return current;
  }

  if (!ip || ip === "N/A" || ip === "-") {
    return "Inconnue";
  }

  if (ip === "Locale" || ip === "127.0.0.1" || ip === "::1") {
    return "Locale";
  }

  return "Distante";
}

function splitDateTime(value: unknown) {
  const text = normalizeText(value, "");

  if (!text) {
    return { date: "-", heure: "-" };
  }

  const matchFr = text.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/);

  if (matchFr) {
    return { date: matchFr[1], heure: matchFr[2] };
  }

  const matchIso = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})/);

  if (matchIso) {
    return {
      date: `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`,
      heure: matchIso[4],
    };
  }

  return { date: text, heure: "-" };
}

function parseDateTime(date: string, heure: string) {
  const cleanDate = normalizeText(date, "");
  const cleanHeure = normalizeText(heure, "00:00:00");

  const match = cleanDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    const parsed = new Date(`${year}-${month}-${day}T${cleanHeure || "00:00:00"}`).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = new Date(`${cleanDate}T${cleanHeure || "00:00:00"}`).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRdpAction(action: unknown, nomSession: string) {
  const actionText = normalizeText(action, "");
  const sessionText = normalizeText(nomSession, "").toLowerCase();

  if (actionText && actionText !== "N/A" && actionText !== "-") {
    const lowerAction = actionText.toLowerCase();

    if (lowerAction.includes("deconnexion") || lowerAction.includes("déconnexion")) {
      return "Deconnexion";
    }

    if (lowerAction.includes("reconnexion")) {
      return "Reconnexion";
    }

    if (lowerAction.includes("connexion")) {
      return "Connexion";
    }

    if (
      lowerAction.includes("session deconnectee") ||
      lowerAction.includes("session déconnectée")
    ) {
      return "Session deconnectee";
    }

    return actionText;
  }

  if (sessionText.includes("deconnexion") || sessionText.includes("déconnexion")) {
    return "Deconnexion";
  }

  if (sessionText.includes("session deconnect") || sessionText.includes("session déconnect")) {
    return "Session deconnectee";
  }

  if (sessionText.includes("reconnexion")) {
    return "Reconnexion";
  }

  if (sessionText.includes("connexion")) {
    return "Connexion";
  }

  return "N/A";
}

function normalizeRequestAction(status: string) {
  const value = status.toLowerCase();

  if (
    value.includes("autorise") ||
    value.includes("autorisée") ||
    value.includes("autorisee")
  ) {
    return "Demande autorisee";
  }

  if (
    value.includes("refuse") ||
    value.includes("refusée") ||
    value.includes("refusee")
  ) {
    return "Demande refusee";
  }

  return "Demande";
}

function isAuthorizedRequest(item: HistoryItem) {
  return item.source === "app" && item.action === "Demande autorisee";
}

function isRefusedRequest(item: HistoryItem) {
  return item.source === "app" && item.action === "Demande refusee";
}

function isUnknownUser(utilisateur: string) {
  const value = utilisateur.toLowerCase();

  return (
    !value ||
    value === "n/a" ||
    value === "-" ||
    value.includes("acces direct non identifie")
  );
}

function includesInsensitive(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase());
}

function readRdpEvents(): HistoryItem[] {
  if (!tableExists("rdp_events")) {
    return [];
  }

  const columns = getTableColumns("rdp_events");

  const idCol = pickColumn(columns, ["id"], "NULL");
  const dateCol = pickColumn(columns, ["date"], "''");
  const heureCol = pickColumn(columns, ["heure"], "''");

  const utilisateurCol = pickColumn(
    columns,
    ["utilisateur", "user", "username"],
    "'Acces direct non identifie'"
  );

  const sessionIdCol = pickColumn(columns, ["session_id", "sessionId"], "'N/A'");

  const nomSessionCol = pickColumn(
    columns,
    ["nom_session", "nomSession", "session", "sessionName", "session_name"],
    "'N/A'"
  );

  const ipCol = pickColumn(
    columns,
    ["ip", "adresseIP", "adresse_ip", "client_ip"],
    "'N/A'"
  );

  const typeIpCol = pickColumn(
    columns,
    ["type_ip", "typeIP", "typeIp"],
    "'Inconnue'"
  );

  const actionCol = pickColumn(columns, ["action"], "''");

  const sessionActiveCol = pickColumn(
    columns,
    ["session_active", "sessionActive"],
    "'N/A'"
  );

  const rows = db
    .prepare(`
      SELECT
        ${idCol} AS id,
        ${dateCol} AS date,
        ${heureCol} AS heure,
        ${utilisateurCol} AS utilisateur,
        ${sessionIdCol} AS sessionId,
        ${nomSessionCol} AS nomSession,
        ${ipCol} AS ip,
        ${typeIpCol} AS typeIP,
        ${actionCol} AS action,
        ${sessionActiveCol} AS sessionActive
      FROM rdp_events
    `)
    .all() as any[];

  return rows.map((row) => {
    const nomSession = normalizeText(row.nomSession, "N/A");

    let sessionId = normalizeText(row.sessionId, "N/A");
    let ip = normalizeIp(row.ip);

    // Correction old wrong rows: IP was stored in session_id
    if ((ip === "N/A" || ip === "-") && looksLikeIp(sessionId)) {
      ip = sessionId;
      sessionId = "N/A";
    }

    const date = normalizeText(row.date, "-");
    const heure = normalizeText(row.heure, "-");
    const action = normalizeRdpAction(row.action, nomSession);

    return {
      id: Number(row.id || 0),
      date,
      heure,
      utilisateur: normalizeUtilisateur(row.utilisateur),
      sessionId,
      nomSession,
      ip,
      typeIP: detectTypeIP(ip, row.typeIP),
      action,
      sessionActive: normalizeText(row.sessionActive, "N/A"),
      source: "rdp",
      timestamp: parseDateTime(date, heure),
    };
  });
}

function readAccessRequests(): HistoryItem[] {
  if (!tableExists("access_requests")) {
    return [];
  }

  const columns = getTableColumns("access_requests");

  const idCol = pickColumn(columns, ["id"], "NULL");

  const utilisateurCol = pickColumn(
    columns,
    ["utilisateur", "Utilisateur", "user", "username", "nom", "name"],
    "'Utilisateur non identifie'"
  );

  const ipCol = pickColumn(
    columns,
    ["ip", "client_ip", "adresseIP", "adresse_ip"],
    "'N/A'"
  );

  const requestTimeCol = pickColumn(
    columns,
    ["request_time", "requestTime", "date_demande", "created_at"],
    "''"
  );

  const statusCol = pickColumn(columns, ["status", "statut"], "'N/A'");
  const reasonCol = pickColumn(columns, ["reason", "raison"], "'N/A'");

  const rows = db
    .prepare(`
      SELECT
        ${idCol} AS id,
        ${utilisateurCol} AS utilisateur,
        ${ipCol} AS ip,
        ${requestTimeCol} AS request_time,
        ${statusCol} AS status,
        ${reasonCol} AS reason
      FROM access_requests
    `)
    .all() as any[];

  return rows.map((row) => {
    const { date, heure } = splitDateTime(row.request_time);
    const ip = normalizeIp(row.ip);
    const status = normalizeText(row.status, "N/A");
    const reason = normalizeText(row.reason, "N/A");
    const action = normalizeRequestAction(status);

    return {
      id: 900000 + Number(row.id || 0),
      date,
      heure,
      utilisateur: normalizeUtilisateur(row.utilisateur),
      sessionId: "N/A",
      nomSession: reason,
      ip,
      typeIP: detectTypeIP(ip),
      action,
      sessionActive: "N/A",
      source: "app",
      timestamp: parseDateTime(date, heure),
    };
  });
}

function linkRdpEventsWithAppRequests(items: HistoryItem[]) {
  const sorted = [...items].sort((a, b) => {
    return a.timestamp - b.timestamp || a.id - b.id;
  });

  const activeByIp = new Map<string, ActiveSession>();
  let lastAuthorized: ActiveSession | null = null;

  const linked = sorted.map((item) => {
    const nextItem = { ...item };

    // Demande autorisee: store user by IP
    if (isAuthorizedRequest(nextItem)) {
      const activeSession: ActiveSession = {
        utilisateur: nextItem.utilisateur,
        ip: nextItem.ip,
        startTimestamp: nextItem.timestamp,
      };

      if (isValidRemoteIp(nextItem.ip)) {
        activeByIp.set(nextItem.ip, activeSession);
      }

      lastAuthorized = activeSession;
      return nextItem;
    }

    // Demande refusee: do not change active user
    if (isRefusedRequest(nextItem)) {
      return nextItem;
    }

    // RDP events from Windows
    if (nextItem.source === "rdp" && isUnknownUser(nextItem.utilisateur)) {
      let match: ActiveSession | null = null;

      // Best match: same IP
      if (isValidRemoteIp(nextItem.ip)) {
        match = activeByIp.get(nextItem.ip) || null;
      }

      // Fallback only if RDP event has no IP
      if (!match && !isValidRemoteIp(nextItem.ip) && lastAuthorized) {
        const diffMs = nextItem.timestamp - lastAuthorized.startTimestamp;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffMs >= -2 * 60 * 1000 && diffHours <= 12) {
          match = lastAuthorized;
        }
      }

      if (match) {
        nextItem.utilisateur = match.utilisateur;

        if (!isValidRemoteIp(nextItem.ip) && isValidRemoteIp(match.ip)) {
          nextItem.ip = match.ip;
          nextItem.typeIP = detectTypeIP(match.ip);
        }

        if (isValidRemoteIp(nextItem.ip)) {
          nextItem.typeIP = detectTypeIP(nextItem.ip);
        }
      }
    }

    return nextItem;
  });

  return linked;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = normalizePositiveNumber(searchParams.get("page"), 1, 100000);
    const pageSize = normalizePositiveNumber(
      searchParams.get("pageSize") || searchParams.get("limit"),
      20,
      200
    );

    const search = (searchParams.get("search") || "").trim();
    const actionFilter = (searchParams.get("action") || "").trim();
    const typeIPFilter = (searchParams.get("typeIP") || "").trim();
    const dateFilter = (searchParams.get("date") || "").trim();
    const sort = (searchParams.get("sort") || "recent").trim();

    let items: HistoryItem[] = [
      ...readRdpEvents(),
      ...readAccessRequests(),
    ];

    items = linkRdpEventsWithAppRequests(items);

    if (search) {
      items = items.filter((item) => {
        const values = [
          String(item.id),
          item.date,
          item.heure,
          item.utilisateur,
          item.sessionId,
          item.nomSession,
          item.ip,
          item.typeIP,
          item.action,
          item.sessionActive,
        ];

        return values.some((value) => includesInsensitive(value, search));
      });
    }

    if (actionFilter) {
      items = items.filter((item) => item.action === actionFilter);
    }

    if (typeIPFilter) {
      items = items.filter((item) => item.typeIP === typeIPFilter);
    }

    if (dateFilter) {
      items = items.filter((item) => item.date === dateFilter);
    }

    items.sort((a, b) => {
      if (sort === "oldest") {
        return a.timestamp - b.timestamp || a.id - b.id;
      }

      return b.timestamp - a.timestamp || b.id - a.id;
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);

    return NextResponse.json({
      success: true,

      // page.tsx uses items
      items: paginatedItems,

      // compatibility
      data: paginatedItems,
      history: paginatedItems,
      events: paginatedItems,
      rows: paginatedItems,

      total,
      page: safePage,
      pageSize,
      limit: pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Erreur API history:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la recuperation de l'historique RDP.",
        items: [],
        data: [],
        history: [],
        events: [],
        rows: [],
        total: 0,
        page: 1,
        pageSize: 20,
        limit: 20,
        totalPages: 1,
      },
      { status: 500 }
    );
  }
}