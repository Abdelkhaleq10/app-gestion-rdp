import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUsername(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

function getColumns(table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
}

function columnExists(table: string, column: string) {
  return getColumns(table).some((c) => c.name === column);
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!columnExists(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureEmployeesTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT DEFAULT '',
      nom_complet TEXT DEFAULT '',
      username TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      email TEXT DEFAULT '',
      pc_name TEXT DEFAULT '',
      department TEXT DEFAULT '',
      role TEXT DEFAULT 'Employe',
      is_active INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 1,
      last_login_at TEXT DEFAULT '',
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      created_by TEXT DEFAULT 'Responsable',
      updated_by TEXT DEFAULT 'Responsable'
    )
  `).run();

  addColumnIfMissing("employees", "full_name", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "username", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "password_hash", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "email", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "pc_name", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "department", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "role", "TEXT DEFAULT 'Employe'");
  addColumnIfMissing("employees", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing("employees", "must_change_password", "INTEGER DEFAULT 1");
  addColumnIfMissing("employees", "last_login_at", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "created_at", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "updated_at", "TEXT DEFAULT ''");
  addColumnIfMissing("employees", "created_by", "TEXT DEFAULT 'Responsable'");
  addColumnIfMissing("employees", "updated_by", "TEXT DEFAULT 'Responsable'");
}

function rowNameExpression() {
  const cols = getColumns("employees").map((c) => c.name);

  if (cols.includes("full_name") && cols.includes("nom_complet")) {
    return "COALESCE(NULLIF(full_name, ''), NULLIF(nom_complet, ''), '')";
  }

  if (cols.includes("full_name")) return "COALESCE(full_name, '')";
  if (cols.includes("nom_complet")) return "COALESCE(nom_complet, '')";

  return "''";
}

function employeeNameExists(fullName: string, idToIgnore?: number) {
  const nameExpr = rowNameExpression();

  if (idToIgnore) {
    return db
      .prepare(
        `
        SELECT id FROM employees
        WHERE LOWER(${nameExpr}) = LOWER(?)
          AND id <> ?
        LIMIT 1
        `
      )
      .get(fullName, idToIgnore);
  }

  return db
    .prepare(
      `
      SELECT id FROM employees
      WHERE LOWER(${nameExpr}) = LOWER(?)
      LIMIT 1
      `
    )
    .get(fullName);
}

function usernameExists(username: string, idToIgnore?: number) {
  if (!username) return false;

  if (idToIgnore) {
    return db
      .prepare(
        `
        SELECT id FROM employees
        WHERE LOWER(username) = LOWER(?)
          AND id <> ?
        LIMIT 1
        `
      )
      .get(username, idToIgnore);
  }

  return db
    .prepare(
      `
      SELECT id FROM employees
      WHERE LOWER(username) = LOWER(?)
      LIMIT 1
      `
    )
    .get(username);
}

function makeUsername(fullName: string) {
  const base = normalizeUsername(fullName);
  if (!base) return "";

  let username = base;
  let i = 1;

  while (usernameExists(username)) {
    username = `${base}${i}`;
    i++;
  }

  return username;
}

function publicEmployee(row: any) {
  return {
    id: row.id,
    full_name: row.full_name || row.nom_complet || "",
    username: row.username || "",
    email: row.email || "",
    pc_name: row.pc_name || "",
    department: row.department || "",
    role: row.role || "Employe",
    is_active: Number(row.is_active ?? 1),
    must_change_password: Number(row.must_change_password ?? 1),
    last_login_at: row.last_login_at || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

export async function GET(req: NextRequest) {
  try {
    ensureEmployeesTable();

    const searchParams = req.nextUrl.searchParams;
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status"));

    const nameExpr = rowNameExpression();

    const whereParts: string[] = [];
    const params: Array<string | number> = [];

    if (search) {
      const like = `%${search}%`;

      whereParts.push(`
        (
          ${nameExpr} LIKE ?
          OR username LIKE ?
          OR email LIKE ?
          OR pc_name LIKE ?
          OR department LIKE ?
          OR role LIKE ?
        )
      `);

      params.push(like, like, like, like, like, like);
    }

    if (status === "active") whereParts.push("is_active = 1");
    if (status === "inactive") whereParts.push("is_active = 0");

    const whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = db
      .prepare(
        `
        SELECT *
        FROM employees
        ${whereClause}
        ORDER BY is_active DESC, ${nameExpr} ASC
        `
      )
      .all(...params);

    return NextResponse.json({
      success: true,
      items: rows.map(publicEmployee),
      total: rows.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du chargement des comptes employes.",
        error: error?.message ?? String(error),
        items: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureEmployeesTable();

    const body = await req.json().catch(() => ({}));

    const fullName = normalizeText(body.full_name || body.nom_complet || body.name);
    const username = normalizeUsername(body.username) || makeUsername(fullName);
    const password = normalizeText(body.password || body.initial_password);
    const now = new Date().toISOString();

    if (!fullName) {
      return NextResponse.json(
        { success: false, message: "Le nom complet est obligatoire." },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { success: false, message: "Le mot de passe doit contenir au moins 4 caracteres." },
        { status: 400 }
      );
    }

    if (employeeNameExists(fullName)) {
      return NextResponse.json(
        { success: false, message: "Ce compte employe existe deja." },
        { status: 409 }
      );
    }

    if (usernameExists(username)) {
      return NextResponse.json(
        { success: false, message: "Ce nom d'utilisateur interne existe deja." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const cols = getColumns("employees").map((c) => c.name);

    const insertColumns: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];

    function add(column: string, value: any) {
      if (cols.includes(column)) {
        insertColumns.push(column);
        placeholders.push("?");
        values.push(value);
      }
    }

    add("full_name", fullName);
    add("nom_complet", fullName);
    add("username", username);
    add("password_hash", passwordHash);
    add("email", "");
    add("pc_name", "");
    add("department", "");
    add("role", "Employe");
    add("is_active", 1);
    add("must_change_password", 1);
    add("last_login_at", "");
    add("created_at", now);
    add("updated_at", now);
    add("created_by", "Responsable");
    add("updated_by", "Responsable");

    const result = db
      .prepare(
        `
        INSERT INTO employees (${insertColumns.join(", ")})
        VALUES (${placeholders.join(", ")})
        `
      )
      .run(...values);

    return NextResponse.json({
      success: true,
      message: "Compte employe ajoute avec succes.",
      id: result.lastInsertRowid,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de l'ajout du compte employe.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    ensureEmployeesTable();

    const body = await req.json().catch(() => ({}));

    const id = Number(body.id);
    const fullName = normalizeText(body.full_name || body.nom_complet || body.name);
    const username = normalizeUsername(body.username) || makeUsername(fullName);
    const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
    const now = new Date().toISOString();

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Identifiant employe invalide." },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { success: false, message: "Le nom complet est obligatoire." },
        { status: 400 }
      );
    }

    if (employeeNameExists(fullName, id)) {
      return NextResponse.json(
        { success: false, message: "Un autre compte utilise deja ce nom." },
        { status: 409 }
      );
    }

    if (usernameExists(username, id)) {
      return NextResponse.json(
        { success: false, message: "Un autre compte utilise deja ce nom d'utilisateur interne." },
        { status: 409 }
      );
    }

    const cols = getColumns("employees").map((c) => c.name);
    const updates: string[] = [];
    const values: any[] = [];

    function setCol(column: string, value: any) {
      if (cols.includes(column)) {
        updates.push(`${column} = ?`);
        values.push(value);
      }
    }

    setCol("full_name", fullName);
    setCol("nom_complet", fullName);
    setCol("username", username);
    setCol("role", "Employe");
    setCol("is_active", isActive);
    setCol("updated_at", now);
    setCol("updated_by", "Responsable");

    values.push(id);

    db.prepare(
      `
      UPDATE employees
      SET ${updates.join(", ")}
      WHERE id = ?
      `
    ).run(...values);

    return NextResponse.json({
      success: true,
      message: "Compte employe modifie avec succes.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la modification du compte employe.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    ensureEmployeesTable();

    const body = await req.json().catch(() => ({}));

    const id = Number(body.id);
    const action = normalizeText(body.action);
    const now = new Date().toISOString();

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Identifiant employe invalide." },
        { status: 400 }
      );
    }

    if (action === "reset_password") {
      const newPassword = normalizeText(body.password || body.new_password);

      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json(
          { success: false, message: "Le nouveau mot de passe doit contenir au moins 4 caracteres." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      db.prepare(
        `
        UPDATE employees
        SET
          password_hash = ?,
          must_change_password = 1,
          updated_at = ?,
          updated_by = 'Responsable'
        WHERE id = ?
        `
      ).run(passwordHash, now, id);

      return NextResponse.json({
        success: true,
        message: "Mot de passe reinitialise avec succes.",
      });
    }

    const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;

    db.prepare(
      `
      UPDATE employees
      SET
        is_active = ?,
        updated_at = ?,
        updated_by = 'Responsable'
      WHERE id = ?
      `
    ).run(isActive, now, id);

    return NextResponse.json({
      success: true,
      message: isActive
        ? "Compte employe active avec succes."
        : "Compte employe desactive avec succes.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors du changement de statut.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureEmployeesTable();

    const id = Number(req.nextUrl.searchParams.get("id"));

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Identifiant employe invalide." },
        { status: 400 }
      );
    }

    db.prepare("DELETE FROM employees WHERE id = ?").run(id);

    return NextResponse.json({
      success: true,
      message: "Compte employe supprime avec succes.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la suppression du compte employe.",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}