const Database = require("better-sqlite3");
const fs = require("fs");

const DB_PATH = "C:\\Logs\\rdp_access.db";
const BACKUP_PATH = "C:\\Logs\\rdp_access_backup_avant_demo.db";

if (!fs.existsSync(DB_PATH)) {
  console.error("DB introuvable:", DB_PATH);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log("Backup cree:", BACKUP_PATH);
}

const db = new Database(DB_PATH);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);

  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS access_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pc_name TEXT,
    ip TEXT,
    request_time TEXT,
    status TEXT,
    reason TEXT,
    Utilisateur TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS rdp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    heure TEXT,
    utilisateur TEXT,
    machine TEXT,
    ip TEXT,
    action TEXT,
    session_active TEXT
  )
`).run();

ensureColumn("access_requests", "priority", "TEXT DEFAULT 'normal'");
ensureColumn("access_requests", "message", "TEXT DEFAULT ''");
ensureColumn("access_requests", "priority_level", "INTEGER DEFAULT 1");
ensureColumn("access_requests", "active_user_name", "TEXT DEFAULT ''");
ensureColumn("access_requests", "current_user_response", "TEXT DEFAULT ''");
ensureColumn("access_requests", "response_message", "TEXT DEFAULT ''");
ensureColumn("access_requests", "response_at", "TEXT DEFAULT ''");

ensureColumn("rdp_events", "session_id", "TEXT DEFAULT 'N/A'");
ensureColumn("rdp_events", "nom_session", "TEXT DEFAULT 'RDP'");
ensureColumn("rdp_events", "type_ip", "TEXT DEFAULT 'Distante'");

const clear = db.transaction(() => {
  db.prepare("DELETE FROM access_requests").run();
  db.prepare("DELETE FROM rdp_events").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('access_requests', 'rdp_events')").run();
});

clear();

const insertRequest = db.prepare(`
  INSERT INTO access_requests (
    pc_name,
    ip,
    request_time,
    status,
    reason,
    Utilisateur,
    priority,
    message,
    priority_level,
    active_user_name,
    current_user_response,
    response_message,
    response_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO rdp_events (
    date,
    heure,
    utilisateur,
    machine,
    ip,
    action,
    session_active,
    session_id,
    nom_session,
    type_ip
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const now = "2026-05-13";

insertRequest.run(
  "PC employe",
  "10.102.104.70",
  "2026-05-13T09:00:00.000Z",
  "authorized",
  "Consultation",
  "Said COTTI",
  "consultation",
  "Consulter rapidement un dossier.",
  2,
  "",
  "",
  "Poste libre. Acces autorise.",
  ""
);

insertEvent.run(
  "13/05/2026",
  "09:01:10",
  "Said COTTI",
  "PC principal",
  "10.102.104.70",
  "Connexion",
  "1",
  "2",
  "RDP",
  "Distante"
);

insertRequest.run(
  "PC employe",
  "10.102.104.105",
  "2026-05-13T09:15:00.000Z",
  "rejected",
  "Impression",
  "Abdelkhaleq El Mataoui",
  "impression",
  "Recuperer un dossier urgent.",
  2,
  "Said COTTI",
  "rejected",
  "Demande refusee par Said COTTI.",
  "2026-05-13T09:16:00.000Z"
);

insertRequest.run(
  "PC employe",
  "10.102.104.100",
  "2026-05-13T09:25:00.000Z",
  "waiting_current_user",
  "Urgent",
  "Mohamed Hamza KHADIM",
  "urgent",
  "Besoin urgent d'acceder au logiciel.",
  5,
  "Said COTTI",
  "",
  "Demande envoyee a Said COTTI. En attente de sa reponse.",
  ""
);

insertRequest.run(
  "PC employe",
  "10.102.104.179",
  "2026-05-13T09:30:00.000Z",
  "waiting_release",
  "Verification",
  "Hakim BOUFEQIR",
  "verification",
  "Verifier une information avant validation.",
  3,
  "Said COTTI",
  "accepted",
  "Said COTTI a accepte de liberer la session. Veuillez patienter jusqu'a la fermeture de sa session.",
  "2026-05-13T09:31:00.000Z"
);

insertEvent.run(
  "13/05/2026",
  "09:35:20",
  "Said COTTI",
  "PC principal",
  "10.102.104.70",
  "Session deconnectee",
  "0",
  "2",
  "RDP",
  "Distante"
);

insertRequest.run(
  "PC employe",
  "10.102.104.179",
  "2026-05-13T09:30:00.000Z",
  "authorized",
  "Verification",
  "Hakim BOUFEQIR",
  "verification",
  "Verifier une information avant validation.",
  3,
  "Said COTTI",
  "accepted",
  "Poste libere par Said COTTI. Acces autorise.",
  "2026-05-13T09:36:00.000Z"
);

insertEvent.run(
  "13/05/2026",
  "09:37:05",
  "Hakim BOUFEQIR",
  "PC principal",
  "10.102.104.179",
  "Connexion",
  "1",
  "3",
  "RDP",
  "Distante"
);

insertEvent.run(
  "13/05/2026",
  "09:45:12",
  "Acces direct non identifie",
  "PC principal",
  "10.102.104.141",
  "Reconnexion",
  "1",
  "4",
  "RDP",
  "Distante"
);

db.close();

console.log("Demo data preparee avec succes.");
console.log("Backup conserve ici:", BACKUP_PATH);