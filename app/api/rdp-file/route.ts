import { NextResponse } from "next/server";
import Database from "better-sqlite3";

const DB_PATH = "C:\\Logs\\rdp_access.db";

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function GET() {
  try {
    const db = new Database(DB_PATH);

    const status = db
      .prepare(
        `
        SELECT etat_poste, nombre_sessions_actives, date_verification
        FROM system_status
        ORDER BY id DESC
        LIMIT 1
        `
      )
      .get() as
      | {
          etat_poste?: string;
          nombre_sessions_actives?: number;
          date_verification?: string;
        }
      | undefined;

    db.close();

    const etatPoste = normalize(status?.etat_poste);
    const sessionsActives = Number(status?.nombre_sessions_actives || 0);

    if (etatPoste.includes("occupe") || sessionsActives > 0) {
      return new NextResponse(
        "Connexion RDP bloquee. Le poste principal est encore occupe. Veuillez attendre la liberation complete de la session.",
        {
          status: 423,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const rdpContent = [
      "screen mode id:i:2",
      "use multimon:i:0",
      "desktopwidth:i:1920",
      "desktopheight:i:1080",
      "session bpp:i:32",
      "winposstr:s:0,1,0,0,1200,800",
      "compression:i:1",
      "keyboardhook:i:2",
      "audiocapturemode:i:0",
      "videoplaybackmode:i:1",
      "connection type:i:7",
      "networkautodetect:i:1",
      "bandwidthautodetect:i:1",
      "displayconnectionbar:i:1",
      "enableworkspacereconnect:i:0",
      "disable wallpaper:i:0",
      "allow font smoothing:i:0",
      "allow desktop composition:i:0",
      "disable full window drag:i:1",
      "disable menu anims:i:1",
      "disable themes:i:0",
      "disable cursor setting:i:0",
      "bitmapcachepersistenable:i:1",
      "full address:s:10.102.104.44",
      "prompt for credentials:i:1",
      "authentication level:i:2",
      "redirectclipboard:i:1",
      "redirectprinters:i:0",
      "redirectcomports:i:0",
      "redirectsmartcards:i:0",
      "drivestoredirect:s:",
      "username:s:autocad_user",
      "",
    ].join("\r\n");

    return new NextResponse(rdpContent, {
      status: 200,
      headers: {
        "Content-Type": "application/rdp",
        "Content-Disposition":
          'attachment; filename="connexion-poste-principal.rdp"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur generation fichier RDP :", error);

    return new NextResponse("Erreur lors de la generation du fichier RDP.", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}