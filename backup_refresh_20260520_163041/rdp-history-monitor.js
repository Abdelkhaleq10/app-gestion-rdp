const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const APP_DIR = "C:\\AppWeb";

const POSSIBLE_DIRS = [
  "C:\\AppWeb\\scripts_RDP",
  "C:\\AppWeb\\script_RDP",
  "C:\\AppWeb\\Logs",
  "C:\\Logs",
];

const KEYWORDS = [
  "rdp",
  "history",
  "historique",
  "log",
  "users",
  "session",
  "event",
  "backend",
];

let running = false;
let selectedScript = null;

function now() {
  return new Date().toLocaleString("fr-FR");
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function scoreFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  let score = 0;

  for (const keyword of KEYWORDS) {
    if (name.includes(keyword)) score += 10;
  }

  if (name.includes("rdp")) score += 20;
  if (name.includes("history") || name.includes("historique")) score += 20;
  if (name.includes("backend")) score += 15;
  if (name.includes("users")) score += 10;
  if (name.includes("report")) score -= 5;
  if (name.includes("test")) score -= 30;
  if (name.includes("demo")) score -= 30;

  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".ps1") score += 30;
  if (ext === ".js") score += 10;
  if (ext === ".bat" || ext === ".cmd") score += 5;

  return score;
}

function findCandidateScripts() {
  const files = [];

  for (const dir of POSSIBLE_DIRS) {
    if (!dirExists(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filePath = path.join(dir, entry.name);
      const ext = path.extname(filePath).toLowerCase();

      if (![".ps1", ".js", ".bat", ".cmd"].includes(ext)) continue;

      const score = scoreFile(filePath);

      if (score > 0) {
        files.push({
          filePath,
          score,
          name: entry.name,
          ext,
        });
      }
    }
  }

  files.sort((a, b) => b.score - a.score);

  return files;
}

function selectScript() {
  if (selectedScript && fileExists(selectedScript.filePath)) {
    return selectedScript;
  }

  const candidates = findCandidateScripts();

  if (candidates.length === 0) {
    return null;
  }

  selectedScript = candidates[0];

  console.log(`[${now()}] Script historique selectionne:`);
  console.table([selectedScript]);

  return selectedScript;
}

function runPowerShell(scriptPath) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
        scriptPath,
      ],
      {
        cwd: path.dirname(scriptPath),
        windowsHide: true,
        timeout: 20000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.log(`[${now()}] Historique PS erreur: ${error.message}`);
        } else {
          console.log(`[${now()}] Historique PS OK: ${path.basename(scriptPath)}`);
        }

        const err = String(stderr || "").trim();
        if (err) console.log(`[${now()}] STDERR: ${err}`);

        resolve();
      }
    );
  });
}

function runNode(scriptPath) {
  return new Promise((resolve) => {
    execFile(
      "node",
      [scriptPath],
      {
        cwd: path.dirname(scriptPath),
        windowsHide: true,
        timeout: 20000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.log(`[${now()}] Historique JS erreur: ${error.message}`);
        } else {
          console.log(`[${now()}] Historique JS OK: ${path.basename(scriptPath)}`);
        }

        const err = String(stderr || "").trim();
        if (err) console.log(`[${now()}] STDERR: ${err}`);

        resolve();
      }
    );
  });
}

function runBatch(scriptPath) {
  return new Promise((resolve) => {
    execFile(
      "cmd.exe",
      ["/c", scriptPath],
      {
        cwd: path.dirname(scriptPath),
        windowsHide: true,
        timeout: 20000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.log(`[${now()}] Historique BAT erreur: ${error.message}`);
        } else {
          console.log(`[${now()}] Historique BAT OK: ${path.basename(scriptPath)}`);
        }

        const err = String(stderr || "").trim();
        if (err) console.log(`[${now()}] STDERR: ${err}`);

        resolve();
      }
    );
  });
}

async function tick() {
  if (running) return;

  running = true;

  try {
    const script = selectScript();

    if (!script) {
      console.log(`[${now()}] Aucun script historique trouve.`);
      return;
    }

    if (script.ext === ".ps1") {
      await runPowerShell(script.filePath);
      return;
    }

    if (script.ext === ".js") {
      await runNode(script.filePath);
      return;
    }

    if (script.ext === ".bat" || script.ext === ".cmd") {
      await runBatch(script.filePath);
      return;
    }
  } finally {
    running = false;
  }
}

console.log("====================================");
console.log("RDP HISTORY MONITOR DEMARRE");
console.log("Frequence: 5 secondes");
console.log("Dossiers surveilles:");
console.log(POSSIBLE_DIRS.join("\n"));
console.log("====================================");

tick();
setInterval(tick, 5000);