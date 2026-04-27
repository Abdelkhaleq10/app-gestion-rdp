import { NextResponse } from "next/server";
import db from "../../../lib/db";
import fs from "fs";
import path from "path";

function readCurrentStatus() {
  try {
    const filePath = path.join("C:\\", "Logs", "RDP_Status.txt");

    if (!fs.existsSync(filePath)) {
      return {
        etat_poste: "Inconnu",
        nombre_sessions_actives: 0,
        date_verification: "",
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");

    const etatMatch = content.match(/EtatPoste=(.*)/);
    const sessionsMatch = content.match(/NombreSessionsActives=(.*)/);
    const dateMatch = content.match(/DateVerification=(.*)/);

    return {
      etat_poste: etatMatch ? etatMatch[1].trim() : "Inconnu",
      nombre_sessions_actives: sessionsMatch
        ? parseInt(sessionsMatch[1].trim(), 10) || 0
        : 0,
      date_verification: dateMatch ? dateMatch[1].trim() : "",
    };
  } catch (error) {
    console.error("Erreur lecture status :", error);
    return {
      etat_poste: "Inconnu",
      nombre_sessions_actives: 0,
      date_verification: "",
    };
  }
}

export async function GET() {
  try {
    const currentStatus = readCurrentStatus();

    const totalRdpEventsRow = db
      .prepare(`SELECT COUNT(*) as total FROM rdp_events`)
      .get() as { total: number } | undefined;

    const totalAccessRequestsRow = db
      .prepare(`SELECT COUNT(*) as total FROM access_requests`)
      .get() as { total: number } | undefined;

    return NextResponse.json({
      etat_poste: currentStatus.etat_poste,
      nombre_sessions_actives: currentStatus.nombre_sessions_actives,
      date_verification: currentStatus.date_verification,
      total_rdp_events: totalRdpEventsRow?.total || 0,
      total_access_requests: totalAccessRequestsRow?.total || 0,
    });
  } catch (error) {
    console.error("Erreur /api/dashboard :", error);

    return NextResponse.json({
      etat_poste: "Inconnu",
      nombre_sessions_actives: 0,
      date_verification: "",
      total_rdp_events: 0,
      total_access_requests: 0,
    });
  }
}