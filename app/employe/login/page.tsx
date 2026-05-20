"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MonitorCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type PendingEmployee = {
  id: number;
  full_name: string;
  must_change_password: number;
};

export default function EmployeLoginPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const [pendingEmployee, setPendingEmployee] =
    useState<PendingEmployee | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
          "Votre mot de passe est temporaire. Veuillez définir un nouveau mot de passe."
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
        setMessage("Le nouveau mot de passe doit contenir au moins 4 caractères.");
        return;
      }

      if (cleanNewPassword !== cleanConfirmPassword) {
        setMessage("La confirmation du mot de passe ne correspond pas.");
        return;
      }

      if (cleanOldPassword === cleanNewPassword) {
        setMessage(
          "Le nouveau mot de passe doit être différent du mot de passe temporaire."
        );
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

      setMessage("Mot de passe changé avec succès. Redirection...");

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
    <main className="min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#173987] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-24 bottom-12 h-96 w-96 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.16),transparent_30%)]" />

          <div className="relative z-10">
            <div className="flex w-full items-start justify-between gap-8">
              <div className="flex shrink-0 justify-start">
                <Image
                  src="/images/logo-srm-icon.png"
                  alt="Logo SRM-SM"
                  width={360}
                  height={190}
                  className="h-[165px] w-auto object-contain drop-shadow-[0_14px_35px_rgba(0,0,0,0.38)]"
                  priority
                />
              </div>

              <div className="pt-8 text-center">
                <h1 className="whitespace-nowrap text-[38px] font-black leading-none tracking-tight xl:text-[44px]">
                  Gestion d&apos;accès par RDP
                </h1>

                <p className="mt-5 text-center text-sm font-black uppercase tracking-[0.45em] text-blue-100">
                  SRM-SM
                </p>

                <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.35em] text-blue-200">
                  Espace employé
                </p>
              </div>
            </div>

            <div className="mt-20 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-100 ring-1 ring-white/15">
                <UserRound className="h-4 w-4" />
                Connexion employé
              </div>

              <h2 className="mt-6 text-[42px] font-black leading-tight tracking-tight">
                Accès sécurisé au poste principal.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-blue-100">
                Connectez-vous avec votre nom complet et votre mot de passe pour
                envoyer une demande d&apos;accès RDP au poste principal.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <MonitorCheck className="h-7 w-7 text-blue-100" />
              <p className="mt-4 text-sm font-black">Poste principal</p>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Accès contrôlé par demande.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <ShieldCheck className="h-7 w-7 text-blue-100" />
              <p className="mt-4 text-sm font-black">Session unique</p>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Une seule personne accède au poste.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <KeyRound className="h-7 w-7 text-blue-100" />
              <p className="mt-4 text-sm font-black">Compte protégé</p>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Changement du mot de passe temporaire.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 lg:px-12">
          <div className="w-full max-w-[520px]">
            <div className="mb-8 flex flex-col items-center justify-center lg:hidden">
              <Image
                src="/images/logo-srm-icon.png"
                alt="Logo SRM-SM"
                width={280}
                height={150}
                className="h-[130px] w-auto object-contain"
                priority
              />

              <h1 className="mt-4 text-center text-3xl font-black text-slate-950">
                Gestion d&apos;accès par RDP
              </h1>

              <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.35em] text-blue-700">
                Espace employé
              </p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
              {!pendingEmployee ? (
                <>
                  <div className="border-b border-slate-100 px-7 py-7">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-950/15">
                        <UserRound className="h-7 w-7" />
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">
                          Authentification
                        </p>

                        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                          Connexion employé
                        </h1>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-slate-500">
                      Saisissez votre nom complet et votre mot de passe pour
                      accéder à l&apos;espace employé.
                    </p>
                  </div>

                  <div className="px-7 py-7">
                    <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                        <p className="text-sm font-bold leading-6 text-blue-900">
                          Utilisez les informations communiquées par le
                          responsable.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-black text-slate-700">
                          Nom complet
                        </label>

                        <div className="relative">
                          <UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                          <input
                            value={fullName}
                            onChange={(event) => {
                              setFullName(event.target.value);
                              setMessage("");
                            }}
                            placeholder="Entrez votre nom complet"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-4 text-slate-900 outline-none transition focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-black text-slate-700">
                          Mot de passe
                        </label>

                        <div className="relative">
                          <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                          <input
                            value={password}
                            onChange={(event) => {
                              setPassword(event.target.value);
                              setMessage("");
                            }}
                            type={showPassword ? "text" : "password"}
                            placeholder="Votre mot de passe"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-4 text-slate-900 outline-none transition focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-100"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                            aria-label={
                              showPassword
                                ? "Masquer le mot de passe"
                                : "Afficher le mot de passe"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
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
                        className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/15 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? "Connexion..." : "Se connecter"}
                        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                      </button>
                    </form>

                    <p className="mt-6 text-center text-sm font-semibold text-slate-500">
                     Mot de passe oublié ? Veuillez contacter le responsable.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-slate-100 px-7 py-7">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-950/15">
                        <KeyRound className="h-7 w-7" />
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">
                          Mot de passe temporaire
                        </p>

                        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                          Changer le mot de passe
                        </h1>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-slate-500">
                      Votre mot de passe est temporaire. Définissez un nouveau
                      Mot de passe pour continuer.
                    </p>
                  </div>

                  <div className="px-7 py-7">
                    <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                      <p className="text-sm text-blue-900">
                        Compte :{" "}
                        <span className="font-black">
                          {pendingEmployee.full_name}
                        </span>
                      </p>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-5">
                      <PasswordInput
                        label="Ancien mot de passe"
                        value={oldPassword}
                        onChange={(value) => {
                          setOldPassword(value);
                          setMessage("");
                        }}
                        show={showOldPassword}
                        setShow={setShowOldPassword}
                        placeholder="Mot de passe temporaire"
                      />

                      <PasswordInput
                        label="Nouveau mot de passe"
                        value={newPassword}
                        onChange={(value) => {
                          setNewPassword(value);
                          setMessage("");
                        }}
                        show={showNewPassword}
                        setShow={setShowNewPassword}
                        placeholder="Nouveau mot de passe"
                      />

                      <PasswordInput
                        label="Confirmer le nouveau mot de passe"
                        value={confirmPassword}
                        onChange={(value) => {
                          setConfirmPassword(value);
                          setMessage("");
                        }}
                        show={showConfirmPassword}
                        setShow={setShowConfirmPassword}
                        placeholder="Confirmation"
                      />

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

                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={handleCancelChangePassword}
                          className="h-12 rounded-xl bg-slate-900 px-7 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-700"
                        >
                          Annuler
                        </button>

                        <button
                          type="submit"
                          disabled={changingPassword}
                          className="h-12 rounded-xl bg-blue-700 px-7 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {changingPassword ? "Changement..." : "Changer"}
                        </button>
                      </div>
                    </form>

                    <p className="mt-6 text-center text-sm font-semibold text-slate-500">
                      En cas d&apos;oubli, veuillez contacter le responsable.
                    </p>
                  </div>
                </>
              )}

              <div className="border-t border-slate-100 bg-slate-50 px-7 py-4 text-center">
                <p className="text-xs font-semibold text-slate-500">
                  SRM-SM - Espace employé de demande d&apos;accès RDP
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  setShow,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-4 text-slate-900 outline-none transition focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />

        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}