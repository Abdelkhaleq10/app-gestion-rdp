const Database = require("better-sqlite3");

const db = new Database("C:/Logs/rdp_access.db");

const technicalUsers = ["s.cotti", "autocad_user"];

// 1) Delete technical duplicates if a good row exists with same date/heure/ip/action
const duplicates = db.prepare(`
  SELECT bad.id
  FROM rdp_events bad
  WHERE LOWER(bad.utilisateur) IN ('s.cotti', 'autocad_user')
  AND EXISTS (
    SELECT 1
    FROM rdp_events good
    WHERE good.id <> bad.id
      AND good.date = bad.date
      AND good.heure = bad.heure
      AND good.ip = bad.ip
      AND good.action = bad.action
      AND good.utilisateur IS NOT NULL
      AND good.utilisateur <> ''
      AND good.utilisateur <> 'N/A'
      AND good.utilisateur <> 'Acces direct non identifie'
      AND LOWER(good.utilisateur) NOT IN ('s.cotti', 'autocad_user')
  )
`).all();

const deleteById = db.prepare("DELETE FROM rdp_events WHERE id = ?");

let deleted = 0;

const deleteTx = db.transaction(() => {
  for (const row of duplicates) {
    deleteById.run(row.id);
    deleted++;
  }
});

deleteTx();

// 2) Convert remaining technical users to Acces direct non identifie
const updateResult = db.prepare(`
  UPDATE rdp_events
  SET utilisateur = 'Acces direct non identifie'
  WHERE LOWER(utilisateur) IN ('s.cotti', 'autocad_user')
`).run();

console.log(`Doublons techniques supprimes: ${deleted}`);
console.log(`Lignes techniques converties en Acces direct non identifie: ${updateResult.changes}`);

console.log("\nVerification lignes restantes s.cotti/autocad_user:");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    WHERE LOWER(utilisateur) IN ('s.cotti', 'autocad_user')
    ORDER BY id DESC
    LIMIT 30
  `).all()
);

console.log("\nDerniers 30 evenements:");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    ORDER BY id DESC
    LIMIT 30
  `).all()
);

db.close();