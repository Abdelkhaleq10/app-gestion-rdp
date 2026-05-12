"use client";

import { useState } from "react";

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
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-blue-950 px-8 py-8 text-white">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl border border-white/20 bg-white/10 flex items-center justify-center text-2xl">
                🖥️
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-blue-200">
                  SRM-SM
                </p>
                <h1 className="text-2xl font-black mt-1">
                  Connexion responsable
                </h1>
              </div>
            </div>

            <p className="text-blue-100 mt-5 text-sm leading-6">
              Accès reserve à l'interface d'administration, de supervision du
              poste principal et de consultation de l'historique RDP.
            </p>
          </div>

          <div className="p-8">
            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900 font-semibold">
              Cette zone est réservée au responsable autorisé.
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Mot de passe
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMessage("");
                  }}
                  placeholder="Entrez le mot de passe responsable"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 bg-white outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-black py-3.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>

            {message && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {message}
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
              Après authentification, le responsable peut consulter le tableau
              de bord, les demandes d'accès, l'historique RDP et exporter les
              données.
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-center">
            <p className="text-xs text-slate-500">
              Espace responsable de gestion et de supervision RDP
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}