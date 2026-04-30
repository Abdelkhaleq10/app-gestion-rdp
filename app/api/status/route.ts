import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type StatusData = {
  etat_poste: string;
  nombre_sessions_actives: number;
  date_verification: string;
};

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

  // Support ancien format:
  // EtatPoste=Libre
  // NombreSessionsActives=0
  // DateVerification=...
  const oldEtatMatch = content.match(/EtatPoste=(.*)/);
  const oldSessionsMatch = content.match(/NombreSessionsActives=(.*)/);
  const oldDateMatch = content.match(/DateVerification=(.*)/);

  // Support nouveau format:
  // etat_poste=Libre
  // nombre_sessions_actives=0
  // date_verification=...
  const newEtatMatch = content.match(/etat_poste=(.*)/);
  const newSessionsMatch = content.match(/nombre_sessions_actives=(.*)/);
  const newDateMatch = content.match(/date_verification=(.*)/);

  const etat =
    newEtatMatch?.[1]?.trim() ||
    oldEtatMatch?.[1]?.trim() ||
    "Inconnu";

  const sessionsText =
    newSessionsMatch?.[1]?.trim() ||
    oldSessionsMatch?.[1]?.trim() ||
    "0";

  const date =
    newDateMatch?.[1]?.trim() ||
    oldDateMatch?.[1]?.trim() ||
    "";

  return {
    etat_poste: etat,
    nombre_sessions_actives: parseInt(sessionsText, 10) || 0,
    date_verification: date,
  };
}

export async function GET() {
  try {
    const status = readStatusFile();

    return NextResponse.json(status);
  } catch (error) {
    console.error("Erreur /api/status:", error);

    return NextResponse.json({
      etat_poste: "Inconnu",
      nombre_sessions_actives: 0,
      date_verification: "",
    });
  }
}