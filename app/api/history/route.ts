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
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
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

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isTechnicalOrInvalidUser(value: unknown) {
  const user = normalizeKey(value);

  if (!user) return true;
  if (user === "n/a") return true;
  if (user === "na") return true;
  if (user === "-") return true;
  if (user === "unknown") return true;
  if (user === "autocad_user") return true;
  if (user === "autocad-user") return true;
  if (user === "s.cotti") return true;
  if (user.startsWith("domaine")) return true;
  if (user.startsWith("domain")) return true;
  if (user.includes("acces direct non identifie")) return true;

  return false;
}

function normalizeUtilisateur(value: unknown) {
  const text = normalizeText(value, "");

  if (isTechnicalOrInvalidUser(text)) {
    return "Acces direct non identifie";
  }

  return text;
}

function looksLikeIp(value: unknown) {
  const text = String(value ?? "").trim().replace("::ffff:", "");
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(text);
}

function normalizeIp(value: unknown) {
  const text = normalizeText(value, "N/A");

  if (text === "::1") return "127.0.0.1";
  if (text === "127.0.0.1") return "127.0.0.1";

  if (text.startsWith("::ffff:")) {
    return text.replace("::ffff:", "");
  }

  if (!text || text === "-" || normalizeKey(text) === "n/a") {
    return "N/A";
  }

  return text;
}

function isValidRemoteIp(ip: string) {
  return Boolean(
    ip &&
      ip !== "N/A" &&
      ip !== "-" &&
      ip !== "127.0.0.1" &&
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

  if (ip === "127.0.0.1" || ip === "::1") {
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

  const matchIsoShort = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);

  if (matchIsoShort) {
    return {
      date: `${matchIsoShort[3]}/${matchIsoShort[2]}/${matchIsoShort[1]}`,
      heure: `${matchIsoShort[4]}:00`,
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

    if (lowerAction.includes("reconnexion")) {
      return "Reconnexion";
    }

    if (lowerAction.includes("deconnexion") || lowerAction.includes("deconnexion")) {
      return "Deconnexion";
    }

    if (
      lowerAction.includes("session deconnectee") ||
      lowerAction.includes("session deconnectee")
    ) {
      return "Session deconnectee";
    }

    if (lowerAction.includes("connexion")) {
      return "Connexion";
    }

    return actionText;
  }

  if (sessionText.includes("reconnexion")) {
    return "Reconnexion";
  }

  if (sessionText.includes("session deconnect")) {
    return "Session deconnectee";
  }

  if (sessionText.includes("deconnexion")) {
    return "Deconnexion";
  }

  if (sessionText.includes("connexion")) {
    return "Connexion";
  }

  return "Evenement RDP";
}

function normalizeRequestStatus(status: unknown) {
  const value = normalizeKey(status);

  if (
    value === "authorized" ||
    value === "autorise" ||
    value === "autorisee" ||
    value.includes("autor")
  ) {
    return "authorized";
  }

  if (
    value === "rejected" ||
    value === "refuse" ||
    value === "refusee" ||
    value.includes("refus")
  ) {
    return "rejected";
  }

  if (value === "waiting_current_user") {
    return "waiting_current_user";
  }

  if (value === "waiting_release") {
    return "waiting_release";
  }

  if (value === "pending") {
    return "pending";
  }

  return "pending";
}

function normalizeRequestAction(status: unknown) {
  const value = normalizeRequestStatus(status);

  if (value === "authorized") return "Demande autorisee";
  if (value === "rejected") return "Demande refusee";
  if (value === "waiting_current_user") return "Demande en attente de reponse";
  if (value === "waiting_release") return "Demande en attente de liberation";

  return "Demande en attente";
}

function isAuthorizedRequest(item: HistoryItem) {
  return item.source === "app" && item.action === "Demande autorisee";
}

function isRefusedRequest(item: HistoryItem) {
  return item.source === "app" && item.action === "Demande refusee";
}

function isUnknownUser(utilisateur: string) {
  return isTechnicalOrInvalidUser(utilisateur);
}

function includesInsensitive(value: string, search: string) {
  return normalizeKey(value).includes(normalizeKey(search));
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

    if ((ip === "N/A" || ip === "-") && looksLikeIp(sessionId)) {
      ip = normalizeIp(sessionId);
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
    const status = normalizeRequestStatus(row.status);
    const reason = normalizeText(row.reason, "Demande d'acces");
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

    if (isAuthorizedRequest(nextItem)) {
      const activeSession: ActiveSession = {
        utilisateur: nextItem.utilisateur,
        ip: nextItem.ip,
        startTimestamp: nextItem.timestamp,
      };

      if (!isTechnicalOrInvalidUser(nextItem.utilisateur)) {
        if (isValidRemoteIp(nextItem.ip)) {
          activeByIp.set(nextItem.ip, activeSession);
        }

        lastAuthorized = activeSession;
      }

      return nextItem;
    }

    if (isRefusedRequest(nextItem)) {
      return nextItem;
    }

    if (nextItem.source === "rdp" && isUnknownUser(nextItem.utilisateur)) {
      let match: ActiveSession | null = null;

      if (isValidRemoteIp(nextItem.ip)) {
        match = activeByIp.get(nextItem.ip) || null;
      }

      if (!match && !isValidRemoteIp(nextItem.ip) && lastAuthorized) {
        const diffMs = nextItem.timestamp - lastAuthorized.startTimestamp;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffMs >= -2 * 60 * 1000 && diffHours <= 12) {
          match = lastAuthorized;
        }
      }

      if (match && !isTechnicalOrInvalidUser(match.utilisateur)) {
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

    if (isTechnicalOrInvalidUser(nextItem.utilisateur)) {
      nextItem.utilisateur = "Acces direct non identifie";
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

    const search = normalizeText(searchParams.get("search"), "");
    const actionFilter = normalizeText(searchParams.get("action"), "");
    const typeIPFilter = normalizeText(searchParams.get("typeIP"), "");
    const dateFilter = normalizeText(searchParams.get("date"), "");
    const sort = normalizeText(searchParams.get("sort"), "recent");

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
      items = items.filter((item) => normalizeKey(item.action) === normalizeKey(actionFilter));
    }

    if (typeIPFilter) {
      items = items.filter((item) => normalizeKey(item.typeIP) === normalizeKey(typeIPFilter));
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
      items: paginatedItems,
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