const { execSync } = require("child_process");
const Database = require("better-sqlite3");

const DB_PATH = "C:\\Logs\\rdp_access.db";

function pad(n) {
  return String(n).padStart(2, "0");
}

function nowFr() {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function runCommand(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
  } catch (error) {
    return "";
  }
}

function parseQueryUser(output) {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const sessions = [];

  for (const line of lines.slice(1)) {
    const clean = line.replace(/^>/, "").trim();

    if (!clean) continue;

    const parts = clean.split(/\s+/);

    const normalizedLine = normalize(clean);

    const isActive =
      normalizedLine.includes(" actif ") ||
      normalizedLine.endsWith(" actif") ||
      normalizedLine.includes(" active ") ||
      normalizedLine.endsWith(" active");

    const isDisconnected =
      normalizedLine.includes(" deco ") ||
      normalizedLine.endsWith(" deco") ||
      normalizedLine.includes(" disc ") ||
      normalizedLine.endsWith(" disc") ||
      normalizedLine.includes(" deconnect");

    const username = parts[0] || "";
    const sessionName = parts[1] || "";

    sessions.push({
      username,
      sessionName,
      raw: clean,
      isActive,
      isDisconnected,
    });
  }

  return sessions;
}

function parseQwinsta(output) {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const sessions = [];

  for (const line of lines.slice(1)) {
    const clean = line.replace(/^>/, "").trim();
    const normalizedLine = normalize(clean);

    const isActive =
      normalizedLine.includes(" active ") ||
      normalizedLine.endsWith(" active") ||
      normalizedLine.includes(" actif ") ||
      normalizedLine.endsWith(" actif");

    const isDisconnected =
      normalizedLine.includes(" disc ") ||
      normalizedLine.endsWith(" disc") ||
      normalizedLine.includes(" deco ") ||
      normalizedLine.endsWith(" deco") ||
      normalizedLine.includes(" deconnect");

    const parts = clean.split(/\s+/);

    sessions.push({
      username: parts[1] || parts[0] || "",
      sessionName: parts[0] || "",
      raw: clean,
      isActive,
      isDisconnected,
    });
  }

  return sessions;
}

function isRdpSession(session) {
  const raw = normalize(session.raw);
  const sessionName = normalize(session.sessionName);

  if (!session.isActive) return false;

  if (raw.includes("rdp-tcp")) return true;
  if (sessionName.includes("rdp-tcp")) return true;

  return false;
}

function getActiveRdpSessions() {
  const queryUserOutput = runCommand("query user");
  const querySessions = parseQueryUser(queryUserOutput);

  let activeRdpSessions = querySessions.filter(isRdpSession);

  if (activeRdpSessions.length > 0) {
    return activeRdpSessions;
  }

  const qwinstaOutput = runCommand("qwinsta");
  const qwinstaSessions = parseQwinsta(qwinstaOutput);

  activeRdpSessions = qwinstaSessions.filter(isRdpSession);

  return activeRdpSessions;
}

function ensureDatabase(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS system_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etat_poste TEXT NOT NULL,
      nombre_sessions_actives INTEGER NOT NULL,
      date_verification TEXT NOT NULL
    )
  `).run();
}

function main() {
  const activeRdpSessions = getActiveRdpSessions();

  const nombreSessionsActives = activeRdpSessions.length;
  const etatPoste = nombreSessionsActives > 0 ? "Occupe" : "Libre";
  const dateVerification = nowFr();

  const db = new Database(DB_PATH);
  ensureDatabase(db);

  db.prepare(`
    INSERT INTO system_status (
      etat_poste,
      nombre_sessions_actives,
      date_verification
    )
    VALUES (?, ?, ?)
  `).run(etatPoste, nombreSessionsActives, dateVerification);

  db.close();

  console.log("Status mis a jour:");
  console.table([
    {
      etat_poste: etatPoste,
      nombre_sessions_actives: nombreSessionsActives,
      date_verification: dateVerification,
      sessions: activeRdpSessions
        .map((s) => `${s.username} / ${s.sessionName}`)
        .join(" | "),
    },
  ]);
}

main();