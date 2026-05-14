const Database = require("better-sqlite3");

const db = new Database("C:/Logs/rdp_access.db");

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

function isValidIp(ip) {
  return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(cleanIp(ip));
}

function isBadUser(user) {
  const u = String(user || "").trim().toLowerCase();

  return (
    !u ||
    u === "n/a" ||
    u === "-" ||
    u === "autocad_user" ||
    u.includes("acces direct non identifie")
  );
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

const requests = db
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
  .map((r) => ({
    ...r,
    ipClean: cleanIp(r.ip),
    ts: parseDate(r.request_time, ""),
  }))
  .filter((r) => !isBadUser(r.Utilisateur) && isValidIp(r.ipClean));

const events = db
  .prepare(
    `
    SELECT id, date, heure, utilisateur, ip, action
    FROM rdp_events
    WHERE utilisateur = 'N/A'
       OR utilisateur = 'autocad_user'
       OR utilisateur = 'Acces direct non identifie'
    ORDER BY id DESC
    `
  )
  .all()
  .filter((e) => isValidIp(e.ip));

const update = db.prepare(`
  UPDATE rdp_events
  SET utilisateur = ?
  WHERE id = ?
`);

let fixed = 0;

const trx = db.transaction(() => {
  for (const event of events) {
    const eventIp = cleanIp(event.ip);
    const eventTs = parseDate(event.date, event.heure);

    const candidate = requests
      .filter((r) => r.ipClean === eventIp)
      .filter((r) => {
        if (!eventTs || !r.ts) return true;

        const diff = eventTs - r.ts;

        // demande autorisee qbel event, max 12h
        return diff >= -10 * 60 * 1000 && diff <= 12 * 60 * 60 * 1000;
      })
      .sort((a, b) => b.ts - a.ts)[0];

    if (candidate) {
      update.run(candidate.Utilisateur, event.id);
      fixed++;
    }
  }
});

trx();

console.log(`Repair termine. Lignes corrigees: ${fixed}`);

console.table(
  db
    .prepare(
      `
      SELECT id, date, heure, utilisateur, ip, action
      FROM rdp_events
      WHERE ip IS NOT NULL
        AND ip <> ''
        AND ip <> 'N/A'
      ORDER BY id DESC
      LIMIT 30
      `
    )
    .all()
);

db.close();