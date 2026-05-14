const Database = require("better-sqlite3");

const db = new Database("C:/Logs/rdp_access.db");

const result = db.prepare(`
  UPDATE rdp_events
  SET utilisateur = 'Acces direct non identifie'
  WHERE LOWER(TRIM(utilisateur)) LIKE 'domaine%'
     OR LOWER(TRIM(utilisateur)) LIKE 'domain%'
`).run();

console.log(`Lignes Domaine corrigees: ${result.changes}`);

console.log("\nVerification Domaine restant:");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    WHERE LOWER(TRIM(utilisateur)) LIKE 'domaine%'
       OR LOWER(TRIM(utilisateur)) LIKE 'domain%'
    ORDER BY id DESC
    LIMIT 20
  `).all()
);

console.log("\nDerniers 20 events:");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    ORDER BY id DESC
    LIMIT 20
  `).all()
);

db.close();