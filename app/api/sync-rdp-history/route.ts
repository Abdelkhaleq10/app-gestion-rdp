import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "../../../lib/db";

type CsvRecord = Record<string, string>;

type NormalizedRdpRow = {
  date: string;
  heure: string;
  utilisateur: string;
  machine: string;
  session_id: string;
  nom_session: string;
  ip: string;
  type_ip: string;
  action: string;
  session_active: string;
  event_timestamp: number;
};

type AccessRequest = {
  id?: number;
  Utilisateur?: string;
  utilisateur?: string;
  ip?: string;
  request_time?: string;
  status?: string;
  reason?: string;
  timestamp?: number;
};

const SERVER_IP = "10.102.104.44";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalize(value: unknown) {
  return String(value || "").trim();
}

function normalizeHeader(value: string) {
  return normalize(value)
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function cleanIp(value: string) {
  let ip = normalize(value);

  if (!ip) return "N/A";
  if (ip === "-") return "N/A";
  if (ip.toLowerCase() === "local") return "N/A";
  if (ip === "::1") return "127.0.0.1";

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
}

function isValidIp(value: string) {
  const ip = cleanIp(value);
  return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(ip);
}

function isServerIp(value: string) {
  return cleanIp(value) === SERVER_IP;
}

function getTypeIp(ip: string) {
  const clean = cleanIp(ip);

  if (isValidIp(clean)) {
    return "Distante";
  }

  return "Inconnue";
}

function isTechnicalOrBadUser(value: string) {
  const user = normalize(value).toLowerCase();

  if (!user) return true;
  if (user === "n/a") return true;
  if (user === "-") return true;
  if (user === "autocad_user") return true;
  if (user === "s.cotti") return true;
  if (user.includes("acces direct non identifie")) return true;

  return false;
}

function isRdpAction(action: string) {
  const value = normalize(action).toLowerCase();

  if (value.includes("connexion")) return true;
  if (value.includes("reconnexion")) return true;
  if (value.includes("deconnexion")) return true;
  if (value.includes("deconnectee")) return true;

  return false;
}

function parseDateToTimestamp(dateValue: string, heureValue?: string) {
  const rawDate = normalize(dateValue);
  const rawHeure = normalize(heureValue || "");

  if (!rawDate) return 0;

  const isoMatch = rawDate.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/
  );

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const hour = Number(isoMatch[4] || "0");
    const minute = Number(isoMatch[5] || "0");
    const second = Number(isoMatch[6] || "0");

    return new Date(year, month, day, hour, minute, second).getTime();
  }

  const frMatch = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

  if (frMatch) {
    const day = Number(frMatch[1]);
    const month = Number(frMatch[2]) - 1;
    const year = Number(frMatch[3]);

    const timeMatch = rawHeure.match(/^(\d{2}):(\d{2}):(\d{2})/);
    const hour = Number(timeMatch?.[1] || "0");
    const minute = Number(timeMatch?.[2] || "0");
    const second = Number(timeMatch?.[3] || "0");

    return new Date(year, month, day, hour, minute, second).getTime();
  }

  const parsed = new Date(rawDate).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildCsvRecords(lines: string[]) {
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: CsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = normalize(values[index] || "");
    });

    return record;
  });
}

function normalizeRdpRow(record: CsvRecord): NormalizedRdpRow {
  const date = normalize(record.date);
  const heure = normalize(record.heure);

  const hasNewFormat =
    "utilisateur_windows" in record ||
    "date_complete" in record ||
    ("ip" in record && "action" in record && !("nom_session" in record));

  if (hasNewFormat) {
    const ip = cleanIp(record.ip);
    const action = normalize(record.action || "Evenement RDP");
    const dateComplete = normalize(record.date_complete);

    return {
      date,
      heure,
      utilisateur: normalize(record.utilisateur || "N/A") || "N/A",
      machine: normalize(record.machine || "N/A") || "N/A",
      session_id: normalize(record.session_active || "N/A") || "N/A",
      nom_session: action,
      ip,
      type_ip: getTypeIp(ip),
      action,
      session_active: normalize(record.session_active || "N/A") || "N/A",
      event_timestamp:
        parseDateToTimestamp(dateComplete) || parseDateToTimestamp(date, heure),
    };
  }

  const ip = cleanIp(record.ip);
  const nomSession = normalize(
    record.nom_session || record.nomsession || "Evenement RDP"
  );
  const action = normalize(record.action || nomSession || "Evenement RDP");

  return {
    date,
    heure,
    utilisateur: normalize(record.utilisateur || "N/A") || "N/A",
    machine: normalize(record.machine || "N/A") || "N/A",
    session_id: normalize(record.session_id || "N/A") || "N/A",
    nom_session: nomSession,
    ip,
    type_ip: normalize(record.type_ip || record.typeip || getTypeIp(ip)),
    action,
    session_active: normalize(record.session_active || "N/A") || "N/A",
    event_timestamp: parseDateToTimestamp(date, heure),
  };
}

function getAuthorizedRequests() {
  try {
    const rows = db
      .prepare(
        `
        SELECT
          id,
          Utilisateur,
          ip,
          request_time,
          status,
          reason
        FROM access_requests
        WHERE LOWER(status) LIKE '%autorise%'
           OR LOWER(status) LIKE '%autoris%'
        ORDER BY id DESC
        LIMIT 1500
        `
      )
      .all() as AccessRequest[];

    return rows
      .map((row) => ({
        ...row,
        ip: cleanIp(row.ip || ""),
        timestamp: parseDateToTimestamp(row.request_time || ""),
      }))
      .filter((row) => {
        const user = normalize(row.Utilisateur || row.utilisateur || "");
        const ip = cleanIp(row.ip || "");

        return (
          !isTechnicalOrBadUser(user) &&
          isValidIp(ip) &&
          !isServerIp(ip)
        );
      });
  } catch (error) {
    console.error("Erreur lecture access_requests:", error);
    return [];
  }
}

function findAuthorizedUserByIp(
  row: NormalizedRdpRow,
  authorizedRequests: AccessRequest[]
) {
  if (!isValidIp(row.ip)) return null;
  if (isServerIp(row.ip)) return null;

  const eventTimestamp = row.event_timestamp || Date.now();
  const eventIp = cleanIp(row.ip);

  const candidates = authorizedRequests
    .filter((request) => {
      const requestIp = cleanIp(request.ip || "");

      if (requestIp !== eventIp) {
        return false;
      }

      const requestTimestamp = request.timestamp || 0;

      if (!requestTimestamp) {
        return true;
      }

      const diffMs = eventTimestamp - requestTimestamp;
      const maxAfterMs = 10 * 60 * 1000;
      const maxBeforeMs = 12 * 60 * 60 * 1000;

      return diffMs >= -maxAfterMs && diffMs <= maxBeforeMs;
    })
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const selected = candidates[0];

  if (!selected) return null;

  const user = normalize(selected.Utilisateur || selected.utilisateur || "");

  if (isTechnicalOrBadUser(user)) return null;

  return user;
}

function enrichRow(
  row: NormalizedRdpRow,
  authorizedRequests: AccessRequest[]
): NormalizedRdpRow {
  const shouldEnrich =
    isRdpAction(row.action) &&
    isValidIp(row.ip) &&
    !isServerIp(row.ip) &&
    isTechnicalOrBadUser(row.utilisateur);

  if (!shouldEnrich) {
    if (isRdpAction(row.action) && isTechnicalOrBadUser(row.utilisateur)) {
      return {
        ...row,
        utilisateur: "Acces direct non identifie",
      };
    }

    return row;
  }

  const matchedUser = findAuthorizedUserByIp(row, authorizedRequests);

  if (!matchedUser) {
    return {
      ...row,
      utilisateur: "Acces direct non identifie",
    };
  }

  return {
    ...row,
    utilisateur: matchedUser,
  };
}

function buildExistingKeys() {
  const existingRows = db
    .prepare(
      `
      SELECT
        date,
        heure,
        utilisateur,
        machine,
        session_id,
        nom_session,
        ip,
        type_ip,
        action,
        session_active
      FROM rdp_events
      `
    )
    .all() as Array<{
    date: string;
    heure: string;
    utilisateur: string;
    machine: string;
    session_id: string;
    nom_session: string;
    ip: string;
    type_ip: string;
    action: string;
    session_active: string;
  }>;

  return new Set(
    existingRows.map((row) =>
      [
        normalize(row.date),
        normalize(row.heure),
        normalize(row.utilisateur),
        normalize(row.machine),
        normalize(row.session_id),
        normalize(row.nom_session),
        cleanIp(row.ip),
        normalize(row.type_ip),
        normalize(row.action),
        normalize(row.session_active),
      ].join("|")
    )
  );
}

export async function GET() {
  try {
    const filePath = path.join("C:\\", "Logs", "RDP_Users_History.csv");

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        message: "Fichier RDP_Users_History.csv introuvable.",
      });
    }

    const content = fs.readFileSync(filePath, "utf-8").trim();

    if (!content) {
      return NextResponse.json({
        success: false,
        message: "Fichier RDP_Users_History.csv vide.",
      });
    }

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        message: "Aucune ligne a synchroniser.",
      });
    }

    const authorizedRequests = getAuthorizedRequests();

    const csvRows = buildCsvRecords(lines)
      .map(normalizeRdpRow)
      .map((row) => enrichRow(row, authorizedRequests));

    const existingKeys = buildExistingKeys();

    const insertStmt = db.prepare(`
      INSERT INTO rdp_events
      (
        date,
        heure,
        utilisateur,
        machine,
        session_id,
        nom_session,
        ip,
        type_ip,
        action,
        session_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let resolved = 0;
    let directUnidentified = 0;
    let skippedInvalid = 0;

    const insertMany = db.transaction((rows: typeof csvRows) => {
      for (const row of rows) {
        if (!row.date || !row.heure) {
          skippedInvalid++;
          continue;
        }

        if (
          row.ip !== "N/A" &&
          !isValidIp(row.ip) &&
          row.ip.toLowerCase() !== "local"
        ) {
          skippedInvalid++;
          continue;
        }

        if (!isTechnicalOrBadUser(row.utilisateur)) {
          resolved++;
        }

        if (row.utilisateur === "Acces direct non identifie") {
          directUnidentified++;
        }

        const key = [
          row.date,
          row.heure,
          row.utilisateur,
          row.machine,
          row.session_id,
          row.nom_session,
          cleanIp(row.ip),
          row.type_ip,
          row.action,
          row.session_active,
        ].join("|");

        if (!existingKeys.has(key)) {
          insertStmt.run(
            row.date,
            row.heure,
            row.utilisateur,
            row.machine,
            row.session_id,
            row.nom_session,
            cleanIp(row.ip),
            row.type_ip,
            row.action,
            row.session_active
          );

          existingKeys.add(key);
          inserted++;
        }
      }
    });

    insertMany(csvRows);

    const totalRow = db
      .prepare(`SELECT COUNT(*) as total FROM rdp_events`)
      .get() as { total: number } | undefined;

    return NextResponse.json({
      success: true,
      message: "Synchronisation terminee.",
      inserted,
      resolved_users: resolved,
      direct_unidentified: directUnidentified,
      skipped_invalid: skippedInvalid,
      total_after_sync: totalRow?.total || 0,
    });
  } catch (error) {
    console.error("Erreur /api/sync-rdp-history :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la synchronisation.",
      },
      { status: 500 }
    );
  }
}