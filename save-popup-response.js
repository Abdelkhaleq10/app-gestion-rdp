const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const CURRENT_POPUP_FILE = path.join(RESPONSE_DIR, "popup-current.json");

function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function ensureColumn(db, tableName, columnName, columnType) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  if (!columns.includes(columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`).run();
  }
}

function ensureSchema(db) {
  ensureColumn(db, "access_requests", "current_user_response", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_message", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_at", "TEXT DEFAULT ''");
}

function readResponseFiles() {
  if (!fs.existsSync(RESPONSE_DIR)) return [];

  return fs
    .readdirSync(RESPONSE_DIR)
    .filter((name) => /^request_\d+\.txt$/i.test(name))
    .map((name) => {
      const id = Number(name.match(/^request_(\d+)\.txt$/i)[1]);
      const filePath = path.join(RESPONSE_DIR, name);
      const answer = String(fs.readFileSync(filePath, "utf8") || "").trim().toUpperCase();

      return { id, filePath, answer };
    });
}

function updateRequest(db, id, answer) {
  if (answer === "YES") {
    db.prepare(
      `
      UPDATE access_requests
      SET current_user_response = 'accepted_release',
          response_message = 'L utilisateur actuellement connecte a accepte de liberer la session.',
          response_at = datetime('now', 'localtime'),
          status = 'authorized'
      WHERE id = ?
      AND status IN ('pending', 'waiting_current_user')
      `
    ).run(id);

    return "YES";
  }

  if (answer === "NO") {
    db.prepare(
      `
      UPDATE access_requests
      SET current_user_response = 'refused_release',
          response_message = 'Demande refusee par l utilisateur actuellement connecte.',
          response_at = datetime('now', 'localtime'),
          status = 'rejected'
      WHERE id = ?
      AND status IN ('pending', 'waiting_current_user')
      `
    ).run(id);

    return "NO";
  }

  if (answer === "TIMEOUT") {
    db.prepare(
      `
      UPDATE access_requests
      SET current_user_response = 'timeout',
          response_message = 'Aucune reponse recue. La demande a ete refusee automatiquement.',
          response_at = datetime('now', 'localtime'),
          status = 'rejected'
      WHERE id = ?
      AND status IN ('pending', 'waiting_current_user')
      `
    ).run(id);

    return "TIMEOUT";
  }

  return "UNKNOWN";
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("DB introuvable.");
    return;
  }

  const files = readResponseFiles();

  if (files.length === 0) {
    return;
  }

  const db = new Database(DB_PATH);
  ensureSchema(db);

  for (const item of files) {
    const result = updateRequest(db, item.id, item.answer);

    console.log(`#${item.id} reponse=${item.answer} resultat=${result}`);

    safeDelete(item.filePath);

    const current = fs.existsSync(CURRENT_POPUP_FILE)
      ? JSON.parse(fs.readFileSync(CURRENT_POPUP_FILE, "utf8"))
      : null;

    if (current && Number(current.requestId) === Number(item.id)) {
      safeDelete(CURRENT_POPUP_FILE);
    }
  }

  db.close();
}

main();