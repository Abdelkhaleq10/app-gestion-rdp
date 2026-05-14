const Database = require("better-sqlite3");

const db = new Database("C:\\Logs\\rdp_access.db");

console.log("Demandes actives avant nettoyage:");
console.table(
  db
    .prepare(
      `
      SELECT
        id,
        Utilisateur,
        status,
        priority,
        priority_level,
        response_message
      FROM access_requests
      WHERE status IN ('waiting_current_user', 'waiting_release', 'pending')
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 20
      `
    )
    .all()
);

const result = db
  .prepare(
    `
    UPDATE access_requests
    SET
      status = 'rejected',
      current_user_response = 'cancelled',
      response_message = 'Demande annulee pour nouveau test de file d attente.',
      response_at = datetime('now')
    WHERE status IN ('waiting_current_user', 'waiting_release', 'pending')
    `
  )
  .run();

console.log("Demandes nettoyees:", result.changes);

console.log("Demandes actives apres nettoyage:");
console.table(
  db
    .prepare(
      `
      SELECT
        id,
        Utilisateur,
        status,
        priority,
        priority_level,
        response_message
      FROM access_requests
      WHERE status IN ('waiting_current_user', 'waiting_release', 'pending')
      ORDER BY priority_level DESC, request_time ASC, id ASC
      LIMIT 20
      `
    )
    .all()
);

db.close();