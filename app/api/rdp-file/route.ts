import { NextResponse } from "next/server";

export async function GET() {
  const rdpContent = `screen mode id:i:2
use multimon:i:0
desktopwidth:i:1280
desktopheight:i:720
session bpp:i:32
winposstr:s:0,3,0,0,800,600
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
allow font smoothing:i:1
allow desktop composition:i:1
disable full window drag:i:0
disable menu anims:i:0
disable themes:i:0
disable cursor setting:i:0
bitmapcachepersistenable:i:1
full address:s:10.102.104.44
username:s:autocad_user
prompt for credentials:i:1
administrative session:i:0
authentication level:i:2
redirectclipboard:i:1
redirectprinters:i:0
redirectcomports:i:0
redirectsmartcards:i:0
redirectwebauthn:i:0
redirectposdevices:i:0
autoreconnection enabled:i:1
`;

  return new NextResponse(rdpContent, {
    status: 200,
    headers: {
      "Content-Type": "application/x-rdp",
      "Content-Disposition": 'attachment; filename="connexion-pc-principal.rdp"',
    },
  });
}