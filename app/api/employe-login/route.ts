import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

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

function ensureEmployeesColumns() {
  ensureColumn("employees", "full_name", "TEXT DEFAULT ''");
  ensureColumn("employees", "nom_complet", "TEXT DEFAULT ''");
  ensureColumn("employees", "password_hash", "TEXT DEFAULT ''");
  ensureColumn("employees", "is_active", "INTEGER DEFAULT 1");
  ensureColumn("employees", "must_change_password", "INTEGER DEFAULT 1");
  ensureColumn("employees", "last_login_at", "TEXT DEFAULT ''");
  ensureColumn("employees", "updated_at", "TEXT DEFAULT ''");
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
    ensureEmployeesColumns();

    const body = await request.json().catch(() => ({}));

    const fullName = normalizeText(
      body.full_name || body.nom_complet || body.employeeName || body.employeName
    );

    const password = normalizeText(body.password);

    if (!fullName || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Nom complet et mot de passe obligatoires.",
        },
        { status: 400 }
      );
    }

    const nameExpr = nameExpression();

    const employee = db
      .prepare(
        `
        SELECT
          *,
          ${nameExpr} AS employee_name
        FROM employees
        WHERE LOWER(${nameExpr}) = LOWER(?)
        LIMIT 1
        `
      )
      .get(fullName) as any;

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: "Compte employe introuvable.",
        },
        { status: 404 }
      );
    }

    if (Number(employee.is_active ?? 1) !== 1) {
      return NextResponse.json(
        {
          success: false,
          message: "Compte desactive. Veuillez contacter le responsable.",
        },
        { status: 403 }
      );
    }

    const passwordHash = String(employee.password_hash || "");

    if (!passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: "Mot de passe non configure. Veuillez contacter le responsable.",
        },
        { status: 403 }
      );
    }

    const passwordOk = await bcrypt.compare(password, passwordHash);

    if (!passwordOk) {
      return NextResponse.json(
        {
          success: false,
          message: "Mot de passe incorrect.",
        },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    db.prepare(
      `
      UPDATE employees
      SET last_login_at = ?,
          updated_at = ?
      WHERE id = ?
      `
    ).run(now, now, employee.id);

    return NextResponse.json({
      success: true,
      message: "Connexion reussie.",
      employee: {
        id: employee.id,
        full_name: employee.employee_name,
        is_active: Number(employee.is_active ?? 1),
        must_change_password: Number(employee.must_change_password ?? 1),
        last_login_at: now,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la connexion employe.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}