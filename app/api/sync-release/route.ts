import { NextResponse } from "next/server";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const SESSION_OWNER_FILE = path.join(RESPONSE_DIR, "session-owner.json");

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
  current_user_response?: string;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isBadOwnerName(value: unknown): boolean {
  const text = normalize(value);

  if (!text) return true;
  if (text === "n/a") return true;
  if (text === "-") return true;
  if (text.includes("autocad_user")) return true;
  if (text.includes("s.cotti")) return true;
  if (text.includes("non identifie")) return true;
  if (text.includes("utilisateur actuellement connecte")) return true;
  if (text.includes("actuellement connecte")) return true;
  if (text.includes("acces direct")) return true;
  if (text.includes("administrator")) return true;
  if (text.includes("administrateur")) return true;

  return false;
}

function writeSessionOwner(name: string, source: string) {
  try {
    const cleanName = String(name || "").trim();

    if (isBadOwnerName(cleanName)) return;

    if (!fs.existsSync(RESPONSE_DIR)) {
      fs.mkdirSync(RESPONSE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      SESSION_OWNER_FILE,
      JSON.stringify(
        {
          name: cleanName,
          source,
          updated_at: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.error("Erreur ecriture session-owner:", error);
  }
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

function getAcceptedWaitingReleaseRequest() {
  return db
    .prepare(
      `
      SELECT id, Utilisateur, active_user_name, response_at, current_user_response
      FROM access_requests
      WHERE status = 'waiting_release'
        AND current_user_response = 'accepted'
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 1
      `
    )
    .get() as WaitingRequest | undefined;
}

function getRejectedWaitingReleaseRequest() {
  return db
    .prepare(
      `
      SELECT id, Utilisateur, active_user_name, response_at, current_user_response
      FROM access_requests
      WHERE status = 'waiting_release'
        AND current_user_response = 'rejected'
      ORDER BY response_at DESC, id DESC
      LIMIT 1
      `
    )
    .get() as WaitingRequest | undefined;
}

function insertApplicationEvent(request: WaitingRequest, action: string) {
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
    ).run(request.Utilisateur, "Application", "N/A", action, "N/A");
  } catch {
    // Ignore if rdp_events schema is different.
  }
}

export async function GET() {
  try {
    const status = getCurrentStatus();

    const rejectedRequest = getRejectedWaitingReleaseRequest();

    if (rejectedRequest) {
      const activeUser =
        String(rejectedRequest.active_user_name || "").trim() ||
        "l'utilisateur actif";

      const responseMessage = `Demande refusee par ${activeUser}.`;

      const result = db
        .prepare(
          `
          UPDATE access_requests
          SET
            status = 'rejected',
            response_message = ?,
            response_at = datetime('now')
          WHERE id = ?
            AND status = 'waiting_release'
            AND current_user_response = 'rejected'
          `
        )
        .run(responseMessage, rejectedRequest.id);

      if (result.changes > 0) {
        insertApplicationEvent(rejectedRequest, "Demande refusee");
      }

      return NextResponse.json({
        success: true,
        released: false,
        message: "La demande a ete refusee par l'utilisateur actif.",
        status,
        updated: result.changes,
        rejectedRequestId: rejectedRequest.id,
        activeRequests: countActiveRequests(),
      });
    }

    const acceptedRequest = getAcceptedWaitingReleaseRequest();

    if (!acceptedRequest) {
      return NextResponse.json({
        success: true,
        released: false,
        message: "Aucune demande acceptee en attente de synchronisation.",
        status,
        updated: 0,
        activeRequests: countActiveRequests(),
      });
    }

    const activeUser =
      String(acceptedRequest.active_user_name || "").trim() ||
      "l'utilisateur actif";

    const responseMessage = `Demande acceptee par ${activeUser}. Acces autorise.`;

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
          AND current_user_response = 'accepted'
        `
      )
      .run(responseMessage, acceptedRequest.id);

    if (result.changes > 0) {
      insertApplicationEvent(acceptedRequest, "Demande autorisee");
      writeSessionOwner(
        acceptedRequest.Utilisateur,
        "sync-release-authorized-after-accept"
      );
    }

    return NextResponse.json({
      success: true,
      released: true,
      message: "La demande acceptee a ete autorisee.",
      status,
      updated: result.changes,
      authorizedRequestId: acceptedRequest.id,
      authorizedEmployee: acceptedRequest.Utilisateur,
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