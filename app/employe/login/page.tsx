"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingEmployee = {
  id: number;
  full_name: string;
  must_change_password: number;
};

export default function EmployeLoginPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const [pendingEmployee, setPendingEmployee] = useState<PendingEmployee | null>(
    null
  );

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const cleanName = fullName.trim();
      const cleanPassword = password.trim();

      if (!cleanName || !cleanPassword) {
        setMessage("Veuillez saisir le nom complet et le mot de passe.");
        return;
      }

      const response = await fetch("/api/employe-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: cleanName,
          employeeName: cleanName,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Connexion impossible.");
        return;
      }

      const employee = data.employee || {};
      const employeeName = employee.full_name || cleanName;
      const mustChangePassword = Number(employee.must_change_password || 0);

      localStorage.setItem("employe_id", String(employee.id || ""));
      localStorage.setItem("employe_nom", employeeName);
      localStorage.setItem("must_change_password", String(mustChangePassword));

      if (mustChangePassword === 1) {
        setPendingEmployee({
          id: Number(employee.id || 0),
          full_name: employeeName,
          must_change_password: 1,
        });

        setOldPassword(cleanPassword);
        setNewPassword("");
        setConfirmPassword("");
        setMessage(
          "Votre mot de passe est temporaire. Veuillez definir un nouveau mot de passe."
        );
        return;
      }

      router.push("/");
    } catch (error) {
      console.error("Erreur login employe :", error);
      setMessage("Erreur lors de la connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setChangingPassword(true);
      setMessage("");

      if (!pendingEmployee) {
        setMessage("Session employe introuvable. Veuillez vous reconnecter.");
        return;
      }

      const cleanOldPassword = oldPassword.trim();
      const cleanNewPassword = newPassword.trim();
      const cleanConfirmPassword = confirmPassword.trim();

      if (!cleanOldPassword || !cleanNewPassword || !cleanConfirmPassword) {
        setMessage("Veuillez remplir tous les champs.");
        return;
      }

      if (cleanNewPassword.length < 4) {
        setMessage("Le nouveau mot de passe doit contenir au moins 4 caracteres.");
        return;
      }

      if (cleanNewPassword !== cleanConfirmPassword) {
        setMessage("La confirmation du mot de passe ne correspond pas.");
        return;
      }

      if (cleanOldPassword === cleanNewPassword) {
        setMessage("Le nouveau mot de passe doit etre different du mot de passe temporaire.");
        return;
      }

      const response = await fetch("/api/employe-change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: pendingEmployee.id,
          full_name: pendingEmployee.full_name,
          old_password: cleanOldPassword,
          new_password: cleanNewPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Changement impossible.");
        return;
      }

      localStorage.setItem("employe_id", String(pendingEmployee.id));
      localStorage.setItem("employe_nom", pendingEmployee.full_name);
      localStorage.setItem("must_change_password", "0");

      setMessage("Mot de passe change avec succes. Redirection...");
      setTimeout(() => {
        router.push("/");
      }, 700);
    } catch (error) {
      console.error("Erreur changement mot de passe :", error);
      setMessage("Erreur lors du changement du mot de passe.");
    } finally {
      setChangingPassword(false);
    }
  }

  function handleCancelChangePassword() {
    localStorage.removeItem("employe_id");
    localStorage.removeItem("employe_nom");
    localStorage.removeItem("must_change_password");

    setPendingEmployee(null);
    setPassword("");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("");
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

          <h1 className="text-xl font-black md:text-2xl">
            Gestion d'acces RDP
          </h1>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-center justify-center px-6 py-10">
        <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1fr_1.1fr]">
          <div className="bg-blue-950 p-8 text-white md:p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black">
              PC
            </div>

            <h2 className="mt-8 text-3xl font-black">
              Connexion employe
            </h2>

            <p className="mt-4 leading-7 text-blue-100">
              Connectez-vous avec le nom complet et le mot de passe communique
              par le responsable.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5">
              <p className="font-bold">Securite du compte</p>
              <p className="mt-2 text-sm leading-6 text-blue-100">
                Si votre mot de passe est temporaire, l'application vous demandera
                de le changer directement sur cette page.
              </p>
            </div>
          </div>

          <div className="p-8 md:p-10">
            {!pendingEmployee ? (
              <>
                <h2 className="text-3xl font-black text-slate-900">
                  Acces au compte
                </h2>

                <p className="mt-2 text-slate-500">
                  Saisissez vos informations pour acceder a l'espace employe.
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Nom complet
                    </label>

                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Ex : Said COTTI"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Mot de passe
                    </label>

                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      placeholder="Votre mot de passe"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {message ? (
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                        message.includes("temporaire")
                          ? "border-orange-200 bg-orange-50 text-orange-700"
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
                    {loading ? "Connexion..." : "Se connecter"}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  Mot de passe oublie ? Veuillez contacter le responsable pour le reinitialiser.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-black text-slate-900">
                  Changer le mot de passe
                </h2>

                <p className="mt-2 text-slate-500">
                  Votre mot de passe est temporaire. Definissez un nouveau mot de passe pour continuer.
                </p>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-900">
                    Compte :{" "}
                    <span className="font-black">
                      {pendingEmployee.full_name}
                    </span>
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="mt-8 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Ancien mot de passe
                    </label>

                    <input
                      value={oldPassword}
                      onChange={(event) => setOldPassword(event.target.value)}
                      type="password"
                      placeholder="Mot de passe temporaire"
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
                          : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}
                    >
                      {message}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="rounded-2xl bg-blue-700 px-5 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {changingPassword ? "Changement..." : "Changer le mot de passe"}
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelChangePassword}
                      className="rounded-2xl bg-slate-800 px-5 py-4 font-black text-white transition hover:bg-slate-700"
                    >
                      Annuler
                    </button>
                  </div>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  En cas d'oubli, veuillez contacter le responsable.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}