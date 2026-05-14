const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const db = new Database("C:\\Logs\\rdp_access.db");

const result = db.prepare(`
  UPDATE access_requests
  SET
    status = 'rejected',
    current_user_response = 'cancelled',
    response_message = 'Demande annulee pour refaire un test propre.',
    response_at = datetime('now')
  WHERE status IN ('waiting_current_user', 'waiting_release', 'pending')
`).run();

db.close();

const dir = "C:\\Logs\\RDP_Request_Responses";
if (fs.existsSync(dir)) {
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("request_") && file.endsWith(".txt")) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

console.log("Queue nettoyee. Demandes annulees:", result.changes);