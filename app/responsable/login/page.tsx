"use client";

import { useState } from "react";

export default function ResponsableLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 px-6 py-8 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300 mb-3">
            SRM - SM | Interface responsable
          </p>

          <h1 className="text-3xl font-bold mb-3">
            Connexion responsable
          </h1>

          <p className="text-slate-200 text-sm leading-relaxed">
            Accès reserve à l'interface d'administration et de supervision du poste principal.
          </p>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium">
            Cette zone est réservée au responsable.
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Mot de passe
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez le mot de passe"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3.5 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          {message && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {message}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
             Espace responsable de gestion et de supervision
          </p>
        </div>
      </div>
    </main>
  );
}