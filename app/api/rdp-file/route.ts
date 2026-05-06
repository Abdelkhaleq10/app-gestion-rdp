import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const mainPcIp = "10.102.104.44"; // bedel had IP b IP dyal poste principal RDP

  const rdpContent = [
    `full address:s:${mainPcIp}`,
    "prompt for credentials:i:1",
    "authentication level:i:2",
    "enablecredsspsupport:i:1",
    "screen mode id:i:2",
    "desktopwidth:i:1280",
    "desktopheight:i:720",
    "session bpp:i:32",
    "redirectclipboard:i:1",
    "redirectprinters:i:0",
    "redirectcomports:i:0",
    "redirectsmartcards:i:0",
    "audiomode:i:0",
  ].join("\r\n");

  return new NextResponse(rdpContent, {
    status: 200,
    headers: {
      "Content-Type": "application/x-rdp",
      "Content-Disposition": 'attachment; filename="connexion-poste-principal.rdp"',
      "Cache-Control": "no-store",
    },
  });
}