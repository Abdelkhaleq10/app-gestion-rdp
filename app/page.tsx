"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  LogOut,
  Monitor,
  MonitorCheck,
  MonitorX,
  PlugZap,
  ShieldCheck,
  UserRound,
  AlertCircle,
} from "lucide-react";

type StatusData = {
  etat_poste?: string;
  etatPoste?: string;
  status?: string;
  nombre_sessions_actives?: number;
  nombreSessionsActives?: number;
  sessionsActives?: number;
  date_verification?: string;
  dateVerification?: string;
};

type RequestResult = {
  success?: boolean;
  message?: string;
  status?: string;
  statusLabel?: string;
  workstationStatus?: string;
  currentRdpUser?: string;
};

type RequestState = "none" | "authorized" | "waiting" | "rejected" | "error";

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getEtatLabel(status: StatusData | null) {
  const value = normalize(
    status?.etat_poste || status?.etatPoste || status?.status || "Inconnu"
  );

  if (value.includes("libre")) return "Libre";
  if (value.includes("occupe")) return "Occupe";

  return "Inconnu";
}

function getSessions(status: StatusData | null) {
  return (
    status?.nombre_sessions_actives ??
    status?.nombreSessionsActives ??
    status?.sessionsActives ??
    0
  );
}

function getDateVerification(status: StatusData | null) {
  return status?.date_verification || status?.dateVerification || "Non disponible";
}

function getInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isAuthorizedStatus(value: unknown) {
  const status = normalize(value);
  return (
    status === "authorized" ||
    status === "autorise" ||
    status === "autorisee" ||
    status.includes("autor")
  );
}

function isWaitingStatus(value: unknown) {
  const status = normalize(value);
  return (
    status === "waiting_current_user" ||
    status === "pending" ||
    status.includes("attente")
  );
}

function isRejectedStatus(value: unknown) {
  const status = normalize(value);
  return (
    status === "rejected" ||
    status === "refuse" ||
    status === "refusee" ||
    status.includes("refus")
  );
}

export default function EmployePage() {
  const router = useRouter();

  const [employeName, setEmployeName] = useState("");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("none");
  const [lastActivityText, setLastActivityText] = useState("Aucune activite recente");
  const [currentUserText, setCurrentUserText] = useState("Aucun");
  const [pulse, setPulse] = useState(false);

  const etat = getEtatLabel(status);
  const sessions = getSessions(status);
  const dateVerification = getDateVerification(status);

  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";

  const requestAuthorized = requestState === "authorized";
  const requestWaiting = requestState === "waiting";
  const requestRejected = requestState === "rejected";
  const displayedCurrentUser = isLibre ? "Aucun" : currentUserText;

  useEffect(() => {
    const savedName = localStorage.getItem("employe_nom");

    if (!savedName) {
      router.push("/employe/login");
      return;
    }

    setEmployeName(savedName);
    loadAllData();

    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
      loadAllData();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAllData() {
    const statusData = await loadStatus();
    await loadCurrentRdpUser(statusData);
  }

  async function loadStatus() {
    try {
      setLoadingStatus(true);

      const response = await fetch("/api/status", { cache: "no-store" });
      const data = await response.json();

      setStatus(data);
      return data as StatusData;
    } catch (error) {
      console.error("Erreur chargement statut:", error);
      setStatus(null);
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadCurrentRdpUser(statusData?: StatusData | null) {
    try {
      const response = await fetch("/api/current-rdp-user", { cache: "no-store" });
      const data = await response.json();

      if (!data?.session_active || getSessions(statusData || status) === 0) {
        setCurrentUserText("Aucun");
        return;
      }

      if (data?.utilisateur) {
        setCurrentUserText(data.utilisateur);
      } else {
        setCurrentUserText("Session active");
      }

      if (data?.derniere_activite) {
        setLastActivityText(data.derniere_activite);
      }
    } catch (error) {
      console.error("Erreur chargement utilisateur RDP:", error);
      setCurrentUserText(getSessions(statusData || status) > 0 ? "Session active" : "Aucun");
    }
  }

  async function handleRequestAccess() {
    try {
      setRequestLoading(true);
      setMessage("");
      setRequestState("none");

      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: employeName,
          pcName: "PC employe",
          priority: "normal",
          reason: "Demande d'acces",
          message: "",
        }),
      });

      const result: RequestResult = await response.json();

      if (!response.ok || result.success === false) {
        setRequestState("error");
        setMessage(result.message || "Erreur lors de l'envoi de la demande.");
        return;
      }

      if (isAuthorizedStatus(result.status)) {
        setRequestState("authorized");
        setMessage("Acces autorise. Vous pouvez maintenant vous connecter au poste principal.");
      } else if (isWaitingStatus(result.status)) {
        setRequestState("waiting");
        setMessage(
          "Demande en attente. Une notification a ete envoyee a l'utilisateur actuellement connecte."
        );
      } else if (isRejectedStatus(result.status)) {
        setRequestState("rejected");
        setMessage("Demande refusee par l'utilisateur actuellement connecte.");
      } else {
        setRequestState("waiting");
        setMessage(result.message || "Votre demande est en attente de verification.");
      }

      await loadAllData();
    } catch (error) {
      console.error("Erreur demande acces:", error);
      setRequestState("error");
      setMessage("Erreur lors de l'envoi de la demande d'acces.");
    } finally {
      setRequestLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("employe_id");
    localStorage.removeItem("employe_nom");
    router.push("/employe/login");
  }

  function handleRdpConnect() {
    window.location.href = "/api/rdp-file";
  }

  if (!employeName) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-blue-900 border-t-transparent" />
          <p className="text-sm font-semibold text-blue-950">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="border-b border-white/10 bg-[#0b1f3f] text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-4 lg:min-h-[124px] lg:grid-cols-[240px_1fr_auto] lg:items-center lg:px-6">
          <div className="flex justify-center lg:justify-start">
            <div className="flex h-24 w-56 max-w-full items-center justify-center lg:justify-start">
              <img
                src="/srm-sm-logo-white-text.png"
                alt="SRM-SM"
                className="h-24 w-auto max-w-full object-contain brightness-0 invert"
              />
            </div>
          </div>

          <div className="text-center lg:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
              Application interne
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-normal">
              Gestion d'acces RDP
            </h1>
            <p className="mt-1 text-sm text-blue-100">Espace employe</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 px-3 py-2">
              <div className="flex size-9 items-center justify-center rounded-md bg-[#f0b23f] text-sm font-black text-blue-950">
                {getInitials(employeName)}
              </div>
              <div>
                <p className="text-xs text-blue-200">Connecte</p>
                <p className="text-sm font-bold">{employeName}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/15"
            >
              <LogOut className="size-4" />
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div
                className={`h-1 ${
                  isLibre ? "bg-emerald-500" : isOccupe ? "bg-red-500" : "bg-slate-300"
                }`}
              />

              <div className="p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex size-16 shrink-0 items-center justify-center rounded-lg ${
                        isLibre
                          ? "bg-emerald-50 text-emerald-700"
                          : isOccupe
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isLibre ? (
                        <MonitorCheck className="size-8" />
                      ) : isOccupe ? (
                        <MonitorX className="size-8" />
                      ) : (
                        <Monitor className="size-8" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Etat du poste principal
                      </p>

                      <h2
                        className={`mt-1 text-3xl font-black ${
                          isLibre ? "text-emerald-700" : isOccupe ? "text-red-700" : "text-slate-700"
                        }`}
                      >
                        Poste {etat === "Libre" ? "libre" : etat === "Occupe" ? "occupe" : "inconnu"}
                      </h2>

                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                        {isLibre
                          ? "Le poste principal est libre et pret a etre utilise."
                          : isOccupe
                          ? "Le poste principal est actuellement occupe par une session RDP."
                          : "Le statut du poste principal reste indisponible."}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Derniere verification
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`size-2.5 rounded-full transition-transform ${
                          pulse ? "scale-150" : "scale-100"
                        } ${isLibre ? "bg-emerald-500" : isOccupe ? "bg-red-500" : "bg-slate-400"}`}
                      />

                      <p className="text-sm font-bold text-slate-800">
                        {loadingStatus ? "Actualisation..." : dateVerification}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-blue-950 text-white">
                  <KeyRound className="size-6" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-900">Demande d'acces</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Demande envoyee sous le nom :{" "}
                    <span className="font-bold text-blue-950">{employeName}</span>
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Nom complet
                </p>
                <p className="mt-1 font-semibold text-slate-800">{employeName}</p>
              </div>

              <button
                onClick={handleRequestAccess}
                disabled={requestLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-3.5 font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="size-5" />
                {requestLoading ? "Envoi de la demande..." : "Demander l'acces"}
              </button>

              {message && (
                <div
                  className={`mt-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${
                    requestAuthorized
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : requestWaiting
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : requestRejected
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {requestAuthorized ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  )}

                  <p>{message}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-black text-slate-900">Etat en direct</h3>
              </div>

              <div className="divide-y divide-slate-100">
                {[
                  ["Sessions actives", sessions],
                  ["Utilisateur actuel", displayedCurrentUser],
                  ["Derniere activite", lastActivityText],
                  ["Verification", loadingStatus ? "..." : dateVerification],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="max-w-[180px] text-right text-sm font-bold text-slate-800">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
                  <UserRound className="size-5" />
                </div>

                <div>
                  <h3 className="font-black text-blue-950">Acces exclusif</h3>
                  <p className="mt-2 text-sm leading-6 text-blue-900/80">
                    Une seule personne peut utiliser le poste principal a la fois. Si le poste est
                    occupe, la nouvelle demande sera mise en attente.
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`overflow-hidden rounded-lg border bg-white shadow-sm ${
                requestAuthorized ? "border-emerald-200" : "border-slate-200"
              }`}
            >
              <div className={`h-1 ${requestAuthorized ? "bg-emerald-500" : "bg-slate-200"}`} />

              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex size-11 items-center justify-center rounded-lg ${
                      requestAuthorized
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <PlugZap className="size-6" />
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900">
                      {requestAuthorized ? "Acces autorise" : "Connexion RDP"}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {requestAuthorized
                        ? "Vous pouvez maintenant vous connecter."
                        : "En attente d'une demande autorisee."}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRdpConnect}
                  disabled={!requestAuthorized}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-black transition ${
                    requestAuthorized
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  <Monitor className="size-4" />
                  Se connecter par RDP
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Clock3 className="size-4" />
              Mise a jour automatique toutes les 5 secondes
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}