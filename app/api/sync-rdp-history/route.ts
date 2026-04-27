import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "../../../lib/db";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalize(v: string) {
  return (v || "").trim();
}

export async function GET() {
  try {
    const filePath = path.join("C:\\", "Logs", "RDP_Users_History.csv");

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        message: "Fichier RDP_Users_History.csv introuvable.",
      });
    }

    const content = fs.readFileSync(filePath, "utf-8").trim();

    if (!content) {
      return NextResponse.json({
        success: false,
        message: "Fichier RDP_Users_History.csv vide.",
      });
    }

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        message: "Aucune ligne a synchroniser.",
      });
    }

    const csvRows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);

      return {
        date: normalize(values[0] || ""),
        heure: normalize(values[1] || ""),
        utilisateur: normalize(values[2] || ""),
        machine: normalize(values[3] || ""),
        session_id: normalize(values[4] || ""),
        nom_session: normalize(values[5] || ""),
        ip: normalize(values[6] || ""),
        type_ip: normalize(values[7] || ""),
        action: normalize(values[8] || ""),
        session_active: normalize(values[9] || ""),
      };
    });

    const existingRows = db
      .prepare(
        `
        SELECT
          date,
          heure,
          utilisateur,
          machine,
          session_id,
          nom_session,
          ip,
          type_ip,
          action,
          session_active
        FROM rdp_events
        `
      )
      .all() as Array<{
      date: string;
      heure: string;
      utilisateur: string;
      machine: string;
      session_id: string;
      nom_session: string;
      ip: string;
      type_ip: string;
      action: string;
      session_active: string;
    }>;

    const existingKeys = new Set(
      existingRows.map(
        (row) =>
          [
            normalize(row.date),
            normalize(row.heure),
            normalize(row.utilisateur),
            normalize(row.machine),
            normalize(row.session_id),
            normalize(row.nom_session),
            normalize(row.ip),
            normalize(row.type_ip),
            normalize(row.action),
            normalize(row.session_active),
          ].join("|")
      )
    );

    const insertStmt = db.prepare(`
      INSERT INTO rdp_events
      (
        date,
        heure,
        utilisateur,
        machine,
        session_id,
        nom_session,
        ip,
        type_ip,
        action,
        session_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;

    const insertMany = db.transaction((rows: typeof csvRows) => {
      for (const row of rows) {
        const key = [
          row.date,
          row.heure,
          row.utilisateur,
          row.machine,
          row.session_id,
          row.nom_session,
          row.ip,
          row.type_ip,
          row.action,
          row.session_active,
        ].join("|");

        if (!existingKeys.has(key)) {
          insertStmt.run(
            row.date,
            row.heure,
            row.utilisateur,
            row.machine,
            row.session_id,
            row.nom_session,
            row.ip,
            row.type_ip,
            row.action,
            row.session_active
          );

          existingKeys.add(key);
          inserted++;
        }
      }
    });

    insertMany(csvRows);

    const totalRow = db
      .prepare(`SELECT COUNT(*) as total FROM rdp_events`)
      .get() as { total: number } | undefined;

    return NextResponse.json({
      success: true,
      message: "Synchronisation terminee.",
      inserted,
      total_after_sync: totalRow?.total || 0,
    });
  } catch (error) {
    console.error("Erreur /api/sync-rdp-history :", error);
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la synchronisation.",
      },
      { status: 500 }
    );
  }
}