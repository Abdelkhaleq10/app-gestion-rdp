"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployeChangePasswordPage() {
  const router = useRouter();

  const [employeeId, setEmployeeId] = useState("");
  const [fullName, setFullName] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedId = localStorage.getItem("employe_id") || "";
    const savedName = localStorage.getItem("employe_nom") || "";

    if (!savedName) {
      router.push("/employe/login");
      return;
    }

    setEmployeeId(savedId);
    setFullName(savedName);
  }, [router]);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
        setMessage("Veuillez remplir tous les champs.");
        return;
      }

      if (newPassword.trim().length < 4) {
        setMessage("Le nouveau mot de passe doit contenir au moins 4 caracteres.");
        return;
      }

      if (newPassword.trim() !== confirmPassword.trim()) {
        setMessage("La confirmation du mot de passe ne correspond pas.");
        return;
      }

      const response = await fetch("/api/employe-change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: employeeId,
          full_name: fullName,
          old_password: oldPassword.trim(),
          new_password: newPassword.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Changement impossible.");
        return;
      }

      localStorage.setItem("employe_nom", data.employee?.full_name || fullName);
      localStorage.setItem("must_change_password", "0");

      setMessage("Mot de passe change avec succes. Redirection...");

      setTimeout(() => {
        router.push("/");
      }, 700);
    } catch (error) {
      console.error("Erreur changement mot de passe :", error);
      setMessage("Erreur lors du changement du mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("employe_id");
    localStorage.removeItem("employe_nom");
    localStorage.removeItem("must_change_password");
    router.push("/employe/login");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <header className="bg-blue-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl font-black">
              PC
            </div>

            <div>
              <p className="text-lg font-bold">SRM-SM</p>
              <p className="text-xs text-blue-200">Espace employe</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
          >
            Deconnexion
          </button>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl md:p-10">
          <div className="mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-black text-white">
              MD
            </div>

            <h1 className="mt-6 text-3xl font-black text-slate-900">
              Changer le mot de passe
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Votre mot de passe est temporaire. Vous devez definir un nouveau
              mot de passe avant de continuer.
            </p>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-900">
                Compte : <span className="font-black">{fullName || "Chargement..."}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Ancien mot de passe
              </label>

              <input
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                type="password"
                placeholder="Mot de passe actuel"
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Nouveau mot de passe
              </label>

              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                placeholder="Nouveau mot de passe"
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Confirmer le nouveau mot de passe
              </label>

              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                placeholder="Confirmation"
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {message ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                  message.includes("succes")
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-700 px-5 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Changement..." : "Changer le mot de passe"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            En cas d'oubli, veuillez demander au responsable de reinitialiser le mot de passe.
          </p>
        </div>
      </section>
    </main>
  );
}