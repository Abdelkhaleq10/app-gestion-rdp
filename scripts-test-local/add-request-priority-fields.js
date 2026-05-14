const Database = require("better-sqlite3");

const db = new Database("C:\\Logs\\rdp_access.db");

function columnExists(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((c) => c.name === column);
}

function addColumnIfMissing(table, column, definition) {
  if (!columnExists(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    console.log(`Ajoute: ${column}`);
  } else {
    console.log(`Existe deja: ${column}`);
  }
}

try {
  console.log("Verification table access_requests...");

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((t) => t.name);

  if (!tables.includes("access_requests")) {
    console.error("Erreur: table access_requests introuvable");
    process.exit(1);
  }

  addColumnIfMissing("access_requests", "priority", "TEXT DEFAULT 'normal'");
  addColumnIfMissing("access_requests", "reason", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "priority_level", "INTEGER DEFAULT 1");
  addColumnIfMissing("access_requests", "current_user_response", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_message", "TEXT DEFAULT ''");
  addColumnIfMissing("access_requests", "response_at", "TEXT DEFAULT ''");

  console.log("Migration terminee avec succes.");

  const columns = db.prepare("PRAGMA table_info(access_requests)").all();
  console.table(columns.map((c) => ({ colonne: c.name, type: c.type })));
} catch (error) {
  console.error("Erreur migration:", error.message);
} finally {
  db.close();
}