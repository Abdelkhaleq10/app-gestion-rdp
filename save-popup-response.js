const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const CURRENT_POPUP_FILE = path.join(RESPONSE_DIR, "popup-current.json");
const SESSION_OWNER_FILE = path.join(RESPONSE_DIR, "session-owner.json");

function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function ensureColumn(db, tableName, columnName, columnType) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((c) => c.name);

  if (!columns.includes(columnName)) {
    db.prepare(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`
    ).run();
  }
}

function ensureSchema(db) {
  ensureColumn(db, "access_requests", "current_user_response", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_message", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_at", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "active_user_name", "TEXT DEFAULT ''");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isBadName(value) {
  const text = normalize(value);

  if (!text) return true;
  if (text === "n/a") return true;
  if (text === "-") return true;
  if (text === "unknown") return true;
  if (text === "inconnu") return true;
  if (text === "utilisateur inconnu") return true;
  if (text === "utilisateur actif non identifie") return true;
  if (text === "session rdp active") return true;
  if (text.includes("utilisateur actuellement connecte")) return true;
  if (text.includes("actuellement connecte")) return true;
  if (text.includes("non identifie")) return true;
  if (text.includes("acces direct non identifie")) return true;
  if (text.includes("acces direct")) return true;
  if (text.includes("autocad_user")) return true;
  if (text.includes("s.cotti")) return true;
  if (text.includes("administrator")) return true;
  if (text.includes("administrateur")) return true;

  return false;
}

function cleanName(value) {
  const name = String(value || "").trim();
  if (isBadName(name)) return "";
  return name;
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getCurrentPopupOwnerName() {
  const current = readJsonFile(CURRENT_POPUP_FILE);
  if (!current) return "";

  return (
    cleanName(current.activeUserName) ||
    cleanName(current.active_user_name) ||
    cleanName(current.currentUser) ||
    cleanName(current.current_user) ||
    cleanName(current.ownerName) ||
    cleanName(current.owner_name) ||
    cleanName(current.responderName) ||
    cleanName(current.responder_name) ||
    cleanName(current.sessionOwner) ||
    cleanName(current.session_owner) ||
    ""
  );
}

function getSessionOwnerName() {
  const owner = readJsonFile(SESSION_OWNER_FILE);
  if (!owner) return "";

  return (
    cleanName(owner.name) ||
    cleanName(owner.full_name) ||
    cleanName(owner.user) ||
    cleanName(owner.username) ||
    cleanName(owner.utilisateur) ||
    cleanName(owner.employeeName) ||
    ""
  );
}

function getDbActiveUserName(db, id) {
  try {
    const row = db
      .prepare(
        `
        SELECT active_user_name
        FROM access_requests
        WHERE id = ?
        LIMIT 1
        `
      )
      .get(id);

    return cleanName(row && row.active_user_name);
  } catch {
    return "";
  }
}

function getLastAuthorizedUserName(db, currentRequestId) {
  try {
    const rows = db
      .prepare(
        `
        SELECT id, Utilisateur, active_user_name, response_message, response_at
        FROM access_requests
        WHERE id < ?
        AND status = 'authorized'
        ORDER BY id DESC
        LIMIT 30
        `
      )
      .all(currentRequestId);

    for (const row of rows) {
      const activeName = cleanName(row.active_user_name);
      if (activeName) return activeName;

      const utilisateur = cleanName(row.Utilisateur);
      if (utilisateur) return utilisateur;
    }

    return "";
  } catch {
    return "";
  }
}

function getLastRdpEventUserName(db) {
  try {
    const rows = db
      .prepare(
        `
        SELECT utilisateur, action, id
        FROM rdp_events
        ORDER BY id DESC
        LIMIT 50
        `
      )
      .all();

    for (const row of rows) {
      const user = cleanName(row.utilisateur);
      const action = normalize(row.action);

      if (!user) continue;
      if (action.includes("deconnect")) continue;
      if (action.includes("deconnexion")) continue;
      if (action.includes("fermee")) continue;
      if (action.includes("ferme")) continue;

      if (
        action.includes("connexion") ||
        action.includes("reconnexion") ||
        action.includes("connecte") ||
        action.includes("active")
      ) {
        return user;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function getResponderName(db, id) {
  const name =
    getDbActiveUserName(db, id) ||
    getCurrentPopupOwnerName() ||
    getSessionOwnerName() ||
    getLastAuthorizedUserName(db, id) ||
    getLastRdpEventUserName(db) ||
    "";

  return cleanName(name) || "utilisateur actif non identifie";
}

function readResponseFiles() {
  if (!fs.existsSync(RESPONSE_DIR)) return [];

  return fs
    .readdirSync(RESPONSE_DIR)
    .filter((name) => /^request_\d+\.txt$/i.test(name))
    .map((name) => {
      const id = Number(name.match(/^request_(\d+)\.txt$/i)[1]);
      const filePath = path.join(RESPONSE_DIR, name);
      const answer = String(fs.readFileSync(filePath, "utf8") || "")
        .trim()
        .toUpperCase();

      return { id, filePath, answer };
    });
}

function updateRequest(db, id, answer) {
  const responderName = getResponderName(db, id);

  if (answer === "YES") {
    db.prepare(
      `
      UPDATE access_requests
      SET current_user_response = 'accepted',
          active_user_name = ?,
          response_message = ?,
          response_at = datetime('now', 'localtime'),
          status = 'waiting_release'
      WHERE id = ?
      AND status IN ('pending', 'waiting_current_user')
      `
    ).run(responderName, `Demande acceptee par ${responderName}.`, id);

    return "YES";
  }

  if (answer === "NO") {
    db.prepare(
      `
      UPDATE access_requests
      SET current_user_response = 'refused_release',
          active_user_name = ?,
          response_message = ?,
          response_at = datetime('now', 'localtime'),
          status = 'rejected'
      WHERE id = ?
      AND status IN ('pending', 'waiting_current_user')
      `
    ).run(responderName, `Demande refusee par ${responderName}.`, id);

    return "NO";
  }

  if (answer === "TIMEOUT") {
    db.prepare(
      `
      UPDATE access_requests
      SET current_user_response = 'timeout',
          active_user_name = ?,
          response_message = ?,
          response_at = datetime('now', 'localtime'),
          status = 'rejected'
      WHERE id = ?
      AND status IN ('pending', 'waiting_current_user')
      `
    ).run(
      responderName,
      `Aucune reponse recue de ${responderName}. La demande a ete refusee automatiquement.`,
      id
    );

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

    const current = readJsonFile(CURRENT_POPUP_FILE);

    if (current && Number(current.requestId) === Number(item.id)) {
      safeDelete(CURRENT_POPUP_FILE);
    }
  }

  db.close();
}

main();