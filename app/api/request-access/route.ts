import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/db";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

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
    console.error("Erreur lecture status actuel :", error);
    return {
      etat_poste: "Inconnu",
      nombre_sessions_actives: 0,
      date_verification: "",
    };
  }
}

function notifyActiveRdpUser() {
  try {
    execFileSync("powershell.exe", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "C:\\script_RDP\\notify_rdp_user.ps1",
    ]);
  } catch (error) {
    console.error("Erreur notification RDP :", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const utilisateur = String(body?.utilisateur || "").trim();

    if (!utilisateur) {
      return NextResponse.json(
        { message: "Utilisateur obligatoire." },
        { status: 400 }
      );
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "::1";

    const currentStatus = readCurrentStatus();
    const request_time = new Date().toLocaleString("fr-FR");

    let status = "refuse";
    let reason = "poste occupe";
    let message = "Acces refuse. Le poste principal est occupe.";

    if (currentStatus.etat_poste === "Libre") {
      status = "autorise";
      reason = "poste libre";
      message =
        "Acces autorise. Vous pouvez maintenant vous connecter via RDP.";
    } else {
      notifyActiveRdpUser();
    }

    db.prepare(
      `
      INSERT INTO access_requests ("Utilisateur", ip, request_time, status, reason)
      VALUES (?, ?, ?, ?, ?)
      `
    ).run(utilisateur, ip, request_time, status, reason);

    return NextResponse.json({
      success: true,
      status,
      reason,
      ip,
      message,
      current_status: currentStatus.etat_poste,
      utilisateur,
    });
  } catch (error) {
    console.error("Erreur /api/request-access :", error);
    return NextResponse.json(
      { message: "Erreur lors du traitement de la demande." },
      { status: 500 }
    );
  }
}