const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const Database = require("better-sqlite3");

const DB_PATH = "C:\\Logs\\rdp_access.db";
const APP_DIR = "C:\\AppWeb";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const CURRENT_POPUP_FILE = path.join(RESPONSE_DIR, "popup-current.json");
const HTA_FILE = path.join(APP_DIR, "popup-window.hta");

function ensureDirs() {
  if (!fs.existsSync(RESPONSE_DIR)) {
    fs.mkdirSync(RESPONSE_DIR, { recursive: true });
  }
}

function safeJsonRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeJsonWrite(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function responseFilePath(requestId) {
  return path.join(RESPONSE_DIR, `request_${requestId}.txt`);
}

function responseFileExists(requestId) {
  try {
    return fs.existsSync(responseFilePath(requestId));
  } catch {
    return false;
  }
}

function isProcessRunning(pid) {
  try {
    if (!pid) return false;

    const output = execFileSync("tasklist", ["/FI", `PID eq ${pid}`], {
      encoding: "utf8",
      windowsHide: true,
    });

    return output.includes(String(pid));
  } catch {
    return false;
  }
}

function killProcess(pid) {
  try {
    if (!pid) return;

    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {}
}

function killOldPowerShellPopups() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `
        Get-Process -ErrorAction SilentlyContinue |
        Where-Object {
          $_.MainWindowTitle -eq "Demande d'acces RDP" -or
          $_.MainWindowTitle -eq "Demande d’accès RDP" -or
          $_.MainWindowTitle -eq "RDP DEMANDE ACCES"
        } |
        ForEach-Object {
          Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }

        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
          $_.CommandLine -like '*show-rdp-popup.ps1*'
        } |
        ForEach-Object {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
        `,
      ],
      {
        windowsHide: true,
        stdio: "ignore",
      }
    );
  } catch {}
}

function killAllHtaPopups() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
          $_.CommandLine -like '*popup-window.hta*'
        } |
        ForEach-Object {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
        `,
      ],
      {
        windowsHide: true,
        stdio: "ignore",
      }
    );
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

function getColumns(db, tableName) {
  try {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((r) => r.name);
  } catch {
    return [];
  }
}

function ensureColumn(db, tableName, columnName, columnType) {
  const columns = getColumns(db, tableName);

  if (!columns.includes(columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`).run();
  }
}

function ensureSchema(db) {
  if (!tableExists(db, "access_requests")) return;

  ensureColumn(db, "access_requests", "priority", "TEXT DEFAULT 'consultation'");
  ensureColumn(db, "access_requests", "priority_level", "INTEGER DEFAULT 2");
  ensureColumn(db, "access_requests", "response_message", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "response_at", "TEXT DEFAULT ''");
  ensureColumn(db, "access_requests", "current_user_response", "TEXT DEFAULT ''");
}

function getRequestName(req) {
  return (
    req.Utilisateur ||
    req.utilisateur ||
    req.employee_name ||
    req.employeeName ||
    req.full_name ||
    req.fullName ||
    req.nom_complet ||
    req.nom ||
    req.user ||
    "Utilisateur"
  );
}

function getRequestReason(req) {
  return req.reason || req.motif || req.priority || "Demande";
}

function getRequestMessage(req) {
  return req.message || req.commentaire || req.details || "";
}

function getActiveRequests(db) {
  return db
    .prepare(
      `
      SELECT *
      FROM access_requests
      WHERE status IN ('pending', 'waiting_current_user')
      ORDER BY priority_level DESC, id ASC
      `
    )
    .all();
}

function rejectRequest(db, requestId, message) {
  db.prepare(
    `
    UPDATE access_requests
    SET status = 'rejected',
        current_user_response = 'auto_rejected',
        response_message = ?,
        response_at = datetime('now', 'localtime')
    WHERE id = ?
    AND status IN ('pending', 'waiting_current_user')
    `
  ).run(message, requestId);
}

function markWaitingCurrentUser(db, req) {
  db.prepare(
    `
    UPDATE access_requests
    SET status = 'waiting_current_user',
        response_message = 'Demande envoyee a l''utilisateur actuellement connecte. En attente de sa reponse.'
    WHERE id = ?
    AND status IN ('pending', 'waiting_current_user')
    `
  ).run(req.id);
}

function rejectLosers(db, winner, requests) {
  const winnerPriority = Number(winner.priority_level || 1);

  for (const req of requests) {
    if (Number(req.id) === Number(winner.id)) continue;

    const reqPriority = Number(req.priority_level || 1);

    if (reqPriority < winnerPriority) {
      rejectRequest(
        db,
        req.id,
        `Demande refusee automatiquement car une demande plus prioritaire de ${getRequestName(winner)} est traitee.`
      );
      continue;
    }

    if (reqPriority === winnerPriority && Number(req.id) > Number(winner.id)) {
      rejectRequest(
        db,
        req.id,
        `Demande refusee automatiquement car une demande de meme priorite de ${getRequestName(winner)} est arrivee avant.`
      );
    }
  }
}

function launchPopup(winner) {
  killOldPowerShellPopups();

  if (responseFileExists(winner.id)) {
    return;
  }

  const current = safeJsonRead(CURRENT_POPUP_FILE);

  if (
    current &&
    Number(current.requestId) === Number(winner.id) &&
    current.pid &&
    isProcessRunning(current.pid)
  ) {
    return;
  }

  if (current?.pid) {
    killProcess(current.pid);
  }

  killAllHtaPopups();

  const popupToken = `${winner.id}-${Date.now()}`;

  const currentData = {
    requestId: Number(winner.id),
    popupToken,
    priorityLevel: Number(winner.priority_level || 1),
    employee: getRequestName(winner),
    priority: winner.priority || "consultation",
    reason: getRequestReason(winner),
    message: getRequestMessage(winner),
    startedAt: new Date().toISOString(),
    pid: 0,
  };

  safeJsonWrite(CURRENT_POPUP_FILE, currentData);

  const child = spawn("mshta.exe", [HTA_FILE], {
    cwd: APP_DIR,
    windowsHide: false,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  currentData.pid = child.pid;
  safeJsonWrite(CURRENT_POPUP_FILE, currentData);

  console.log(
    `Popup HTA lance: #${winner.id} ${getRequestName(winner)} P${winner.priority_level} PID=${child.pid}`
  );
}

function main() {
  ensureDirs();
  killOldPowerShellPopups();

  if (!fs.existsSync(DB_PATH)) {
    console.log("DB introuvable:", DB_PATH);
    return;
  }

  const db = new Database(DB_PATH);

  if (!tableExists(db, "access_requests")) {
    db.close();
    return;
  }

  ensureSchema(db);

  const requests = getActiveRequests(db);

  if (requests.length === 0) {
    const current = safeJsonRead(CURRENT_POPUP_FILE);

    if (current?.pid) {
      killProcess(current.pid);
    }

    safeDelete(CURRENT_POPUP_FILE);
    killAllHtaPopups();
    killOldPowerShellPopups();

    db.close();
    return;
  }

  const winner = requests[0];

  rejectLosers(db, winner, requests);
  markWaitingCurrentUser(db, winner);
  launchPopup(winner);

  db.close();
}

main();