"use client";

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { AuthShell } from "../../../components/AppChrome";

export default function ResponsableLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage("");
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "Mot de passe incorrect.");
        return;
      }
      window.location.href = "/responsable/dashboard";
    } catch (error) {
      console.error("Erreur login :", error);
      setMessage("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Connexion responsable" subtitle="Acces reserve a l'interface de supervision et de consultation de l'historique RDP.">
      <div className="p-6">
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p className="font-semibold">Cette zone est reservee au responsable autorise.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Mot de passe</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setMessage(""); }}
                placeholder="Entrez le mot de passe responsable"
                className="w-full rounded-lg border border-slate-300 bg-white px-10 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-700 py-3.5 font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {message && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}
      </div>
    </AuthShell>
  );
}
