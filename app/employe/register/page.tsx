"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployeRegisterPage() {
  const router = useRouter();

  const [nomComplet, setNomComplet] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const cleanName = nomComplet.trim();

      if (cleanName.length < 3) {
        setMessage("Veuillez saisir votre nom complet.");
        return;
      }

      if (password.length < 4) {
        setMessage("Le mot de passe doit contenir au moins 4 caracteres.");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Les mots de passe ne correspondent pas.");
        return;
      }

      const response = await fetch("/api/employee-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nom_complet: cleanName,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Erreur lors de la creation du compte.");
        return;
      }

      localStorage.setItem("employe_id", String(data.employee.id));
      localStorage.setItem("employe_nom", data.employee.nom_complet);

      router.push("/");
    } catch (error) {
      console.error("Erreur register employe:", error);
      setMessage("Erreur lors de la creation du compte employe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-blue-950 px-8 py-8 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-blue-200">
              SRM-SM
            </p>

            <h1 className="text-2xl font-black mt-2">
              Creation compte employe
            </h1>

            <p className="text-blue-100 mt-3 text-sm leading-6">
              Creez votre compte interne pour demander l'acces au poste
              principal.
            </p>
          </div>

          <form onSubmit={handleRegister} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nom complet
              </label>

              <input
                type="text"
                value={nomComplet}
                onChange={(e) => {
                  setNomComplet(e.target.value);
                  setMessage("");
                }}
                placeholder="Exemple : Abdelkhaleq El Mataoui"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

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
                placeholder="Creez un mot de passe"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Confirmer le mot de passe
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setMessage("");
                }}
                placeholder="Confirmez le mot de passe"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {message && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-black py-3.5 transition disabled:opacity-50 shadow-lg shadow-blue-200"
            >
              {loading ? "Creation..." : "Creer mon compte"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/employe/login")}
              className="w-full rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3.5 transition"
            >
              J'ai deja un compte
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}