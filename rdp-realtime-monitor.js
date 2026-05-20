const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const http = require("http");
const Database = require("better-sqlite3");

const APP_DIR = "C:\\AppWeb";
const BASE_URL = "http://localhost:3000";
const DB_PATH = "C:\\Logs\\rdp_access.db";

const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const LOCK_FILE = path.join(RESPONSE_DIR, "realtime-monitor.lock");
const SESSION_OWNER_FILE = path.join(RESPONSE_DIR, "session-owner.json");

let runningStatus = false;
let runningPopup = false;
let runningSaveResponses = false;
let runningSyncResponses = false;
let runningSyncRelease = false;
let runningSessionOwner = false;
let tickRunning = false;

function now() {
  return new Date().toLocaleString("fr-FR");
}

function ensureDirs() {
  if (!fs.existsSync(RESPONSE_DIR)) {
    fs.mkdirSync(RESPONSE_DIR, { recursive: true });
  }
}

function cleanupLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const content = String(fs.readFileSync(LOCK_FILE, "utf8") || "").trim();
      if (Number(content) === process.pid) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch {}
}

function ensureSingleInstance() {
  ensureDirs();

  try {
    if (fs.existsSync(LOCK_FILE)) {
      const oldPid = Number(String(fs.readFileSync(LOCK_FILE, "utf8") || "").trim() || 0);

      if (oldPid && oldPid !== process.pid) {
        try {
          process.kill(oldPid, 0);
          console.log(`[${now()}] Une autre instance tourne deja (PID=${oldPid}). Arret.`);
          process.exit(0);
        } catch {}
      }
    }

    fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");

    process.on("exit", cleanupLock);
    process.on("SIGINT", () => {
      cleanupLock();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanupLock();
      process.exit(0);
    });
  } catch (e) {
    console.log(`[${now()}] Erreur lock: ${e.message}`);
  }
}

function runNodeScript(scriptName, label) {
  return new Promise((resolve) => {
    execFile(
      "node",
      [scriptName],
      {
        cwd: APP_DIR,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.log(`[${now()}] ${label} erreur: ${error.message}`);
        } else {
          const out = String(stdout || "").trim();
          if (out) console.log(`[${now()}] ${label}: ${out}`);
        }

        const err = String(stderr || "").trim();
        if (err) console.log(`[${now()}] ${label} stderr: ${err}`);

        resolve();
      }
    );
  });
}

function callUrl(route, label) {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${route}`, (res) => {
      res.resume();
      res.on("end", () => resolve());
    });

    req.on("error", () => resolve());

    req.setTimeout(3000, () => {
      req.destroy();
      resolve();
    });
  });
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
  if (text.includes("non identifie")) return true;
  if (text.includes("utilisateur actuellement connecte")) return true;
  if (text.includes("actuellement connecte")) return true;
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

function parseDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) return iso;

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    );
  }

  return null;
}

function isRecent(dateValue, maxMinutes) {
  const date = parseDate(dateValue);
  if (!date) return false;

  const diffMs = Date.now() - date.getTime();
  return diffMs >= 0 && diffMs <= maxMinutes * 60 * 1000;
}

function writeSessionOwner(name, source) {
  ensureDirs();

  const owner = {
    name,
    source,
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(SESSION_OWNER_FILE, JSON.stringify(owner, null, 2), "utf8");
}

function deleteSessionOwner() {
  try {
    if (fs.existsSync(SESSION_OWNER_FILE)) {
      fs.unlinkSync(SESSION_OWNER_FILE);
    }
  } catch {}
}

function getLastRecentAuthorizedUser(db) {
  try {
    const rows = db
      .prepare(
        `
        SELECT id, Utilisateur, active_user_name, response_at, status, response_message
        FROM access_requests
        WHERE status = 'authorized'
        ORDER BY id DESC
        LIMIT 30
        `
      )
      .all();

    for (const row of rows) {
      if (!isRecent(row.response_at, 240)) continue;

      const activeName = cleanName(row.active_user_name);
      if (activeName) {
        return {
          name: activeName,
          source: `access_requests.authorized.active_user_name#${row.id}`,
        };
      }

      const utilisateur = cleanName(row.Utilisateur);
      if (utilisateur) {
        return {
          name: utilisateur,
          source: `access_requests.authorized.Utilisateur#${row.id}`,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getLastIdentifiedRdpUser(db) {
  try {
    const rows = db
      .prepare(
        `
        SELECT id, date, heure, utilisateur, action
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

      if (
        action.includes("connexion") ||
        action.includes("reconnexion") ||
        action.includes("connecte")
      ) {
        return {
          name: user,
          source: `rdp_events#${row.id}`,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function updateSessionOwnerLoop() {
  if (runningSessionOwner) return;
  runningSessionOwner = true;

  try {
    if (!fs.existsSync(DB_PATH)) {
      deleteSessionOwner();
      return;
    }

    const db = new Database(DB_PATH);

    const owner =
      getLastIdentifiedRdpUser(db) ||
      getLastRecentAuthorizedUser(db);

    db.close();

    if (owner && owner.name) {
      writeSessionOwner(owner.name, owner.source);
    } else {
      deleteSessionOwner();
    }
  } catch (e) {
    console.log(`[${now()}] Session owner erreur: ${e.message}`);
  } finally {
    runningSessionOwner = false;
  }
}

async function popupLoop() {
  if (runningPopup) return;
  runningPopup = true;

  try {
    await runNodeScript("popup-rdp-request.js", "Popup");
  } finally {
    runningPopup = false;
  }
}

async function saveResponsesLoop() {
  if (runningSaveResponses) return;
  runningSaveResponses = true;

  try {
    await runNodeScript("save-popup-response.js", "Save responses");
  } finally {
    runningSaveResponses = false;
  }
}

async function syncResponsesLoop() {
  if (runningSyncResponses) return;
  runningSyncResponses = true;

  try {
    await callUrl("/api/sync-request-responses", "Sync responses");
  } finally {
    runningSyncResponses = false;
  }
}

async function syncReleaseLoop() {
  if (runningSyncRelease) return;
  runningSyncRelease = true;

  try {
    await callUrl("/api/sync-release", "Sync release");
  } finally {
    runningSyncRelease = false;
  }
}

async function updateStatusLoop() {
  if (runningStatus) return;
  runningStatus = true;

  try {
    await runNodeScript("update-status-now.js", "Status");
  } finally {
    runningStatus = false;
  }
}

async function tick() {
  if (tickRunning) return;
  tickRunning = true;

  try {
    // 1) save responses lwel bach popup mayb9ach y3awed y7ell
    await saveResponsesLoop();

    // 2) sync DB/API
    await syncResponsesLoop();
    await syncReleaseLoop();

    // 3) update session-owner automatique
    await updateSessionOwnerLoop();

    // 4) popup jdida ila kayna demande
    await popupLoop();

    // 5) update status
    await updateStatusLoop();
  } finally {
    tickRunning = false;
  }
}

ensureSingleInstance();

console.log("====================================");
console.log("RDP REALTIME MONITOR DEMARRE");
console.log("Frequence: 1 seconde");
console.log("Moteur popup: HTA");
console.log("Mode: SINGLE INSTANCE");
console.log("Session owner: automatique");
console.log("====================================");

tick();
setInterval(tick, 1000);