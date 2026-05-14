import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function getColumns(table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
}

function hasColumn(table: string, column: string) {
  return getColumns(table).some((c) => c.name === column);
}

function ensureColumn(table: string, column: string, definition: string) {
  if (!hasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function nameExpression() {
  const hasFullName = hasColumn("employees", "full_name");
  const hasNomComplet = hasColumn("employees", "nom_complet");

  if (hasFullName && hasNomComplet) {
    return "COALESCE(NULLIF(full_name, ''), NULLIF(nom_complet, ''), '')";
  }

  if (hasFullName) return "COALESCE(full_name, '')";
  if (hasNomComplet) return "COALESCE(nom_complet, '')";

  return "''";
}

export async function POST(request: NextRequest) {
  try {
    ensureColumn("employees", "last_login_at", "TEXT DEFAULT ''");
    ensureColumn("employees", "updated_at", "TEXT DEFAULT ''");

    const body = await request.json().catch(() => ({}));
    const fullName = normalizeText(
      body.full_name || body.nom_complet || body.employeeName || body.employeName
    );

    if (!fullName) {
      return NextResponse.json(
        {
          success: false,
          message: "Nom employe obligatoire.",
        },
        { status: 400 }
      );
    }

    const nameExpr = nameExpression();
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `
        UPDATE employees
        SET last_login_at = ?,
            updated_at = ?
        WHERE LOWER(${nameExpr}) = LOWER(?)
        `
      )
      .run(now, now, fullName);

    if (result.changes === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Compte employe introuvable.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Derniere connexion mise a jour.",
      last_login_at: now,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la mise a jour de la derniere connexion.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
