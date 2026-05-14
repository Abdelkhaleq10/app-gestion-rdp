const Database = require("better-sqlite3");

const db = new Database("C:/Logs/rdp_access.db");

const SERVER_IP = "10.102.104.44";

function cleanIp(value) {
  let ip = String(value || "").trim();

  if (!ip) return "N/A";
  if (ip === "-") return "N/A";
  if (ip.toLowerCase() === "local") return "N/A";
  if (ip === "::1") return "127.0.0.1";

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
}

function isValidIp(value) {
  const ip = cleanIp(value);
  return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(ip);
}

function isServerIp(value) {
  return cleanIp(value) === SERVER_IP;
}

function isBadUser(value) {
  const user = String(value || "").trim().toLowerCase();

  if (!user) return true;
  if (user === "n/a") return true;
  if (user === "-") return true;
  if (user === "autocad_user") return true;
  if (user === "s.cotti") return true;
  if (user.includes("acces direct non identifie")) return true;

  return false;
}

function parseDate(date, heure) {
  const d = String(date || "").trim();
  const h = String(heure || "00:00:00").trim();

  const fr = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr) {
    const day = Number(fr[1]);
    const month = Number(fr[2]) - 1;
    const year = Number(fr[3]);

    const tm = h.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    const hour = Number(tm?.[1] || 0);
    const minute = Number(tm?.[2] || 0);
    const second = Number(tm?.[3] || 0);

    return new Date(year, month, day, hour, minute, second).getTime();
  }

  const parsed = new Date(`${d} ${h}`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseRequestTime(requestTime) {
  const raw = String(requestTime || "").trim();

  const match = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);

    return new Date(year, month, day, hour, minute, second).getTime();
  }

  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

const authorizedRequests = db
  .prepare(
    `
    SELECT id, Utilisateur, ip, status, request_time
    FROM access_requests
    WHERE LOWER(status) LIKE '%autorise%'
       OR LOWER(status) LIKE '%autoris%'
    ORDER BY id DESC
    `
  )
  .all()
  .map((request) => ({
    ...request,
    ipClean: cleanIp(request.ip),
    timestamp: parseRequestTime(request.request_time),
  }))
  .filter((request) => {
    return (
      !isBadUser(request.Utilisateur) &&
      isValidIp(request.ipClean) &&
      !isServerIp(request.ipClean)
    );
  });

const badEvents = db
  .prepare(
    `
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    WHERE LOWER(utilisateur) = 's.cotti'
       OR LOWER(utilisateur) = 'autocad_user'
       OR utilisateur = 'N/A'
       OR utilisateur = 'Acces direct non identifie'
    ORDER BY id DESC
    `
  )
  .all()
  .filter((event) => {
    return isValidIp(event.ip) && !isServerIp(event.ip);
  });

const updateUser = db.prepare(`
  UPDATE rdp_events
  SET utilisateur = ?
  WHERE id = ?
`);

let updated = 0;

const updateTransaction = db.transaction(() => {
  for (const event of badEvents) {
    const eventIp = cleanIp(event.ip);
    const eventTimestamp = parseDate(event.date, event.heure);

    const candidate = authorizedRequests
      .filter((request) => request.ipClean === eventIp)
      .filter((request) => {
        if (!eventTimestamp || !request.timestamp) return true;

        const diff = eventTimestamp - request.timestamp;

        // demande autorisee qbel event, max 12h
        // tolerance 10 min ila timestamp decale
        return diff >= -10 * 60 * 1000 && diff <= 12 * 60 * 60 * 1000;
      })
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (candidate) {
      updateUser.run(candidate.Utilisateur, event.id);
      updated++;
    }
  }
});

updateTransaction();

console.log(`Utilisateurs techniques corriges: ${updated}`);

// Supprimer les doublons techniques:
// ex: meme date/heure/ip/action kayn hamza + s.cotti,
// nms7o s.cotti/autocad_user/Acces direct non identifie.
const duplicateBadRows = db
  .prepare(
    `
    SELECT bad.id
    FROM rdp_events bad
    WHERE (
      LOWER(bad.utilisateur) = 's.cotti'
      OR LOWER(bad.utilisateur) = 'autocad_user'
      OR bad.utilisateur = 'N/A'
      OR bad.utilisateur = 'Acces direct non identifie'
    )
    AND bad.ip IS NOT NULL
    AND bad.ip <> ''
    AND bad.ip <> 'N/A'
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
        AND LOWER(good.utilisateur) <> 's.cotti'
        AND LOWER(good.utilisateur) <> 'autocad_user'
    )
    `
  )
  .all();

const deleteById = db.prepare(`DELETE FROM rdp_events WHERE id = ?`);

let deletedDuplicates = 0;

const deleteTransaction = db.transaction(() => {
  for (const row of duplicateBadRows) {
    deleteById.run(row.id);
    deletedDuplicates++;
  }
});

deleteTransaction();

console.log(`Doublons techniques supprimes: ${deletedDuplicates}`);

console.log("\nDerniers events apres correction:");
console.table(
  db
    .prepare(
      `
      SELECT id, date, heure, utilisateur, ip, action
      FROM rdp_events
      ORDER BY id DESC
      LIMIT 30
      `
    )
    .all()
);

console.log("\nLignes restantes avec s.cotti/autocad_user:");
console.table(
  db
    .prepare(
      `
      SELECT id, date, heure, utilisateur, ip, action
      FROM rdp_events
      WHERE LOWER(utilisateur) = 's.cotti'
         OR LOWER(utilisateur) = 'autocad_user'
      ORDER BY id DESC
      LIMIT 30
      `
    )
    .all()
);

db.close();