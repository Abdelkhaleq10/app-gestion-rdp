const Database = require("better-sqlite3");
const db = new Database("C:\\Logs\\rdp_access.db");

const r = db.prepare(`
  UPDATE access_requests
  SET status = 'pending',
      current_user_response = '',
      response_message = '',
      response_at = '',
      active_user_name = ''
  WHERE id = (SELECT id FROM access_requests ORDER BY id DESC LIMIT 1)
`).run();

console.log("Derniere demande remise pending:", r.changes);
db.close();
