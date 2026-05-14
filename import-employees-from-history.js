const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database("C:\\Logs\\rdp_access.db");

function tableExists(table) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
  return !!row;
}

function columns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function columnExists(table, column) {
  return columns(table).some((c) => c.name === column);
}

function addColumnIfMissing(table, column, definition) {
  if (!columnExists(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

if (!tableExists("employees")) {
  db.prepare(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT DEFAULT '',
      nom_complet TEXT DEFAULT '',
      username TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      email TEXT DEFAULT '',
      pc_name TEXT DEFAULT '',
      department TEXT DEFAULT '',
      role TEXT DEFAULT 'Employe',
      is_active INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 1,
      last_login_at TEXT DEFAULT '',
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      created_by TEXT DEFAULT 'Responsable',
      updated_by TEXT DEFAULT 'Responsable'
    )
  `).run();
} else {
  addColumnIfMissing("employees", "full_name", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "username", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "password_hash", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "email", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "pc_name", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "department", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "role", "TEXT DEFAULT 'Employe'");
  addColumnIfMissing("employees", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing("employees", "must_change_password", "INTEGER DEFAULT 1");
  addColumnIfMissing("employees", "last_login_at", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "created_at", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "updated_at", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "created_by", "TEXT DEFAULT 'Responsable'");
  addColumnIfMissing("employees", "updated_by", "TEXT DEFAULT 'Responsable'");
}

const employeeColumns = columns("employees").map((c) => c.name);
const hasNomComplet = employeeColumns.includes("nom_complet");
const hasFullName = employeeColumns.includes("full_name");

function usernameFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

function employeeExists(name) {
  const conditions = [];
  const params = [];

  if (hasFullName) {
    conditions.push("LOWER(full_name)=LOWER(?)");
    params.push(name);
  }

  if (hasNomComplet) {
    conditions.push("LOWER(nom_complet)=LOWER(?)");
    params.push(name);
  }

  if (conditions.length === 0) return false;

  return db
    .prepare(`SELECT id FROM employees WHERE ${conditions.join(" OR ")} LIMIT 1`)
    .get(...params);
}

function usernameExists(username) {
  return db
    .prepare("SELECT id FROM employees WHERE LOWER(username)=LOWER(?) LIMIT 1")
    .get(username);
}

const names = db.prepare(`
  SELECT DISTINCT Utilisateur AS name
  FROM access_requests
  WHERE Utilisateur IS NOT NULL
    AND TRIM(Utilisateur) <> ''
    AND LOWER(Utilisateur) NOT LIKE '%test%'
    AND LOWER(Utilisateur) NOT LIKE '%inconnu%'
    AND LOWER(Utilisateur) NOT LIKE '%n/a%'
  ORDER BY Utilisateur ASC
`).all();

const defaultPassword = "1234";
const passwordHash = bcrypt.hashSync(defaultPassword, 10);
const now = new Date().toISOString();

let added = 0;
let skipped = 0;

for (const row of names) {
  const fullName = String(row.name || "").trim();

  if (!fullName) {
    skipped++;
    continue;
  }

  if (employeeExists(fullName)) {
    skipped++;
    continue;
  }

  const baseUsername = usernameFromName(fullName);
  if (!baseUsername) {
    skipped++;
    continue;
  }

  let finalUsername = baseUsername;
  let index = 1;

  while (usernameExists(finalUsername)) {
    finalUsername = `${baseUsername}${index}`;
    index++;
  }

  const insertColumns = [];
  const placeholders = [];
  const values = [];

  function addValue(column, value) {
    if (employeeColumns.includes(column)) {
      insertColumns.push(column);
      placeholders.push("?");
      values.push(value);
    }
  }

  addValue("full_name", fullName);
  addValue("nom_complet", fullName);
  addValue("username", finalUsername);
  addValue("password_hash", passwordHash);
  addValue("email", "");
  addValue("pc_name", "");
  addValue("department", "");
  addValue("role", "Employe");
  addValue("is_active", 1);
  addValue("must_change_password", 1);
  addValue("last_login_at", "");
  addValue("created_at", now);
  addValue("updated_at", now);
  addValue("created_by", "Import historique");
  addValue("updated_by", "Import historique");

  db.prepare(`
    INSERT INTO employees (${insertColumns.join(", ")})
    VALUES (${placeholders.join(", ")})
  `).run(...values);

  added++;
}

console.log("Comptes ajoutes:", added);
console.log("Comptes ignores:", skipped);
console.log("Mot de passe initial:", defaultPassword);

const selectName = hasFullName ? "full_name" : "nom_complet";

console.table(
  db.prepare(`
    SELECT id, ${selectName} AS nom, username, is_active, must_change_password
    FROM employees
    ORDER BY id DESC
    LIMIT 20
  `).all()
);

db.close();