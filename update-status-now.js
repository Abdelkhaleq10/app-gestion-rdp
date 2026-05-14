const Database = require("better-sqlite3");
const { execSync } = require("child_process");

const db = new Database("C:\\Logs\\rdp_access.db");

function ensureTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS system_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etat_poste TEXT DEFAULT 'Inconnu',
      nombre_sessions_actives INTEGER DEFAULT 0,
      date_verification TEXT DEFAULT ''
    )
  `).run();
}

function getActiveRdpSessions() {
  let output = "";

  try {
    output = execSync("query user", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    output = "";
  }

  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const activeLines = lines.filter((line) => {
    const clean = line.toLowerCase();

    if (clean.includes("utilisateur") || clean.includes("username")) return false;
    if (clean.includes("deco") || clean.includes("disc")) return false;

    return clean.includes("actif") || clean.includes("active");
  });

  return activeLines;
}

function formatNow() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();

  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

ensureTable();

const activeSessions = getActiveRdpSessions();
const count = activeSessions.length;
const etat = count > 0 ? "Occupe" : "Libre";
const now = formatNow();

db.prepare(`
  INSERT INTO system_status (
    etat_poste,
    nombre_sessions_actives,
    date_verification
  )
  VALUES (?, ?, ?)
`).run(etat, count, now);

console.log("Status mis a jour:");
console.table([
  {
    etat_poste: etat,
    nombre_sessions_actives: count,
    date_verification: now,
    sessions: activeSessions.join(" | "),
  },
]);

db.close();