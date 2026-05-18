const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const http = require("http");

const APP_DIR = "C:\\AppWeb";
const BASE_URL = "http://localhost:3000";
const RESPONSE_DIR = "C:\\Logs\\RDP_Request_Responses";
const LOCK_FILE = path.join(RESPONSE_DIR, "realtime-monitor.lock");

let runningStatus = false;
let runningPopup = false;
let runningSaveResponses = false;
let runningSyncResponses = false;
let runningSyncRelease = false;
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
        } catch {
        }
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
    // 1) nqraw responses lwel bach "Non" ma y3awedch y7ell popup
    await saveResponsesLoop();

    // 2) nsynciw DB/API
    await syncResponsesLoop();
    await syncReleaseLoop();

    // 3) mn be3d ndecidiwach khass popup jdida
    await popupLoop();

    // 4) update status
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
console.log("====================================");

tick();
setInterval(tick, 1000);