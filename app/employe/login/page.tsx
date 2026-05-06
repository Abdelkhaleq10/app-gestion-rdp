"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployeLoginPage() {
  const router = useRouter();
  const [nomComplet, setNomComplet] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanName = nomComplet.trim();

    if (cleanName.length < 3) {
      setError("Veuillez saisir votre nom complet.");
      return;
    }

    localStorage.setItem("employe_nom", cleanName);
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-blue-900 px-8 py-7 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-blue-200">
              SRM-SM
            </p>
            <h1 className="text-2xl font-bold mt-2">
              Connexion employe
            </h1>
            <p className="text-blue-100 mt-2 text-sm">
              Acces au poste principal via l'application de gestion RDP.
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nom complet
              </label>

              <input
                type="text"
                value={nomComplet}
                onChange={(e) => {
                  setNomComplet(e.target.value);
                  setError("");
                }}
                placeholder="Exemple : Abdelkhaleq El Mataoui"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />

              {error && (
                <p className="text-red-600 text-sm mt-2 font-medium">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 shadow-lg shadow-blue-200 transition"
            >
              Entrer dans l'espace employe
            </button>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
              Votre nom sera utilise pour enregistrer vos demandes d'acces
              dans l'historique de l'application.
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}