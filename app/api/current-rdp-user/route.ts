import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

type ParsedSession = {
  user: string;
  sessionName: string;
  id: string;
  state: string;
  raw: string;
};

async function runCommand(command: string) {
  try {
    const result = await execAsync(command, {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });

    return {
      ok: true,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: "",
    };
  } catch (error: any) {
    return {
      ok: false,
      stdout: error?.stdout || "",
      stderr: error?.stderr || "",
      error: error?.message || String(error),
    };
  }
}

function parseQueryUser(output: string): ParsedSession[] {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sessions: ParsedSession[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      lower.includes("username") ||
      lower.includes("nom d'utilisateur") ||
      lower.includes("utilisateur")
    ) {
      continue;
    }

    const cleanLine = line.replace(/^>/, "").trim();

    /*
      Examples possible:
      USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME
      Abdelkhaleq           rdp-tcp#5          2   Active  .          06/05/2026
      Abdelkhaleq                              2   Disc    .          06/05/2026
    */

    const parts = cleanLine.split(/\s+/).filter(Boolean);

    if (parts.length < 3) {
      continue;
    }

    const user = parts[0] || "";
    let sessionName = "";
    let id = "";
    let state = "";

    // Case: user rdp-tcp#... id state ...
    if (parts[1]?.toLowerCase().includes("rdp") || parts[1]?.toLowerCase().includes("console")) {
      sessionName = parts[1] || "";
      id = parts[2] || "";
      state = parts[3] || "";
    } else {
      // Case: user id state ...
      sessionName = "";
      id = parts[1] || "";
      state = parts[2] || "";
    }

    sessions.push({
      user,
      sessionName,
      id,
      state,
      raw: cleanLine,
    });
  }

  return sessions;
}

function isActiveSession(session: ParsedSession) {
  const state = session.state.toLowerCase();
  const raw = session.raw.toLowerCase();

  return (
    state.includes("active") ||
    state.includes("actif") ||
    raw.includes(" active ") ||
    raw.includes(" actif ")
  );
}

function isRdpSession(session: ParsedSession) {
  const sessionName = session.sessionName.toLowerCase();
  const raw = session.raw.toLowerCase();

  return (
    sessionName.includes("rdp") ||
    raw.includes("rdp-tcp") ||
    raw.includes("rdp")
  );
}

export async function GET() {
  const queryUserResult = await runCommand("cmd.exe /c query user");
  const quserResult = queryUserResult.ok
    ? queryUserResult
    : await runCommand("cmd.exe /c quser");

  const output = `${quserResult.stdout || ""}\n${quserResult.stderr || ""}`.trim();

  if (!output) {
    return NextResponse.json({
      success: false,
      utilisateur_actuel: "Aucun",
      session_active: false,
      message: "Impossible de lire query user.",
      error_detail: quserResult.error || "Aucune sortie commande.",
      command_stdout: quserResult.stdout,
      command_stderr: quserResult.stderr,
    });
  }

  const sessions = parseQueryUser(output);

  const activeRdpSession =
    sessions.find((session) => isRdpSession(session) && isActiveSession(session)) ||
    sessions.find((session) => isActiveSession(session));

  if (!activeRdpSession) {
    return NextResponse.json({
      success: true,
      utilisateur_actuel: "Aucun",
      session_active: false,
      sessions,
      raw: output,
    });
  }

  return NextResponse.json({
    success: true,
    utilisateur_actuel: activeRdpSession.user,
    session_active: true,
    session_name: activeRdpSession.sessionName,
    session_id: activeRdpSession.id,
    state: activeRdpSession.state,
    sessions,
    raw: output,
  });
}