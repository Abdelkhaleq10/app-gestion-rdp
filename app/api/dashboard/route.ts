import { NextResponse } from "next/server";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

type StatusData = {
  etat_poste: string;
  nombre_sessions_actives: number;
  date_verification: string;
};

function readCurrentStatus(): StatusData {
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
    content.match(/etat_poste=(.*)/i) ||
    content.match(/EtatPoste=(.*)/i);

  const sessionsMatch =
    content.match(/nombre_sessions_actives=(.*)/i) ||
    content.match(/NombreSessionsActives=(.*)/i);

  const dateMatch =
    content.match(/date_verification=(.*)/i) ||
    content.match(/DateVerification=(.*)/i);

  const etat = etatMatch?.[1]?.trim() || "Inconnu";
  const sessionsText = sessionsMatch?.[1]?.trim() || "0";
  const date = dateMatch?.[1]?.trim() || "";

  return {
    etat_poste: etat,
    nombre_sessions_actives: parseInt(sessionsText, 10) || 0,
    date_verification: date,
  };
}

export async function GET() {
  try {
    const currentStatus = readCurrentStatus();

    const totalRdpEventsRow = db
      .prepare("SELECT COUNT(*) as total FROM rdp_events")
      .get() as { total: number } | undefined;

    const totalAccessRequestsRow = db
      .prepare("SELECT COUNT(*) as total FROM access_requests")
      .get() as { total: number } | undefined;

    return NextResponse.json({
      etat_poste: currentStatus.etat_poste,
      nombre_sessions_actives: currentStatus.nombre_sessions_actives,
      date_verification: currentStatus.date_verification,
      total_rdp_events: totalRdpEventsRow?.total || 0,
      total_access_requests: totalAccessRequestsRow?.total || 0,
    });
  } catch (error) {
    console.error("Erreur /api/dashboard:", error);

    return NextResponse.json({
      etat_poste: "Inconnu",
      nombre_sessions_actives: 0,
      date_verification: "",
      total_rdp_events: 0,
      total_access_requests: 0,
    });
  }
}