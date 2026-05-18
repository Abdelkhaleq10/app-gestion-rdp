const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const Database = require("better-sqlite3");

const APP_DIR = "C:\\AppWeb";
const DB_PATH = "C:\\Logs\\rdp_access.db";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";

const POPUP_FILE = path.join(RESPONSE_DIR, "popup-current.json");
const OWNER_FILE = path.join(RESPONSE_DIR, "session-owner.json");
const POPUP_HTA = path.join(APP_DIR, "popup-window.hta");

const CHECK_INTERVAL_MS = 1000;
const POPUP_EXPIRE_SECONDS = 60;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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
  ensureColumn(db, "access_requests", "priority", "TEXT DEFAULT 'normal'");
  ensureColumn(db, "access_requests", "priority_level", "INTEGER DEFAULT 1");
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

function isBadName(value) {
  const text = normalize(value);

  return (
    !text ||
    text.includes("utilisateur actuellement") ||
    text.includes("utilisateur actif") ||
    text.includes("non identifie")
  );
}

function getRequestName(request) {
  return cleanText(request.Utilisateur) || cleanText(request.utilisateur) || "Utilisateur";
}

function getPriorityLevel(request) {
  const direct = Number(request.priority_level || 0);

  if (direct > 0) return direct;

  const value = normalize(request.priority || request.reason);

  if (value === "urgent") return 5;
  if (value === "assistance") return 4;
  if (value === "verification") return 3;
  if (value === "consultation") return 2;
  if (value === "impression") return 2;

  return 1;
}

function getPriorityName(request) {
  const value = normalize(request.priority || request.reason);

  if (value === "urgent") return "Urgent";
  if (value === "assistance") return "Assistance";
  if (value === "verification") return "Verification";
  if (value === "consultation") return "Consultation";
  if (value === "impression") return "Impression";
  if (value === "autre" || value === "other") return "Autre";

  return cleanText(request.reason) || "Normal";
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

function getOwnerFromFile() {
  const data = readJson(OWNER_FILE);
  const name = cleanText(data && data.name);

  if (name && !isBadName(name)) return name;

  return "";
}

function getOwnerFromDb(db) {
  const rows = db
    .prepare(
      `
      SELECT id, Utilisateur, active_user_name, current_user_response, status
      FROM access_requests
      WHERE status = 'authorized'
      ORDER BY id DESC
      LIMIT 30
      `
    )
    .all();

  for (const row of rows) {
    const name = cleanText(row.Utilisateur);

    if (name && !isBadName(name)) return name;
  }

  for (const row of rows) {
    const name = cleanText(row.active_user_name);

    if (name && !isBadName(name)) return name;
  }

  return "";
}

function getCurrentActiveEmployeeName(db) {
  const ownerFromFile = getOwnerFromFile();

  if (ownerFromFile) return ownerFromFile;

  const ownerFromDb = getOwnerFromDb(db);

  if (ownerFromDb) return ownerFromDb;

  return "Said COTTI";
}

function readCurrentPopup() {
  return readJson(POPUP_FILE);
}

function isPopupProcessRunning() {
  try {
    const result = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*popup-window.hta*' -or $_.CommandLine -like '*mshta.exe*' } | Select-Object -First 1 | ForEach-Object { 'YES' }"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );

    return result.includes("YES");
  } catch {
    return false;
  }
}

function killOldPopupWindows() {
  try {
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*popup-window.hta*' -or $_.CommandLine -like '*popup-clean.hta*' -or $_.CommandLine -like '*popup-clean-form.ps1*' -or $_.CommandLine -like '*mshta.exe*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
      { stdio: "ignore" }
    );
  } catch {
    // ignore
  }
}

function getBestRequest(db) {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM access_requests
      WHERE status IN ('pending', 'waiting_release', 'waiting_current_user')
      ORDER BY COALESCE(priority_level, 1) DESC, id ASC
      LIMIT 50
      `
    )
    .all();

  if (!rows.length) return null;

  return rows.sort((a, b) => {
    const priorityDiff = getPriorityLevel(b) - getPriorityLevel(a);
    if (priorityDiff !== 0) return priorityDiff;

    const aTime = new Date(a.request_time || 0).getTime();
    const bTime = new Date(b.request_time || 0).getTime();

    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return aTime - bTime;
    }

    return Number(a.id) - Number(b.id);
  })[0];
}

function rejectLowerPriorityRequests(db, winner) {
  const winnerPriority = getPriorityLevel(winner);
  const winnerName = getRequestName(winner);

  const rows = db
    .prepare(
      `
      SELECT *
      FROM access_requests
      WHERE status IN ('pending', 'waiting_release', 'waiting_current_user')
        AND id <> ?
      `
    )
    .all(winner.id);

  const update = db.prepare(
    `
    UPDATE access_requests
    SET status = 'rejected',
        current_user_response = 'superseded',
        response_message = ?,
        response_at = datetime('now')
    WHERE id = ?
    `
  );

  for (const row of rows) {
    const rowPriority = getPriorityLevel(row);

    if (rowPriority < winnerPriority) {
      update.run(
        `Demande refusee automatiquement car une demande plus prioritaire de ${winnerName} est deja en cours de traitement.`,
        row.id
      );
    }
  }
}

function writePopupPayload(db, request) {
  const requesterName = getRequestName(request);
  const activeUserName = getCurrentActiveEmployeeName(db);

  const payload = {
    id: request.id,
    request_id: request.id,
    employee: requesterName,
    requester_name: requesterName,
    Utilisateur: requesterName,
    priority: getPriorityName(request),
    priority_level: getPriorityLevel(request),
    reason: cleanText(request.reason) || getPriorityName(request),
    motif: cleanText(request.reason) || getPriorityName(request),
    message: cleanText(request.message) || "-",
    active_user_name: activeUserName,
    expires_at: Date.now() + 5 * 60 * 1000,
    created_at: new Date().toISOString(),
  };

  writeJson(POPUP_FILE, payload);

  db.prepare(
    `
    UPDATE access_requests
    SET status = 'waiting_current_user',
        active_user_name = ?,
        response_message = ?,
        response_at = ''
    WHERE id = ?
    `
  ).run(
    activeUserName,
    `Demande envoyee a ${activeUserName}. En attente de sa reponse.`,
    request.id
  );

  return payload;
}

function launchPopup() {
  if (!fs.existsSync(POPUP_HTA)) {
    console.log("ERREUR: popup-window.hta introuvable:", POPUP_HTA);
    return;
  }

  spawn("mshta.exe", [POPUP_HTA], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  }).unref();
}

function processQueue() {
  ensureDir(RESPONSE_DIR);

  const db = openDb();

  try {
    ensureSchema(db);

    const currentPopup = readCurrentPopup();

    if (currentPopup && isPopupProcessRunning()) {
      return;
    }

    if (currentPopup && !isPopupProcessRunning()) {
      try {
        fs.unlinkSync(POPUP_FILE);
      } catch {
        // ignore
      }
    }

    const bestRequest = getBestRequest(db);

    if (!bestRequest) return;

    rejectLowerPriorityRequests(db, bestRequest);

    killOldPopupWindows();

    const payload = writePopupPayload(db, bestRequest);

    console.log(
      `Popup lance: demande #${payload.id} de ${payload.employee} vers utilisateur actif: ${payload.active_user_name}`
    );

    launchPopup();
  } catch (error) {
    console.error("Erreur popup-rdp-request:", error);
  } finally {
    db.close();
  }
}

console.log("RDP POPUP REQUEST MONITOR DEMARRE");
console.log("DB:", DB_PATH);
console.log("Popup:", POPUP_HTA);
console.log("Frequence:", CHECK_INTERVAL_MS, "ms");

processQueue();
setInterval(processQueue, CHECK_INTERVAL_MS);