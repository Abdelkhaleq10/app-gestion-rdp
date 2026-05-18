"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  MonitorCheck,
  ShieldCheck,
} from "lucide-react";

export default function ResponsableLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
                  Poste principal
                </p>
              </div>
            </div>

            <div className="mt-20 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-100 ring-1 ring-white/15">
                <ShieldCheck className="h-4 w-4" />
                Espace responsable
              </div>

              <h2 className="mt-6 text-[42px] font-black leading-tight tracking-tight">
                Supervision sécurisée du poste principal.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-blue-100">
                Accès réservé au responsable pour suivre l&apos;état du poste,
                gérer les demandes, consulter l&apos;historique RDP et superviser
                les sessions actives.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <MonitorCheck className="h-7 w-7 text-blue-100" />
              <p className="mt-4 text-sm font-black">Poste principal</p>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Contrôle de disponibilité et suivi des sessions.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <LockKeyhole className="h-7 w-7 text-blue-100" />
              <p className="mt-4 text-sm font-black">Accès protégé</p>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Interface réservée uniquement au responsable.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <ShieldCheck className="h-7 w-7 text-blue-100" />
              <p className="mt-4 text-sm font-black">Historique RDP</p>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Consultation des demandes et événements enregistrés.
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
                SRM-SM
              </p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
              <div className="border-b border-slate-100 px-7 py-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-950/15">
                    <LockKeyhole className="h-7 w-7" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">
                      Authentification
                    </p>

                    <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                      Connexion responsable
                    </h1>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-500">
                  Entrez le mot de passe responsable pour accéder au tableau de
                  bord, aux demandes, à l&apos;historique RDP et à la gestion des
                  employés.
                </p>
              </div>

              <div className="px-7 py-7">
                <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                    <p className="text-sm font-bold leading-6 text-blue-900">
                      Cette zone est réservée au responsable autorisé de la
                      plateforme de gestion RDP.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700">
                      Mot de passe responsable
                    </label>

                    <div className="relative">
                      <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setMessage("");
                        }}
                        placeholder="Entrez le mot de passe"
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/15 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Connexion en cours..." : "Se connecter"}
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                  </button>
                </form>

                {message ? (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {message}
                  </div>
                ) : null}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Accès
                    </p>
                    <p className="mt-2 text-sm font-black text-slate-800">
                      Dashboard responsable
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Module
                    </p>
                    <p className="mt-2 text-sm font-black text-slate-800">
                      Demandes et historique
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-7 py-4 text-center">
                <p className="text-xs font-semibold text-slate-500">
                  SRM-SM - Espace responsable de gestion et supervision RDP
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}