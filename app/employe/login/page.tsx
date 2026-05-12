"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, UserRound } from "lucide-react";
import { AuthShell } from "../../../components/AppChrome";

export default function EmployeLoginPage() {
  const router = useRouter();
  const [nomComplet, setNomComplet] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage("");
      const cleanName = nomComplet.trim();
      if (cleanName.length < 3) {
        setMessage("Veuillez saisir votre nom complet.");
        return;
      }
      if (!password) {
        setMessage("Veuillez saisir votre mot de passe.");
        return;
      }
      const response = await fetch("/api/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom_complet: cleanName, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || "Nom complet ou mot de passe incorrect.");
        return;
      }
      localStorage.setItem("employe_id", String(data.employee.id));
      localStorage.setItem("employe_nom", data.employee.nom_complet);
      router.push("/");
    } catch (error) {
      console.error("Erreur login employe:", error);
      setMessage("Erreur lors de la connexion employe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Connexion employe" subtitle="Connectez-vous pour demander l'acces au poste principal.">
      <form onSubmit={handleLogin} className="space-y-5 p-6">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Nom complet</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={nomComplet}
              onChange={(e) => { setNomComplet(e.target.value); setMessage(""); }}
              placeholder="Exemple : Abdelkhaleq El Mataoui"
              className="w-full rounded-lg border border-slate-300 px-10 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Mot de passe</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setMessage(""); }}
              placeholder="Entrez votre mot de passe"
              className="w-full rounded-lg border border-slate-300 px-10 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        {message && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-700 py-3.5 font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <button type="button" onClick={() => router.push("/employe/register")} className="w-full rounded-lg bg-slate-100 py-3.5 font-black text-slate-700 transition hover:bg-slate-200">
          Creer un compte employe
        </button>
      </form>
    </AuthShell>
  );
}
