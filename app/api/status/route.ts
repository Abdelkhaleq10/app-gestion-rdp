import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const statusFilePath = path.join("C:", "Logs", "RDP_Status.txt");

    if (!fs.existsSync(statusFilePath)) {
      return NextResponse.json(
        { message: "Fichier RDP_Status.txt introuvable." },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(statusFilePath, "utf-8");
    const lines = content.split(/\r?\n/);

    let etat_poste = "Inconnu";
    let nombre_sessions_actives = 0;
    let date_verification = "";

    for (let line of lines) {
      line = line.replace(/\uFEFF/g, "").trim();

      if (line.startsWith("EtatPoste=")) {
        etat_poste = line.replace("EtatPoste=", "").trim();
      } else if (line.startsWith("NombreSessionsActives=")) {
        nombre_sessions_actives = Number(
          line.replace("NombreSessionsActives=", "").trim()
        );
      } else if (line.startsWith("DateVerification=")) {
        date_verification = line.replace("DateVerification=", "").trim();
      }
    }

    return NextResponse.json({
      id: 1,
      etat_poste,
      nombre_sessions_actives,
      date_verification,
    });
  } catch (error) {
    console.error("Erreur API /api/status :", error);

    return NextResponse.json(
      { message: "Erreur lors de la lecture du statut." },
      { status: 500 }
    );
  }
}