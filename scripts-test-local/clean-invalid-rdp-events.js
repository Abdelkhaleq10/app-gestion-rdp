const Database = require("better-sqlite3");

const db = new Database("C:/Logs/rdp_access.db");

const invalidValues = [
  "Session deconnectee",
  "Reconnexion RDP",
  "Connexion RDP",
  "Deconnexion RDP",
  "LOCAL",
  "-"
];

const deleteStmt = db.prepare(`
  DELETE FROM rdp_events
  WHERE ip IN (${invalidValues.map(() => "?").join(",")})
`);

const result = deleteStmt.run(...invalidValues);

console.log(`Nettoyage termine. Lignes supprimees: ${result.changes}`);

console.log("\nIPs restantes:");
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

db.close();