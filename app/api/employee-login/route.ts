import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "../../../lib/db";

export const dynamic = "force-dynamic";

type EmployeeRow = {
  id: number;
  nom_complet: string;
  password_hash: string;
};

function ensureEmployeesTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_complet TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login TEXT
    )
  `).run();
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: NextRequest) {
  try {
    ensureEmployeesTable();

    const body = await request.json();

    const nomComplet = cleanText(body.nom_complet || body.nomComplet || body.nom);
    const password = cleanText(body.password || body.motDePasse);

    if (!nomComplet || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Veuillez saisir le nom complet et le mot de passe.",
        },
        { status: 400 }
      );
    }

    const employee = db
      .prepare(`
        SELECT id, nom_complet, password_hash
        FROM employees
        WHERE nom_complet = ?
      `)
      .get(nomComplet) as EmployeeRow | undefined;

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: "Compte employe introuvable.",
        },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, employee.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Mot de passe incorrect.",
        },
        { status: 401 }
      );
    }

    db.prepare("UPDATE employees SET last_login = ? WHERE id = ?").run(
      new Date().toISOString(),
      employee.id
    );

    return NextResponse.json({
      success: true,
      message: "Connexion employe reussie.",
      employee: {
        id: employee.id,
        nom_complet: employee.nom_complet,
      },
    });
  } catch (error) {
    console.error("Erreur employee-login:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la connexion employe.",
      },
      { status: 500 }
    );
  }
}