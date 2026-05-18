const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const CURRENT_POPUP_FILE = path.join(RESPONSE_DIR, "popup-current.json");

function safeJsonRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function tableExists(db, tableName) {
  const row = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type='table'
      AND name=?
      LIMIT 1
      `
    )
    .get(tableName);

  return !!row;
}

function processResponses() {
  if (!fs.existsSync(DB_PATH)) return;
  if (!fs.existsSync(RESPONSE_DIR)) return;

  const db = new Database(DB_PATH);

  if (!tableExists(db, "access_requests")) {
    db.close();
    return;
  }

  const files = fs
    .readdirSync(RESPONSE_DIR)
    .filter((name) => /^request_\d+\.txt$/i.test(name));

  for (const file of files) {
    const filePath = path.join(RESPONSE_DIR, file);
    const requestId = Number(file.match(/\d+/)?.[0] || 0);

    if (!requestId) {
      safeDelete(filePath);
      continue;
    }

    const answer = String(fs.readFileSync(filePath, "utf8") || "")
      .trim()
      .toUpperCase();

    const row = db
      .prepare("SELECT * FROM access_requests WHERE id = ? LIMIT 1")
      .get(requestId);

    if (!row) {
      safeDelete(filePath);
      continue;
    }

    if (!["pending", "waiting_current_user", "waiting_release"].includes(row.status)) {
      safeDelete(filePath);
      continue;
    }

    if (answer === "YES") {
      db.prepare(
        `
        UPDATE access_requests
        SET status = 'waiting_release',
            current_user_response = 'accepted_release',
            response_message = 'L''utilisateur actuellement connecte a accepte de liberer la session. Veuillez patienter jusqu''a la fermeture de sa session.',
            response_at = datetime('now', 'localtime')
        WHERE id = ?
        `
      ).run(requestId);
    } else if (answer === "NO") {
      db.prepare(
        `
        UPDATE access_requests
        SET status = 'rejected',
            current_user_response = 'refused_release',
            response_message = 'Demande refusee par l''utilisateur actuellement connecte.',
            response_at = datetime('now', 'localtime')
        WHERE id = ?
        `
      ).run(requestId);
    } else if (answer === "TIMEOUT") {
      db.prepare(
        `
        UPDATE access_requests
        SET status = 'rejected',
            current_user_response = 'timeout',
            response_message = 'Aucune reponse recue. La demande a ete refusee automatiquement.',
            response_at = datetime('now', 'localtime')
        WHERE id = ?
        `
      ).run(requestId);
    }

    const current = safeJsonRead(CURRENT_POPUP_FILE);

    if (current && Number(current.requestId) === Number(requestId)) {
      safeDelete(CURRENT_POPUP_FILE);
    }

    safeDelete(filePath);
  }

  db.close();
}

processResponses();