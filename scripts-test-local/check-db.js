const Database = require("better-sqlite3");

const db = new Database("C:/Logs/rdp_access.db");

console.log("\n=== 1) Derniers 30 evenements RDP ===");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, type_ip, action
    FROM rdp_events
    ORDER BY id DESC
    LIMIT 30
  `).all()
);

console.log("\n=== 2) Toutes les IP trouvees dans l'historique ===");
console.table(
  db.prepare(`
    SELECT ip, COUNT(*) AS total
    FROM rdp_events
    WHERE ip IS NOT NULL
      AND ip <> ''
      AND ip <> 'N/A'
    GROUP BY ip
    ORDER BY total DESC
  `).all()
);

console.log("\n=== 3) Evenements avec utilisateur connu ===");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    WHERE utilisateur IS NOT NULL
      AND utilisateur <> ''
      AND utilisateur <> 'N/A'
      AND utilisateur <> 'Acces direct non identifie'
    ORDER BY id DESC
    LIMIT 50
  `).all()
);

console.log("\n=== 4) Evenements encore non identifies ===");
console.table(
  db.prepare(`
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    WHERE utilisateur = 'N/A'
       OR utilisateur = 'Acces direct non identifie'
       OR utilisateur = 'autocad_user'
    ORDER BY id DESC
    LIMIT 50
  `).all()
);

console.log("\n=== 5) Dernieres demandes d'acces ===");
console.table(
  db.prepare(`
    SELECT id, Utilisateur, ip, status, reason, request_time
    FROM access_requests
    ORDER BY id DESC
    LIMIT 50
  `).all()
);

db.close();