"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  authorized?: boolean;
  autorise?: boolean;
  message?: string;
  status?: string;
  statusLabel?: string;
  workstationStatus?: string;
  currentRdpUser?: string;
};

type LastRequestResponse = {
  success?: boolean;
  request?: {
    id: number;
    Utilisateur: string;
    status: string;
    current_user_response?: string;
    response_message?: string;
    response_at?: string;
  } | null;
};

type HistoryItem = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  nomSession: string;
  ip: string;
  typeIP: string;
  action: string;
};

type PriorityOption = {
  value: string;
  label: string;
  description: string;
};

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: "urgent",
    label: "Urgent",
    description: "Besoin prioritaire ou situation bloquante.",
  },
  {
    value: "consultation",
    label: "Consultation",
    description: "Consultation rapide d'une information.",
  },
  {
    value: "verification",
    label: "Verification",
    description: "Verification d'un element ou d'un document.",
  },
  {
    value: "impression",
    label: "Impression",
    description: "Impression ou recuperation d'un document.",
  },
  {
    value: "assistance",
    label: "Assistance",
    description: "Besoin d'aide ou d'intervention.",
  },
  {
    value: "autre",
    label: "Autre",
    description: "Autre motif de demande.",
  },
];

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getEtatLabel(status: StatusData | null) {
  const raw =
    status?.etat_poste ||
    status?.etatPoste ||
    status?.status ||
    "Inconnu";

  const value = normalize(raw);

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
  return (
    status?.date_verification ||
    status?.dateVerification ||
    "Non disponible"
  );
}

function isValidUserName(value: string) {
  const user = normalize(value);

  if (!user) return false;
  if (user === "n/a") return false;
  if (user === "-") return false;
  if (user.includes("acces direct non identifie")) return false;
  if (user === "autocad_user") return false;
  if (user === "s.cotti") return false;

  return true;
}

function getHistoryItems(data: unknown): HistoryItem[] {
  const payload = data as Partial<
    Record<"items" | "data" | "history" | "events" | "rows", unknown>
  >;

  return Array.isArray(payload.items)
    ? (payload.items as HistoryItem[])
    : Array.isArray(payload.data)
    ? (payload.data as HistoryItem[])
    : Array.isArray(payload.history)
    ? (payload.history as HistoryItem[])
    : Array.isArray(payload.events)
    ? (payload.events as HistoryItem[])
    : Array.isArray(payload.rows)
    ? (payload.rows as HistoryItem[])
    : [];
}

function isAuthorizedRequest(item: HistoryItem) {
  const text = normalize(`${item.action || ""} ${item.nomSession || ""}`);

  return (
    isValidUserName(item.utilisateur) &&
    text.includes("demande") &&
    text.includes("autorisee")
  );
}

function isRealRdpEvent(item: HistoryItem) {
  const text = normalize(`${item.action || ""} ${item.nomSession || ""}`);

  if (!isValidUserName(item.utilisateur)) return false;

  if (text.includes("demande")) return false;
  if (text.includes("refuse")) return false;
  if (text.includes("autorise")) return false;
  if (text.includes("deconnexion")) return false;
  if (text.includes("deconnectee")) return false;

  return text.includes("connexion") || text.includes("reconnexion");
}

function findCurrentEmployee(items: HistoryItem[]) {
  const latestAuthorized = items.find(isAuthorizedRequest);

  if (latestAuthorized) {
    return latestAuthorized.utilisateur;
  }

  const latestRdpEvent = items.find(isRealRdpEvent);

  if (latestRdpEvent) {
    return latestRdpEvent.utilisateur;
  }

  return "Session active";
}

function buildRefusedMessage(currentUser: string) {
  const user = String(currentUser || "").trim();

  if (user && user !== "Aucun" && user !== "Session active") {
    return `Acces refuse : le poste principal est actuellement utilise par ${user}. Veuillez le contacter si votre demande est urgente.`;
  }

  return "Acces refuse : le poste principal est actuellement occupe. Veuillez contacter l'utilisateur RDP actif si votre demande est urgente.";
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
    status === "waiting_release" ||
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

function getPriorityLabel(value: string) {
  const option = PRIORITY_OPTIONS.find((item) => item.value === value);
  return option?.label || "Autre";
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

export default function EmployePage() {
  const router = useRouter();

  const [employeName, setEmployeName] = useState("");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requestAuthorized, setRequestAuthorized] = useState(false);
  const [requestWaiting, setRequestWaiting] = useState(false);

  const [priority, setPriority] = useState("consultation");
  const [optionalMessage, setOptionalMessage] = useState("");

  const [lastActivityText, setLastActivityText] = useState(
    "Aucune activite recente"
  );
  const [currentUserText, setCurrentUserText] = useState("Aucun");

  const etat = getEtatLabel(status);
  const sessions = getSessions(status);
  const dateVerification = getDateVerification(status);

  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";
  const displayedCurrentUser = isLibre ? "Aucun" : currentUserText;

  useEffect(() => {
    const savedName = localStorage.getItem("employe_nom");

    if (!savedName) {
      router.push("/employe/login");
      return;
    }

    setEmployeName(savedName);
    loadAllData();
    loadLastRequestResult(savedName);

    const interval = setInterval(() => {
      loadAllData();
      loadLastRequestResult(savedName);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAllData() {
    const statusData = await loadStatus();
    await loadHistoryInfos(statusData);
    await loadCurrentRdpUser(statusData);
  }

  async function loadStatus() {
    try {
      setLoadingStatus(true);

      const response = await fetch("/api/status", {
        cache: "no-store",
      });

      const data = await response.json();
      setStatus(data);

      return data as StatusData;
    } catch (error) {
      console.error("Erreur lors du chargement de l'etat du poste :", error);
      setStatus(null);
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadHistoryInfos(statusData?: StatusData | null) {
    try {
      const response = await fetch("/api/history?page=1&pageSize=50&sort=recent", {
        cache: "no-store",
      });

      const data = await response.json();
      const items = getHistoryItems(data);

      if (items.length > 0) {
        const last = items[0];

        setLastActivityText(
          `${last.action || last.nomSession || "Activite"} - ${
            last.date || "-"
          } ${last.heure || ""}`
        );
      } else {
        setLastActivityText("Aucune activite recente");
      }

      const currentSessions = getSessions(statusData || status);

      if (currentSessions > 0) {
        setCurrentUserText(findCurrentEmployee(items));
      } else {
        setCurrentUserText("Aucun");
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique recent :", error);
      setLastActivityText("Non disponible");

      const currentSessions = getSessions(statusData || status);
      setCurrentUserText(currentSessions > 0 ? "Session active" : "Aucun");
    }
  }

  async function getOccupantBeforeRequest() {
    try {
      const statusResponse = await fetch("/api/status", {
        cache: "no-store",
      });

      const statusData = (await statusResponse.json()) as StatusData;
      const currentSessions = getSessions(statusData);
      const currentEtat = getEtatLabel(statusData);

      if (currentEtat === "Libre" || currentSessions === 0) {
        return "Aucun";
      }

      const historyResponse = await fetch(
        "/api/history?page=1&pageSize=50&sort=recent",
        {
          cache: "no-store",
        }
      );

      const historyData = await historyResponse.json();
      const items = getHistoryItems(historyData);

      return findCurrentEmployee(items);
    } catch (error) {
      console.error("Erreur lors de la detection de l'utilisateur actuel :", error);
      return currentUserText || "Session active";
    }
  }

  async function loadCurrentRdpUser(statusData?: StatusData | null) {
    try {
      const response = await fetch("/api/current-rdp-user", {
        cache: "no-store",
      });

      const data = await response.json();
      const currentSessions = getSessions(statusData || status);

      if (!data?.session_active && currentSessions === 0) {
        setCurrentUserText("Aucun");
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'utilisateur RDP actuel :", error);
    }
  }

  async function loadLastRequestResult(employeeName: string) {
    try {
      if (!employeeName) return;

      await fetch("/api/sync-request-responses", {
        cache: "no-store",
      }).catch(() => null);

      await fetch("/api/sync-release", {
        cache: "no-store",
      }).catch(() => null);

      const response = await fetch(
        `/api/my-last-request?employeeName=${encodeURIComponent(employeeName)}`,
        {
          cache: "no-store",
        }
      );

      const data: LastRequestResponse = await response.json();
      const lastRequest = data.request;

      if (!lastRequest) return;

      const requestStatus = normalize(lastRequest.status);
      const responseMessage = String(lastRequest.response_message || "").trim();

      if (isAuthorizedStatus(requestStatus)) {
        setRequestAuthorized(true);
        setRequestWaiting(false);
        setMessage(
          responseMessage ||
            "Acces autorise. Vous pouvez maintenant vous connecter au poste principal."
        );
        return;
      }

      if (isRejectedStatus(requestStatus)) {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setMessage(
          responseMessage ||
            "Demande refusee par l'utilisateur actuellement connecte."
        );
        return;
      }

      if (isWaitingStatus(requestStatus)) {
        setRequestAuthorized(false);
        setRequestWaiting(true);

        setMessage(
          responseMessage ||
            "Demande envoyee. Elle est en attente de reponse de l'utilisateur actuellement connecte."
        );
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la derniere demande :", error);
    }
  }

  async function handleRequestAccess() {
    try {
      setRequestLoading(true);
      setMessage("");
      setRequestAuthorized(false);
      setRequestWaiting(false);

      const occupantBeforeRequest = await getOccupantBeforeRequest();
      const selectedReason = getPriorityLabel(priority);

      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: employeName,
          employeeName: employeName,
          nom_complet: employeName,
          utilisateur: employeName,
          nom: employeName,
          user: employeName,
          pcName: "PC employe",
          priority,
          reason: selectedReason,
          message: optionalMessage.trim(),
        }),
      });

      const result: RequestResult = await response.json();
      const responseMessage = result.message || "";

      const authorized =
        result.authorized === true ||
        result.autorise === true ||
        isAuthorizedStatus(result.status) ||
        isAuthorizedStatus(responseMessage);

      const waiting =
        isWaitingStatus(result.status) ||
        isWaitingStatus(responseMessage);

      const rejected =
        isRejectedStatus(result.status) ||
        isRejectedStatus(responseMessage);

      if (authorized) {
        setRequestAuthorized(true);
        setRequestWaiting(false);
        setMessage(
          "Acces autorise. Vous pouvez maintenant vous connecter au poste principal."
        );
      } else if (waiting) {
        setRequestAuthorized(false);
        setRequestWaiting(true);
        setMessage(
          responseMessage ||
            "Demande envoyee. Elle est en attente de reponse de l'utilisateur actuellement connecte."
        );
      } else if (rejected) {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setMessage(
          responseMessage ||
            "Demande refusee par l'utilisateur actuellement connecte."
        );
      } else {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setMessage(buildRefusedMessage(occupantBeforeRequest));
      }

      await loadAllData();
      await loadLastRequestResult(employeName);
    } catch (error) {
      console.error("Erreur lors de l'envoi de la demande d'acces :", error);
      setMessage("Erreur lors de l'envoi de la demande d'acces.");
      setRequestAuthorized(false);
      setRequestWaiting(false);
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
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <header className="bg-blue-950 text-white shadow-lg">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl">
              🖥️
            </div>

            <div>
              <p className="text-lg font-bold">SRM-SM</p>
              <p className="text-xs text-blue-200">Acces au poste principal</p>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-black md:text-2xl">
              Gestion d'acces RDP
            </h1>
          </div>

          <div className="flex items-center justify-start gap-3 md:justify-end">
            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-blue-700 font-black sm:flex">
              {getInitials(employeName)}
            </div>

            <div className="text-left md:text-right">
              <p className="text-xs text-blue-200">Espace employe</p>
              <p className="font-bold leading-tight">{employeName}</p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <div
                    className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl ${
                      isLibre
                        ? "bg-green-100 text-green-700"
                        : isOccupe
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isLibre ? "✓" : isOccupe ? "!" : "?"}
                  </div>

                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                      Etat du poste principal
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h2
                        className={`text-4xl font-black ${
                          isLibre
                            ? "text-green-700"
                            : isOccupe
                            ? "text-red-700"
                            : "text-slate-700"
                        }`}
                      >
                        Poste {etat.toLowerCase()}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                          isLibre
                            ? "bg-green-100 text-green-700"
                            : isOccupe
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isLibre ? "Disponible" : isOccupe ? "Occupe" : "Inconnu"}
                      </span>
                    </div>

                    <p className="mt-3 text-slate-600">
                      {isLibre
                        ? "Le poste principal est actuellement libre et pret a etre utilise."
                        : isOccupe
                        ? "Le poste principal est actuellement occupe par une session RDP."
                        : "Le statut du poste principal n'est pas encore disponible."}
                    </p>
                  </div>
                </div>

                <div className="min-w-[230px] border-slate-200 lg:border-l lg:pl-8">
                  <p className="text-sm font-semibold text-slate-500">
                    Derniere verification
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isLibre
                          ? "bg-green-500"
                          : isOccupe
                          ? "bg-red-500"
                          : "bg-slate-400"
                      }`}
                    />

                    <p className="font-bold text-slate-800">
                      {loadingStatus ? "Chargement..." : dateVerification}
                    </p>
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    Mise a jour automatique toutes les 5 secondes.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg md:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-xl font-black text-white">
                  👤
                </div>

                <div>
                  <h2 className="text-2xl font-black text-slate-800">
                    Demande d'acces
                  </h2>

                  <p className="mt-1 text-slate-600">
                    Votre demande sera envoyee avec le nom :{" "}
                    <span className="font-black text-slate-900">
                      {employeName}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Nom complet
                </p>
                <p className="mt-1 font-bold text-slate-900">{employeName}</p>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-bold text-slate-700">
                  Motif de la demande
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriority(option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        priority === option.value
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <p className="font-black">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Message optionnel
                </label>

                <textarea
                  value={optionalMessage}
                  onChange={(event) => setOptionalMessage(event.target.value)}
                  rows={3}
                  placeholder="Expliquez brievement votre besoin si necessaire."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                onClick={handleRequestAccess}
                disabled={requestLoading}
                className="mt-6 w-full rounded-2xl bg-blue-700 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                🔒{" "}
                {requestLoading ? "Envoi de la demande..." : "Demander l'acces"}
              </button>

              <p className="mt-4 text-center text-sm text-slate-500">
                Votre demande sera enregistree et visible par le responsable.
              </p>

              {message && (
                <div
                  className={`mt-5 rounded-2xl border p-4 font-semibold ${
                    requestAuthorized
                      ? "border-green-200 bg-green-50 text-green-800"
                      : requestWaiting
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {message}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <h3 className="text-xl font-black text-slate-800">
                Etat du poste principal
              </h3>

              <div className="mt-5 divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-500">Sessions actives</span>
                  <span className="text-xl font-black text-blue-700">
                    {sessions}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-500">Utilisateur actuel</span>
                  <span className="text-right font-bold text-slate-800">
                    {displayedCurrentUser}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-500">Derniere activite</span>
                  <span className="text-right font-bold text-slate-800">
                    {lastActivityText}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-slate-500">Derniere verification</span>
                  <span className="text-right font-bold text-slate-800">
                    {loadingStatus ? "..." : dateVerification}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-700 font-black text-white">
                  i
                </span>

                <div>
                  <h3 className="text-xl font-black text-blue-950">
                    Acces exclusif
                  </h3>

                  <p className="mt-3 leading-7 text-blue-900/80">
                    Pour des raisons de securite et de performance, une seule
                    personne peut acceder au poste principal a la fois.
                  </p>

                  <p className="mt-3 leading-7 text-blue-900/80">
                    Si le poste est occupe, votre demande sera mise en attente
                    et l'utilisateur actif sera notifie.
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-3xl border p-6 shadow-lg ${
                requestAuthorized
                  ? "border-green-200 bg-green-50"
                  : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
                    requestAuthorized
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  🖥️
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    {requestAuthorized ? "Acces autorise" : "Connexion RDP"}
                  </h3>

                  <p className="mt-2 text-slate-600">
                    {requestAuthorized
                      ? "Vous pouvez maintenant vous connecter au poste principal."
                      : "Le bouton sera active apres une demande autorisee."}
                  </p>
                </div>
              </div>

              <button
                onClick={handleRdpConnect}
                disabled={!requestAuthorized}
                className={`mt-6 w-full rounded-2xl py-4 font-black transition ${
                  requestAuthorized
                    ? "bg-green-600 text-white shadow-lg shadow-green-200 hover:bg-green-700"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                🖥️ Se connecter par RDP
              </button>

              <p className="mt-4 text-center text-sm text-slate-500">
                Connexion securisee via le protocole RDP.
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center text-sm text-slate-400">
          © 2026 SRM-SM. Tous droits reserves.
        </footer>
      </section>
    </main>
  );
}