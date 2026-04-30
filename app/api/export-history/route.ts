import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type RawRdpEvent = {
  id?: number;
  date?: string;
  heure?: string;
  utilisateur?: string | null;
  machine?: string | null;
  session_id?: string | null;
  nom_session?: string | null;
  ip?: string | null;
  type_ip?: string | null;
  action?: string | null;
  session_active?: string | null;
};

type AccessRequest = {
  id: number;
  pc_name: string | null;
  ip: string | null;
  request_time: string | null;
  status: string | null;
  reason: string | null;
  Utilisateur: string | null;
};

type ExportItem = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  nomSession: string;
  ip: string;
  typeIP: string;
  action: string;
  timestamp: number;
};

function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "N/A";

  const clean = ip
    .replace("::ffff:", "")
    .replace("::1", "127.0.0.1")
    .trim();

  if (clean === "" || clean === "-" || clean.toLowerCase() === "n/a") {
    return "N/A";
  }

  return clean;
}

function isIp(value: string | null | undefined): boolean {
  if (!value) return false;

  const clean = normalizeIp(value);

  return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(clean);
}

function isUnknownUser(user: string | null | undefined): boolean {
  if (!user) return true;

  const value = user.toLowerCase().trim();

  return (
    value === "n/a" ||
    value === "na" ||
    value === "unknown" ||
    value === "autocad_user" ||
    value === "autocad-user" ||
    value === "acces direct non identifie"
  );
}

function detectTypeIP(ip: string): string {
  if (ip === "N/A") return "Inconnue";
  if (ip === "127.0.0.1") return "Locale";
  return "Distante";
}

function normalizeAction(action: string | null | undefined): string {
  if (!action) return "Evenement RDP";

  const value = action.toLowerCase().trim();

  if (value.includes("reconnexion")) return "Reconnexion";

  if (value.includes("deconnexion") || value.includes("déconnexion")) {
    return "Deconnexion";
  }

  if (value.includes("connexion")) return "Connexion";

  if (
    value.includes("session deconnectee") ||
    value.includes("session déconnectée")
  ) {
    return "Session deconnectee";
  }

  return action;
}

function toTimestamp(
  date?: string,
  heure?: string,
  fallback?: string | null
): number {
  if (fallback && fallback.includes("-")) {
    const t = new Date(fallback.replace(" ", "T")).getTime();
    if (!Number.isNaN(t)) return t;
  }

  if (!date || !heure) return 0;

  const parts = date.split("/");
  if (parts.length !== 3) return 0;

  const [day, month, year] = parts;
  const iso = `${year}-${month}-${day}T${heure}`;
  const t = new Date(iso).getTime();

  return Number.isNaN(t) ? 0 : t;
}

function parseRequestDateTime(requestTime: string | null | undefined) {
  if (!requestTime) {
    return {
      date: "",
      heure: "",
      timestamp: 0,
    };
  }

  const clean = requestTime.trim();

  if (clean.includes("/")) {
    const parts = clean.split(" ");
    const date = parts[0] || "";
    const heure = parts[1] || "";

    return {
      date,
      heure,
      timestamp: toTimestamp(date, heure),
    };
  }

  if (clean.includes("-")) {
    const [datePart, timePart] = clean.split(" ");
    const [year, month, day] = datePart.split("-");

    const date = `${day}/${month}/${year}`;
    const heure = timePart || "";

    return {
      date,
      heure,
      timestamp: toTimestamp(date, heure, clean),
    };
  }

  return {
    date: clean,
    heure: "",
    timestamp: 0,
  };
}

function requestAction(status: string | null | undefined): string {
  const value = (status || "").toLowerCase().trim();

  if (value === "refuse" || value === "refusé" || value === "refusee") {
    return "Demande refusee";
  }

  if (value === "autorise" || value === "autorisé" || value === "autorisee") {
    return "Demande autorisee";
  }

  return "Demande acces";
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");

  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const actionFilter = (searchParams.get("action") || "").toLowerCase().trim();
    const typeIpFilter = (searchParams.get("typeIP") || "").toLowerCase().trim();
    const dateFilter = (searchParams.get("date") || "").trim();
    const sort = searchParams.get("sort") || "recent";

    const events = db
      .prepare(
        `
        SELECT *
        FROM rdp_events
        `
      )
      .all() as RawRdpEvent[];

    const requests = db
      .prepare(
        `
        SELECT id, pc_name, ip, request_time, status, reason, Utilisateur
        FROM access_requests
        ORDER BY id DESC
        `
      )
      .all() as AccessRequest[];

    const requestsByIp = new Map<string, AccessRequest>();

    for (const req of requests) {
      const cleanIp = normalizeIp(req.ip);

      if (cleanIp !== "N/A" && !requestsByIp.has(cleanIp)) {
        requestsByIp.set(cleanIp, req);
      }
    }

    const rdpItems: ExportItem[] = events.map((event) => {
      const ipFromNormalColumn = normalizeIp(event.ip);
      const ipFromSessionId = isIp(event.session_id)
        ? normalizeIp(event.session_id)
        : "N/A";

      const fixedIp =
        ipFromNormalColumn !== "N/A" ? ipFromNormalColumn : ipFromSessionId;

      const rawAction =
        event.action && event.action.trim() !== ""
          ? event.action
          : event.nom_session && event.nom_session.trim() !== ""
          ? event.nom_session
          : "Evenement RDP";

      const fixedAction = normalizeAction(rawAction);

      const fixedTypeIP =
        event.type_ip &&
        !event.type_ip.includes("-") &&
        !event.type_ip.includes("/")
          ? event.type_ip
          : detectTypeIP(fixedIp);

      const fixedDateComplete =
        event.type_ip && event.type_ip.includes("-")
          ? event.type_ip
          : `${event.date ?? ""} ${event.heure ?? ""}`;

      const matchedRequest = requestsByIp.get(fixedIp);

      let finalUser = event.utilisateur || "Acces direct non identifie";

      if (isUnknownUser(finalUser) && matchedRequest?.Utilisateur) {
        finalUser = matchedRequest.Utilisateur;
      } else if (isUnknownUser(finalUser)) {
        finalUser = "Acces direct non identifie";
      }

      const fixedNomSession =
        event.nom_session && event.nom_session.trim() !== ""
          ? event.nom_session
          : fixedAction;

      return {
        id: event.id || 0,
        date: event.date || "",
        heure: event.heure || "",
        utilisateur: finalUser,
        nomSession: fixedNomSession,
        ip: fixedIp,
        typeIP: fixedTypeIP || detectTypeIP(fixedIp),
        action: fixedAction,
        timestamp: toTimestamp(event.date, event.heure, fixedDateComplete),
      };
    });

    const requestItems: ExportItem[] = requests.map((req) => {
      const parsed = parseRequestDateTime(req.request_time);
      const cleanIp = normalizeIp(req.ip);
      const action = requestAction(req.status);

      return {
        id: 900000 + req.id,
        date: parsed.date,
        heure: parsed.heure,
        utilisateur: req.Utilisateur || "N/A",
        nomSession: req.reason || "Demande d'acces",
        ip: cleanIp,
        typeIP: detectTypeIP(cleanIp),
        action,
        timestamp: parsed.timestamp,
      };
    });

    let items: ExportItem[] = [...rdpItems, ...requestItems];

    if (search) {
      items = items.filter((item) => {
        const text = `
          ${item.id}
          ${item.date}
          ${item.heure}
          ${item.utilisateur}
          ${item.nomSession}
          ${item.ip}
          ${item.typeIP}
          ${item.action}
        `.toLowerCase();

        return text.includes(search);
      });
    }

    if (actionFilter) {
      items = items.filter((item) =>
        item.action.toLowerCase().includes(actionFilter)
      );
    }

    if (typeIpFilter) {
      items = items.filter(
        (item) => item.typeIP.toLowerCase() === typeIpFilter
      );
    }

    if (dateFilter) {
      items = items.filter((item) => item.date === dateFilter);
    }

    items.sort((a, b) => {
      if (sort === "oldest") {
        return a.timestamp - b.timestamp;
      }

      return b.timestamp - a.timestamp;
    });

    const separator = ";";

    const headers = [
      "ID",
      "Date",
      "Heure",
      "Utilisateur",
      "NomSession",
      "IP",
      "TypeIP",
      "Action",
    ];

    const rows = items.map((item) => [
      item.id,
      item.date,
      item.heure,
      item.utilisateur,
      item.nomSession,
      item.ip,
      item.typeIP,
      item.action,
    ]);

    const csvLines = [
      "sep=;",
      headers.join(separator),
      ...rows.map((row) => row.map(escapeCsv).join(separator)),
    ];

    const csv = csvLines.join("\r\n");

    return new NextResponse("\uFEFF" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="historique_rdp_complet.csv"',
      },
    });
  } catch (error) {
    console.error("Erreur export history:", error);

    return NextResponse.json(
      { error: "Erreur lors de l'export CSV historique complet" },
      { status: 500 }
    );
  }
}