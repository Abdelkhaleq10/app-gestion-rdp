import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

const SECURITY_DELAY_SECONDS = 10;

type StatusRow = {
  etat_poste?: string;
  nombre_sessions_actives?: number;
  date_verification?: string;
};

type WaitingRequest = {
  id: number;
  Utilisateur: string;
  active_user_name?: string;
  response_at?: string;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCurrentStatus(): StatusRow {
  const row = db
    .prepare(
      `
      SELECT etat_poste, nombre_sessions_actives, date_verification
      FROM system_status
      ORDER BY id DESC
      LIMIT 1
      `
    )
    .get() as StatusRow | undefined;

  return {
    etat_poste: row?.etat_poste || "Inconnu",
    nombre_sessions_actives: Number(row?.nombre_sessions_actives || 0),
    date_verification: row?.date_verification || "",
  };
}

function isPosteLibre(status: StatusRow) {
  const etat = normalize(status.etat_poste);
  const sessions = Number(status.nombre_sessions_actives || 0);

  return etat.includes("libre") && sessions === 0;
}

function getNextWaitingReleaseRequest() {
  return db
    .prepare(
      `
      SELECT id, Utilisateur, active_user_name, response_at
      FROM access_requests
      WHERE status = 'waiting_release'
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 1
      `
    )
    .get() as WaitingRequest | undefined;
}

function countActiveRequests() {
  const row = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM access_requests
      WHERE status IN ('pending', 'waiting_current_user', 'waiting_release')
      `
    )
    .get() as { total: number };

  return Number(row?.total || 0);
}

function secondsSince(value: string | undefined) {
  if (!value) return 999999;

  const date = new Date(value.replace(" ", "T"));
  const time = date.getTime();

  if (Number.isNaN(time)) return 999999;

  return Math.floor((Date.now() - time) / 1000);
}

function insertApplicationEvent(request: WaitingRequest) {
  try {
    db.prepare(
      `
      INSERT INTO rdp_events (
        date,
        heure,
        utilisateur,
        machine,
        ip,
        action,
        session_active
      )
      VALUES (
        strftime('%d/%m/%Y','now','localtime'),
        strftime('%H:%M:%S','now','localtime'),
        ?,
        ?,
        ?,
        ?,
        ?
      )
      `
    ).run(
      request.Utilisateur,
      "Application",
      "N/A",
      "Demande autorisee",
      "N/A"
    );
  } catch {
    // Ignore if rdp_events schema is different.
  }
}

export async function GET() {
  try {
    const status = getCurrentStatus();

    if (!isPosteLibre(status)) {
      return NextResponse.json({
        success: true,
        released: false,
        message:
          "Le poste est encore occupe. L'acces ne sera autorise qu'apres la fermeture complete de la session.",
        status,
        updated: 0,
        activeRequests: countActiveRequests(),
      });
    }

    const request = getNextWaitingReleaseRequest();

    if (!request) {
      return NextResponse.json({
        success: true,
        released: false,
        message: "Poste libre, aucune demande en attente de liberation.",
        status,
        updated: 0,
        activeRequests: countActiveRequests(),
      });
    }

    const waitedSeconds = secondsSince(request.response_at);

    if (waitedSeconds < SECURITY_DELAY_SECONDS) {
      return NextResponse.json({
        success: true,
        released: false,
        message: `Poste libre. Delai de securite en cours avant autorisation definitive (${SECURITY_DELAY_SECONDS - waitedSeconds}s restantes).`,
        status,
        updated: 0,
        authorizedRequestId: request.id,
        authorizedEmployee: request.Utilisateur,
        waitedSeconds,
        securityDelaySeconds: SECURITY_DELAY_SECONDS,
        activeRequests: countActiveRequests(),
      });
    }

    const activeUser =
      String(request.active_user_name || "").trim() ||
      "l'utilisateur actuellement connecte";

    const responseMessage = `Poste libere par ${activeUser}. Acces autorise.`;

    const result = db
      .prepare(
        `
        UPDATE access_requests
        SET
          status = 'authorized',
          response_message = ?,
          response_at = datetime('now')
        WHERE id = ?
          AND status = 'waiting_release'
        `
      )
      .run(responseMessage, request.id);

    if (result.changes > 0) {
      insertApplicationEvent(request);
    }

    return NextResponse.json({
      success: true,
      released: true,
      message: "Poste libere. La demande acceptee a ete autorisee.",
      status,
      updated: result.changes,
      authorizedRequestId: request.id,
      authorizedEmployee: request.Utilisateur,
      activeRequests: countActiveRequests(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        released: false,
        message: "Erreur lors de la synchronisation de liberation.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}