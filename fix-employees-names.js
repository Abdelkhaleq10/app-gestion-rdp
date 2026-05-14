const Database = require("better-sqlite3");

const db = new Database("C:\\Logs\\rdp_access.db");

const cols = db.prepare("PRAGMA table_info(employees)").all().map(c => c.name);

function hasCol(name) {
  return cols.includes(name);
}

if (hasCol("nom_complet") && hasCol("full_name")) {
  db.prepare(`
    UPDATE employees
    SET full_name = nom_complet
    WHERE (full_name IS NULL OR TRIM(full_name) = '')
      AND nom_complet IS NOT NULL
      AND TRIM(nom_complet) <> ''
  `).run();
}

if (hasCol("full_name")) {
  db.prepare(`
    DELETE FROM employees
    WHERE full_name IS NULL
       OR TRIM(full_name) = ''
       OR LOWER(TRIM(full_name)) = 'n/a'
  `).run();
}

if (hasCol("username") && hasCol("full_name")) {
  const rows = db.prepare(`
    SELECT id, full_name, username
    FROM employees
    WHERE username IS NULL OR TRIM(username) = ''
  `).all();

  function makeUsername(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/\\s+/g, ".")
      .replace(/[^a-z0-9._-]/g, "");
  }

  function usernameExists(username, id) {
    return db.prepare(`
      SELECT id FROM employees
      WHERE LOWER(username)=LOWER(?)
        AND id <> ?
      LIMIT 1
    `).get(username, id);
  }

  for (const row of rows) {
    const base = makeUsername(row.full_name);
    if (!base) continue;

    let username = base;
    let i = 1;

    while (usernameExists(username, row.id)) {
      username = `${base}${i}`;
      i++;
    }

    db.prepare(`
      UPDATE employees
      SET username = ?, updated_at = ?
      WHERE id = ?
    `).run(username, new Date().toISOString(), row.id);
  }
}

console.log("Nettoyage termine.");

console.table(
  db.prepare(`
    SELECT id, full_name, username, is_active, must_change_password
    FROM employees
    ORDER BY id DESC
    LIMIT 30
  `).all()
);

db.close();