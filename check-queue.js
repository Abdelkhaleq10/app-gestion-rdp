const Database = require("better-sqlite3");

const db = new Database("C:\\Logs\\rdp_access.db");

console.log("DEMANDES ACTIVES:");
console.table(
  db.prepare(`
    SELECT id, Utilisateur, status, priority, priority_level, active_user_name, response_message
    FROM access_requests
    WHERE status IN ('waiting_current_user', 'waiting_release', 'pending')
    ORDER BY priority_level DESC, request_time ASC, id ASC
  `).all()
);

console.log("DERNIERES DEMANDES:");
console.table(
  db.prepare(`
    SELECT id, Utilisateur, status, priority, priority_level, active_user_name, response_message
    FROM access_requests
    ORDER BY id DESC
    LIMIT 10
  `).all()
);

db.close();