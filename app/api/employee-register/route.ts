import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "../../../lib/db";

export const dynamic = "force-dynamic";

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
    const confirmPassword = cleanText(body.confirmPassword || body.confirm_password);

    if (nomComplet.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message: "Veuillez saisir un nom complet valide.",
        },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        {
          success: false,
          message: "Le mot de passe doit contenir au moins 4 caracteres.",
        },
        { status: 400 }
      );
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Les mots de passe ne correspondent pas.",
        },
        { status: 400 }
      );
    }

    const existingEmployee = db
      .prepare("SELECT id FROM employees WHERE nom_complet = ?")
      .get(nomComplet) as { id: number } | undefined;

    if (existingEmployee) {
      return NextResponse.json(
        {
          success: false,
          message: "Ce compte employe existe deja.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const result = db
      .prepare(`
        INSERT INTO employees (nom_complet, password_hash, created_at, last_login)
        VALUES (?, ?, ?, ?)
      `)
      .run(nomComplet, passwordHash, now, now);

    return NextResponse.json({
      success: true,
      message: "Compte employe cree avec succes.",
      employee: {
        id: Number(result.lastInsertRowid),
        nom_complet: nomComplet,
      },
    });
  } catch (error) {
    console.error("Erreur employee-register:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la creation du compte employe.",
      },
      { status: 500 }
    );
  }
}