const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const POPUP_FILE = path.join(RESPONSE_DIR, "popup-current.json");
const OWNER_FILE = path.join(RESPONSE_DIR, "session-owner.json");

function openDb() {
  return new Database(DB_PATH);
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

function ensureSchema(db) {
  ensureColumn(db, "access_requests", "active_user_name", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "current_user_response", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_message", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_at", "TEXT DEFAULT ''");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cleanText(value) {
  return String(value || "").trim();
}

function isPlaceholderName(value) {
  const text = normalize(value);

  return (
    !text ||
    text.includes("utilisateur actuellement") ||
    text.includes("utilisateur actif") ||
    text.includes("non identifie")
  );
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readPopupPayload() {
  return readJson(POPUP_FILE);
}

function removePopupFiles() {
  try {
    if (fs.existsSync(POPUP_FILE)) fs.unlinkSync(POPUP_FILE);
  } catch {
    // ignore
  }

  try {
    const files = fs.readdirSync(RESPONSE_DIR);

    for (const file of files) {
      if (
        file.startsWith("request_") ||
        file.startsWith("popup-payload-") ||
        file === "popup-current.json"
      ) {
        fs.unlinkSync(path.join(RESPONSE_DIR, file));
      }
    }
  } catch {
    // ignore
  }
}

function getArgs() {
  const args = process.argv.slice(2).map((arg) => String(arg || "").trim());

  let id = "";
  let response = "";

  for (const arg of args) {
    const low = normalize(arg);

    if (/^\d+$/.test(arg)) {
      id = arg;
      continue;
    }

    if (
      low === "oui" ||
      low === "yes" ||
      low === "accepted" ||
      low === "accept" ||
      low === "accepte"
    ) {
      response = "accepted";
      continue;
    }

    if (
      low === "non" ||
      low === "no" ||
      low === "rejected" ||
      low === "reject" ||
      low === "refuse" ||
      low === "refused_release"
    ) {
      response = "refused_release";
      continue;
    }

    if (low === "timeout" || low === "expire" || low === "expired") {
      response = "timeout";
      continue;
    }
  }

  const payload = readPopupPayload();

  if (!id && payload) id = String(payload.id || payload.request_id || "");
  if (!response && payload && payload.response) response = normalize(payload.response);

  return {
    id: Number(id),
    response: response || "timeout",
    payload,
  };
}

function getRequestName(row) {
  return (
    cleanText(row.Utilisateur) ||
    cleanText(row.utilisateur) ||
    cleanText(row.employee_name) ||
    "Utilisateur"
  );
}

function getActiveResponderName(db, requestRow, payload) {
  const payloadName = cleanText(payload?.active_user_name);

  if (payloadName && !isPlaceholderName(payloadName)) return payloadName;

  const rowName = cleanText(requestRow?.active_user_name);

  if (rowName && !isPlaceholderName(rowName)) return rowName;

  const ownerData = readJson(OWNER_FILE);
  const ownerName = cleanText(ownerData?.name);

  if (ownerName && !isPlaceholderName(ownerName)) return ownerName;

  const requester = normalize(getRequestName(requestRow || {}));

  const rows = db
    .prepare(
      `
      SELECT id, Utilisateur, utilisateur, employee_name, active_user_name
      FROM access_requests
      WHERE status = 'authorized'
      ORDER BY id DESC
      LIMIT 50
      `
    )
    .all();

  for (const row of rows) {
    const name =
      cleanText(row.Utilisateur) ||
      cleanText(row.utilisateur) ||
      cleanText(row.employee_name);

    if (name && normalize(name) !== requester && !isPlaceholderName(name)) {
      return name;
    }
  }

  return "Utilisateur actif non identifie";
}

function setNewSessionOwner(name, requestId) {
  if (!name || isPlaceholderName(name)) return;

  writeJson(OWNER_FILE, {
    name,
    request_id: requestId,
    updated_at: new Date().toISOString(),
  });
}

function saveResponse() {
  const { id, response, payload } = getArgs();

  if (!id || Number.isNaN(id)) {
    console.error("ERREUR: ID demande introuvable.");
    removePopupFiles();
    process.exit(1);
  }

  const db = openDb();

  try {
    ensureSchema(db);

    const requestRow = db.prepare(`SELECT * FROM access_requests WHERE id = ?`).get(id);

    if (!requestRow) {
      console.error("ERREUR: demande introuvable:", id);
      removePopupFiles();
      process.exit(1);
    }

    const responderName = getActiveResponderName(db, requestRow, payload);
    const requesterName = getRequestName(requestRow);

    if (response === "accepted") {
      db.prepare(
        `
        UPDATE access_requests
        SET status = 'authorized',
            active_user_name = ?,
            current_user_response = 'accepted',
            response_message = ?,
            response_at = datetime('now')
        WHERE id = ?
        `
      ).run(
        responderName,
        `Demande acceptee par ${responderName}.`,
        id
      );

      setNewSessionOwner(requesterName, id);

      console.log(`Demande #${id} acceptee par ${responderName}. Nouveau proprietaire session: ${requesterName}.`);
    } else if (response === "refused_release" || response === "rejected") {
      db.prepare(
        `
        UPDATE access_requests
        SET status = 'rejected',
            active_user_name = ?,
            current_user_response = 'refused_release',
            response_message = ?,
            response_at = datetime('now')
        WHERE id = ?
        `
      ).run(
        responderName,
        `Demande refusee par ${responderName}.`,
        id
      );

      console.log(`Demande #${id} refusee par ${responderName}.`);
    } else {
      db.prepare(
        `
        UPDATE access_requests
        SET status = 'rejected',
            active_user_name = ?,
            current_user_response = 'timeout',
            response_message = ?,
            response_at = datetime('now')
        WHERE id = ?
        `
      ).run(
        responderName,
        `Aucune reponse recue de ${responderName}. La demande a ete refusee automatiquement.`,
        id
      );

      console.log(`Demande #${id} expiree automatiquement. Utilisateur actif: ${responderName}.`);
    }

    removePopupFiles();
  } catch (error) {
    console.error("Erreur save-popup-response:", error);
    removePopupFiles();
    process.exit(1);
  } finally {
    db.close();
  }
}

saveResponse();