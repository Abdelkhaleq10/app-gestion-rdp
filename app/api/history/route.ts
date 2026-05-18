import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";

const DB_PATH = "C:\\Logs\\rdp_access.db";

type DbRow = Record<string, any>;

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function safeNumber(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function pickValue(row: DbRow, names: string[], fallback = "") {
  for (const name of names) {
    if (
      row[name] !== undefined &&
      row[name] !== null &&
      String(row[name]).trim() !== ""
    ) {
      return String(row[name]).trim();
    }
  }

  return fallback;
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

function pickColumn(columns: string[], candidates: string[]) {
  for (const candidate of candidates) {
    if (columns.includes(candidate)) return candidate;
  }

  return null;
}

function isBadUserName(value: unknown) {
  const user = normalize(value);

  if (!user) return true;
  if (user === "-") return true;
  if (user === "n/a") return true;
  if (user.includes("acces direct non identifie")) return true;
  if (user.includes("acces direct")) return true;
  if (user === "utilisateur inconnu") return true;
  if (user === "unknown") return true;
  if (user === "administrateur") return true;
  if (user === "administrator") return true;
  if (user === "autocad_user") return true;

  return false;
}

function isGoodUserName(value: unknown) {
  return !isBadUserName(value);
}

function isValidIp(ip: string) {
  const clean = String(ip || "").trim().toLowerCase();

  if (!clean) return false;
  if (clean === "-") return false;
  if (clean === "n/a") return false;
  if (clean === "localhost") return false;

  return true;
}

function detectTypeIp(ip: string) {
  const clean = String(ip || "").trim();

  if (!isValidIp(clean)) return "-";

  if (clean.startsWith("127.") || clean === "::1") return "Locale";

  return "Distante";
}

function formatAction(action: string, session: string) {
  const text = `${action || ""} ${session || ""}`.trim();

  if (!text) return "-";

  const n = normalize(text);

  if (n.includes("reconnexion")) return "Reconnexion";
  if (n.includes("connexion")) return "Connexion";
  if (n.includes("deconnect")) return "Session deconnectee";
  if (n.includes("deconnexion")) return "Session deconnectee";
  if (n.includes("autorise")) return "Demande autorisee";
  if (n.includes("refus")) return "Demande refusee";

  return text;
}

function getIp(row: DbRow) {
  return pickValue(row, ["ip", "IP", "adresse_ip", "client_ip"], "N/A");
}

function getUser(row: DbRow) {
  return pickValue(
    row,
    [
      "utilisateur",
      "Utilisateur",
      "user",
      "username",
      "nom_utilisateur",
      "employee_name",
      "employeeName",
      "full_name",
      "fullName",
      "nom_complet",
      "nom",
    ],
    "Acces direct non identifie"
  );
}

function getSession(row: DbRow) {
  return pickValue(
    row,
    [
      "session",
      "nomSession",
      "nom_session",
      "session_name",
      "machine",
      "pc",
      "poste",
    ],
    "-"
  );
}

function buildIpUserMapFromHistory(rows: DbRow[]) {
  const map = new Map<string, string>();

  for (const row of rows) {
    const ip = getIp(row);
    const user = getUser(row);

    if (!isValidIp(ip)) continue;
    if (!isGoodUserName(user)) continue;

    if (!map.has(ip)) {
      map.set(ip, user);
    }
  }

  return map;
}

function buildIpUserMapFromRequests(db: Database.Database) {
  const map = new Map<string, string>();

  if (!tableExists(db, "access_requests")) return map;

  const columns = getColumns(db, "access_requests");

  const userCol =
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
    ]) || null;

  const ipCol =
    pickColumn(columns, [
      "ip",
      "IP",
      "client_ip",
      "adresse_ip",
      "pc_ip",
      "employee_ip",
    ]) || null;

  const idCol = pickColumn(columns, ["id"]) || "rowid";

  if (!userCol || !ipCol) return map;

  try {
    const rows = db
      .prepare(
        `
        SELECT ${userCol} AS utilisateur, ${ipCol} AS ip
        FROM access_requests
        WHERE ${ipCol} IS NOT NULL
        AND ${ipCol} != ''
        ORDER BY ${idCol} DESC
        LIMIT 1000
        `
      )
      .all() as { utilisateur?: string; ip?: string }[];

    for (const row of rows) {
      const ip = String(row.ip || "").trim();
      const user = String(row.utilisateur || "").trim();

      if (!isValidIp(ip)) continue;
      if (!isGoodUserName(user)) continue;

      if (!map.has(ip)) {
        map.set(ip, user);
      }
    }
  } catch {}

  return map;
}

function resolveUserName(rawUser: string, ip: string, historyIpMap: Map<string, string>, requestIpMap: Map<string, string>) {
  if (isGoodUserName(rawUser)) {
    return rawUser;
  }

  if (isValidIp(ip)) {
    const fromRequests = requestIpMap.get(ip);
    if (fromRequests && isGoodUserName(fromRequests)) return fromRequests;

    const fromHistory = historyIpMap.get(ip);
    if (fromHistory && isGoodUserName(fromHistory)) return fromHistory;
  }

  return "Acces direct non identifie";
}

function mapEvent(
  row: DbRow,
  historyIpMap: Map<string, string>,
  requestIpMap: Map<string, string>
) {
  const id = Number(row.id || row.ref_id || row.event_id || 0);

  const date = pickValue(row, ["date", "jour", "event_date"], "-");
  const heure = pickValue(row, ["heure", "time", "event_time"], "-");

  const ip = getIp(row);
  const rawUser = getUser(row);
  const utilisateur = resolveUserName(rawUser, ip, historyIpMap, requestIpMap);

  const session = getSession(row);
  const actionRaw = pickValue(
    row,
    ["action", "Action", "event_action"],
    session
  );

  return {
    id,
    date,
    heure,
    utilisateur,
    session: session || "-",
    nomSession: session || "-",
    ip,
    typeIP: detectTypeIp(ip),
    action: formatAction(actionRaw, session),
    refDb: `#${pickValue(row, ["ref_id", "event_id", "id"], String(id))}`,
  };
}

function applyFilters(items: ReturnType<typeof mapEvent>[], params: URLSearchParams) {
  const search = normalize(params.get("search") || params.get("q") || "");
  const date = normalize(params.get("date") || "");
  const action = normalize(params.get("action") || "");
  const typeIP = normalize(params.get("typeIP") || params.get("typeIp") || "");

  return items.filter((item) => {
    const global = normalize(
      [
        item.id,
        item.date,
        item.heure,
        item.utilisateur,
        item.session,
        item.ip,
        item.typeIP,
        item.action,
        item.refDb,
      ].join(" ")
    );

    if (search && !global.includes(search)) return false;
    if (date && normalize(item.date) !== date) return false;
    if (action && !normalize(item.action).includes(action)) return false;
    if (typeIP && normalize(item.typeIP) !== typeIP) return false;

    return true;
  });
}

export async function GET(request: NextRequest) {
  let db: Database.Database | null = null;

  try {
    const { searchParams } = new URL(request.url);

    const page = safeNumber(searchParams.get("page"), 1);
    const pageSize = Math.min(safeNumber(searchParams.get("pageSize"), 20), 100);
    const sort = normalize(searchParams.get("sort") || "recent");

    db = new Database(DB_PATH);

    if (!tableExists(db, "rdp_events")) {
      db.close();

      return NextResponse.json(
        {
          success: true,
          items: [],
          rows: [],
          data: [],
          history: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
          message: "Table rdp_events introuvable.",
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const columns = getColumns(db, "rdp_events");
    const orderCol = columns.includes("id") ? "id" : "rowid";

    const rows = db
      .prepare(
        `
        SELECT *
        FROM rdp_events
        ORDER BY ${orderCol} ${sort === "old" ? "ASC" : "DESC"}
        LIMIT 5000
        `
      )
      .all() as DbRow[];

    const historyIpMap = buildIpUserMapFromHistory(rows);
    const requestIpMap = buildIpUserMapFromRequests(db);

    db.close();

    const mapped = rows.map((row) => mapEvent(row, historyIpMap, requestIpMap));
    const filtered = applyFilters(mapped, searchParams);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return NextResponse.json(
      {
        success: true,
        items,
        rows: items,
        data: items,
        history: items,
        total,
        page: safePage,
        pageSize,
        totalPages,
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    if (db) {
      try {
        db.close();
      } catch {}
    }

    console.error("Erreur API history :", error);

    return NextResponse.json(
      {
        success: false,
        items: [],
        rows: [],
        data: [],
        history: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        message: "Erreur lors du chargement de l'historique RDP.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}