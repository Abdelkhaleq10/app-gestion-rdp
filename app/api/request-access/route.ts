import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

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

  const etatMatch =
    content.match(/etat_poste=(.*)/i) || content.match(/EtatPoste=(.*)/i);

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

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return "N/A";
}

function normalizeUser(value: unknown): string {
  if (typeof value !== "string") return "N/A";

  const clean = value.trim();

  if (!clean) return "N/A";

  return clean;
}

function isPosteOccupe(status: StatusData): boolean {
  const etat = status.etat_poste.toLowerCase().trim();

  return (
    etat === "occupe" ||
    etat === "occupé" ||
    status.nombre_sessions_actives > 0
  );
}

function notifyActiveRdpUser(requesterName: string) {
  const scriptPath = "C:\\script_RDP\\notify_rdp_user.ps1";

  if (!fs.existsSync(scriptPath)) {
    console.error("Script notification introuvable:", scriptPath);
    return;
  }

  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-RequesterName",
      requesterName,
    ],
    {
      windowsHide: true,
      timeout: 10000,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error("Erreur notification RDP:", error.message);
        return;
      }

      if (stderr) {
        console.error("Notification RDP stderr:", stderr);
      }

      if (stdout) {
        console.log("Notification RDP stdout:", stdout);
      }
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const utilisateur = normalizeUser(
      body.utilisateur || body.Utilisateur || body.user || body.name || body.nom
    );

    const pcName =
      typeof body.pc_name === "string" && body.pc_name.trim() !== ""
        ? body.pc_name.trim()
        : null;

    const ip = getClientIp(request);

    const status = readStatusFile();
    const occupe = isPosteOccupe(status);

    const requestTime = new Date().toLocaleString("fr-FR", {
      hour12: false,
    });

    if (occupe) {
      db.prepare(
        `
        INSERT INTO access_requests
        (pc_name, ip, request_time, status, reason, Utilisateur)
        VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(pcName, ip, requestTime, "refuse", "poste occupe", utilisateur);

      notifyActiveRdpUser(utilisateur);

      return NextResponse.json({
        allowed: false,
        autorise: false,
        status: "refuse",
        message: "Acces refuse. Le poste principal est occupe.",
        etat_poste: status.etat_poste,
        nombre_sessions_actives: status.nombre_sessions_actives,
      });
    }

    db.prepare(
      `
      INSERT INTO access_requests
      (pc_name, ip, request_time, status, reason, Utilisateur)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(pcName, ip, requestTime, "autorise", "poste libre", utilisateur);

    return NextResponse.json({
      allowed: true,
      autorise: true,
      status: "autorise",
      message: "Acces autorise. Le poste principal est libre.",
      etat_poste: status.etat_poste,
      nombre_sessions_actives: status.nombre_sessions_actives,
    });
  } catch (error) {
    console.error("Erreur /api/request-access:", error);

    return NextResponse.json(
      {
        allowed: false,
        autorise: false,
        status: "erreur",
        message: "Erreur serveur lors de la demande d'acces.",
      },
      { status: 500 }
    );
  }
}