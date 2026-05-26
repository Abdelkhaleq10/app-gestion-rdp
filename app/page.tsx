"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  LogOut,
  MonitorCheck,
  Wifi,
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
  authorized?: boolean;
  autorise?: boolean;
  message?: string;
  status?: string;
  requestId?: number;
};

type LastRequestResponse = {
  success?: boolean;
  request?: {
    id: number;
    Utilisateur?: string;
    utilisateur?: string;
    status: string;
    priority?: string;
    reason?: string;
    current_user_response?: string;
    response_message?: string;
    response_at?: string;
    active_user_name?: string;
    activeUserName?: string;
    currentUserText?: string;
  } | null;
};

type HistoryItem = {
  id: number;
  date?: string;
  heure?: string;
  utilisateur?: string;
  nomSession?: string;
  session?: string;
  ip?: string;
  typeIP?: string;
  action?: string;
};

type PriorityOption = {
  value: string;
  label: string;
  description: string;
  level: number;
};

const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: "urgent", label: "Urgent", description: "Besoin prioritaire ou situation bloquante.", level: 5 },
  { value: "consultation", label: "Consultation", description: "Consultation rapide d'une information.", level: 2 },
  { value: "verification", label: "Vérification", description: "Vérification d'un élément ou d'un document.", level: 3 },
  { value: "impression", label: "Impression", description: "Impression ou récupération d'un document.", level: 2 },
  { value: "assistance", label: "Assistance", description: "Besoin d'aide ou d'intervention.", level: 4 },
  { value: "autre", label: "Autre", description: "Autre motif de demande.", level: 1 },
];

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getEtatLabel(status: StatusData | null) {
  const raw = status?.etat_poste || status?.etatPoste || status?.status || "";
  const value = normalize(raw);

  if (value.includes("libre")) return "Libre";
  if (value.includes("occupe")) return "Occupe";

  return "Inconnu";
}

function getSessions(status: StatusData | null) {
  return Number(
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
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getPriorityLabel(value: string) {
  return PRIORITY_OPTIONS.find((item) => item.value === value)?.label || "Autre";
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
    status === "pending" ||
    status === "waiting_current_user" ||
    status === "waiting_release" ||
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

function isFreshFinalMessage(responseAt?: string) {
  if (!responseAt) return false;

  const raw = String(responseAt).trim();
  const fixed = raw.includes("T") ? raw : raw.replace(" ", "T");
  const time = new Date(fixed).getTime();

  if (Number.isNaN(time)) return false;

  return Date.now() - time <= 20000;
}

function isValidUserName(value: string) {
  const user = normalize(value);

  if (!user) return false;
  if (user === "n/a") return false;
  if (user === "-") return false;
  if (user.includes("acces direct non identifie")) return false;
  if (user === "utilisateur inconnu") return false;
  if (user === "unknown") return false;
  if (user === "administrateur") return false;
  if (user === "administrator") return false;
  if (user === "autocad_user") return false;

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

function isRealRdpEvent(item: HistoryItem) {
  const text = normalize(`${item.action || ""} ${item.nomSession || ""} ${item.session || ""}`);

  if (!isValidUserName(item.utilisateur || "")) return false;

  if (text.includes("demande")) return false;
  if (text.includes("refuse")) return false;
  if (text.includes("autorise")) return false;
  if (text.includes("deconnect")) return false;
  if (text.includes("deconnexion")) return false;

  return text.includes("connexion") || text.includes("reconnexion");
}

function findCurrentEmployee(items: HistoryItem[]) {
  const latest = items.find(isRealRdpEvent);

  if (latest?.utilisateur && isValidUserName(latest.utilisateur)) {
    return latest.utilisateur;
  }

  return "Session RDP active";
}

function getWaitingMessage(activeUser: string, responseMessage?: string) {
  const user = String(activeUser || "").trim();
  const apiMessage = String(responseMessage || "").trim();
  const normalizedApiMessage = normalize(apiMessage);

  const isGenericApiMessage =
    normalizedApiMessage.includes("utilisateur actuellement connecte") ||
    normalizedApiMessage.includes("utilisateur actif") ||
    normalizedApiMessage.includes("session rdp active");

  if (
    user &&
    user !== "Aucun" &&
    user !== "Session RDP active" &&
    isValidUserName(user)
  ) {
    return `Demande envoyée à ${user}. En attente de sa réponse.`;
  }

  if (apiMessage && !isGenericApiMessage) {
    return apiMessage;
  }

  return "Demande envoyée à l'utilisateur actif. En attente de sa réponse.";
}

export default function EmployePage() {
  const router = useRouter();

  const [employeName, setEmployeName] = useState("");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [priority, setPriority] = useState("consultation");
  const [optionalMessage, setOptionalMessage] = useState("");

  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requestAuthorized, setRequestAuthorized] = useState(false);
  const [requestWaiting, setRequestWaiting] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [lastDisplayedFinalId, setLastDisplayedFinalId] = useState<number | null>(null);

  const [lastActivityText, setLastActivityText] = useState("Aucune activité récente");
  const [currentUserText, setCurrentUserText] = useState("Aucun");

  const currentEmployeeConnectedRef = useRef(false);
  const isLibreRef = useRef(false);
  const isOccupeRef = useRef(false);

  const etat = getEtatLabel(status);
  const sessions = getSessions(status);
  const dateVerification = getDateVerification(status);

  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";

  const isCurrentEmployeeConnected =
    isOccupe && normalize(currentUserText) === normalize(employeName);

  const canDownloadRdp =
    requestAuthorized && isLibre && !isCurrentEmployeeConnected;

  useEffect(() => {
    currentEmployeeConnectedRef.current = isCurrentEmployeeConnected;
    isLibreRef.current = isLibre;
    isOccupeRef.current = isOccupe;
  }, [isCurrentEmployeeConnected, isLibre, isOccupe]);

  const rdpCard = useMemo(() => {
    if (isCurrentEmployeeConnected) {
      return {
        title: "Session active",
        text: "Vous êtes actuellement connecté au poste principal. Aucune nouvelle demande n'est nécessaire.",
        className: "bg-blue-50 text-blue-800 ring-blue-200",
        buttonClass: "bg-slate-200 text-slate-500 cursor-not-allowed",
      };
    }

    if (canDownloadRdp) {
      return {
        title: "Accès autorisé",
        text: "Vous pouvez maintenant vous connecter au poste principal.",
        className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
        buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      };
    }

    if (requestAuthorized && isOccupe) {
      return {
        title: "En attente de libération",
        text: "Votre demande est autorisée, mais le poste est encore occupé. Le fichier RDP sera disponible après fermeture complète de la session active.",
        className: "bg-orange-50 text-orange-800 ring-orange-200",
        buttonClass: "bg-slate-200 text-slate-500 cursor-not-allowed",
      };
    }

    return {
      title: "Connexion RDP",
      text: "Le bouton sera activé après une demande autorisée et un poste libre.",
      className: "bg-white text-slate-700 ring-slate-200",
      buttonClass: "bg-slate-200 text-slate-500 cursor-not-allowed",
    };
  }, [canDownloadRdp, requestAuthorized, isOccupe, isCurrentEmployeeConnected]);

  useEffect(() => {
    const savedName = localStorage.getItem("employe_nom");

    if (!savedName) {
      router.push("/employe/login");
      return;
    }

    setEmployeName(savedName);

    fetch("/api/employe-last-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: savedName,
        employeeName: savedName,
        employeName: savedName,
      }),
    }).catch((error) => {
      console.error("Erreur mise à jour dernière connexion :", error);
    });
  }, [router]);

  useEffect(() => {
    if (!employeName) return;

    loadAllData();
    loadLastRequestResult(employeName);

    const interval = setInterval(() => {
      loadAllData();
      loadLastRequestResult(employeName);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeName]);

  useEffect(() => {
    if (isCurrentEmployeeConnected) {
      setRequestAuthorized(false);
      setRequestWaiting(false);
      setActiveRequestId(null);
      setLastDisplayedFinalId(null);
      setMessage(
        "Vous êtes actuellement connecté au poste principal. Aucune nouvelle demande n'est nécessaire."
      );
    }
  }, [isCurrentEmployeeConnected]);

  async function loadAllData() {
    const statusData = await loadStatus();
    await loadHistoryInfos(statusData);
  }

  async function loadStatus() {
    try {
      setLoadingStatus(true);

      const response = await fetch("/api/status", { cache: "no-store" });
      const data = (await response.json()) as StatusData;

      setStatus(data);
      return data;
    } catch (error) {
      console.error("Erreur chargement status :", error);
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
          `${last.action || last.nomSession || last.session || "Activité"} - ${
            last.date || "-"
          } ${last.heure || ""}`
        );
      } else {
        setLastActivityText("Aucune activité récente");
      }

      const currentSessions = getSessions(statusData || status);

      if (currentSessions > 0) {
        setCurrentUserText(findCurrentEmployee(items));
      } else {
        setCurrentUserText("Aucun");
      }
    } catch (error) {
      console.error("Erreur chargement historique :", error);
      setLastActivityText("Non disponible");

      const currentSessions = getSessions(statusData || status);
      setCurrentUserText(currentSessions > 0 ? "Session RDP active" : "Aucun");
    }
  }

  async function loadLastRequestResult(employeeName: string) {
    try {
      if (!employeeName) return;

      if (currentEmployeeConnectedRef.current) {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setActiveRequestId(null);
        setLastDisplayedFinalId(null);
        setMessage(
          "Vous êtes actuellement connecté au poste principal. Aucune nouvelle demande n'est nécessaire."
        );
        return;
      }

      await fetch("/api/sync-request-responses", { cache: "no-store" }).catch(() => null);
      await fetch("/api/sync-release", { cache: "no-store" }).catch(() => null);

      const response = await fetch(
        `/api/my-last-request?employeeName=${encodeURIComponent(employeeName)}`,
        { cache: "no-store" }
      );

      const data: LastRequestResponse = await response.json();
      const lastRequest = data.request;

      if (!lastRequest) {
        if (!currentEmployeeConnectedRef.current) {
          setRequestAuthorized(false);
          setRequestWaiting(false);
          setMessage("");
          setActiveRequestId(null);
        }
        return;
      }

      const requestId = Number(lastRequest.id);
      const requestStatus = normalize(lastRequest.status);
      const responseMessage = String(lastRequest.response_message || "").trim();

      if (activeRequestId && requestId !== activeRequestId) {
        return;
      }

      if (isWaitingStatus(requestStatus)) {
        const activeNameFromRequest =
          lastRequest.active_user_name ||
          lastRequest.activeUserName ||
          lastRequest.currentUserText ||
          currentUserText;

        setActiveRequestId(requestId);
        setLastDisplayedFinalId(null);
        setRequestAuthorized(false);
        setRequestWaiting(true);
        setMessage(getWaitingMessage(activeNameFromRequest, responseMessage));
        return;
      }

      if (isAuthorizedStatus(requestStatus)) {
        setActiveRequestId(requestId);
        setRequestWaiting(false);
        setRequestAuthorized(true);

        if (isLibreRef.current) {
          setMessage(
            responseMessage ||
              "Poste libre. Accès autorisé. Vous pouvez vous connecter par RDP."
          );
        } else {
          setMessage(
            "Accès autorisé, mais le poste principal est encore occupé. Veuillez attendre la libération complète de la session."
          );
        }

        setLastDisplayedFinalId(requestId);
        return;
      }

      if (isRejectedStatus(requestStatus)) {
        setRequestAuthorized(false);
        setRequestWaiting(false);

        if (
          lastDisplayedFinalId !== requestId &&
          isFreshFinalMessage(lastRequest.response_at)
        ) {
          setMessage(
            responseMessage ||
              "Demande refusée par l'utilisateur actuellement connecté."
          );

          setLastDisplayedFinalId(requestId);

          setTimeout(() => {
            if (!currentEmployeeConnectedRef.current) {
              setMessage("");
              setActiveRequestId(null);
              setLastDisplayedFinalId(null);
            }
          }, 20000);
        } else if (!isFreshFinalMessage(lastRequest.response_at)) {
          setMessage("");
          setActiveRequestId(null);
        }
      }
    } catch (error) {
      console.error("Erreur chargement derniere demande :", error);
    }
  }

  async function handleRequestAccess() {
    if (currentEmployeeConnectedRef.current) {
      setRequestAuthorized(false);
      setRequestWaiting(false);
      setActiveRequestId(null);
      setLastDisplayedFinalId(null);
      setMessage(
        "Vous êtes actuellement connecté au poste principal. Aucune nouvelle demande n'est nécessaire."
      );
      return;
    }

    try {
      setRequestLoading(true);
      setMessage("");
      setRequestAuthorized(false);
      setRequestWaiting(false);

      const selectedReason = getPriorityLabel(priority);

      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          activeUserName: currentUserText,
          currentUserText,
        }),
      });

      const result: RequestResult = await response.json();

      if (result.requestId) {
        setActiveRequestId(Number(result.requestId));
        setLastDisplayedFinalId(null);
      }

      const responseMessage = String(result.message || "");

      const authorized =
        result.authorized === true ||
        result.autorise === true ||
        isAuthorizedStatus(result.status) ||
        isAuthorizedStatus(responseMessage);

      const waiting =
        isWaitingStatus(result.status) || isWaitingStatus(responseMessage);

      const rejected =
        isRejectedStatus(result.status) || isRejectedStatus(responseMessage);

      if (authorized) {
        setRequestAuthorized(true);
        setRequestWaiting(false);

        if (isLibreRef.current) {
          setMessage(
            responseMessage ||
              "Poste libre. Accès autorisé. Vous pouvez vous connecter par RDP."
          );
        } else {
          setMessage(
            "Accès autorisé, mais connexion RDP bloquée temporairement : le poste principal est encore occupé."
          );
        }
      } else if (waiting) {
        setRequestAuthorized(false);
        setRequestWaiting(true);
        setMessage(getWaitingMessage(currentUserText, responseMessage));
      } else if (rejected) {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setMessage(responseMessage || "Demande refusée.");

        setTimeout(() => {
          if (!currentEmployeeConnectedRef.current) {
            setMessage("");
            setActiveRequestId(null);
            setLastDisplayedFinalId(null);
          }
        }, 20000);
      } else {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setMessage(
          responseMessage ||
            "Accès refusé : le poste principal est actuellement occupé."
        );
      }

      await loadAllData();
      await loadLastRequestResult(employeName);
    } catch (error) {
      console.error("Erreur demande acces :", error);
      setMessage("Erreur lors de l'envoi de la demande d'accès.");
      setRequestAuthorized(false);
      setRequestWaiting(false);
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleCancelRequest() {
    try {
      setRequestLoading(true);

      const response = await fetch("/api/cancel-my-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: employeName,
          requestId: activeRequestId,
        }),
      });

      const result = await response.json();

      setRequestAuthorized(false);
      setRequestWaiting(false);
      setActiveRequestId(null);
      setLastDisplayedFinalId(null);
      setOptionalMessage("");
      setMessage(
        result.message ||
          "Demande annulée. Vous pouvez reformuler une nouvelle demande."
      );

      setTimeout(() => {
        if (!currentEmployeeConnectedRef.current) {
          setMessage("");
        }
      }, 5000);

      await loadAllData();
      await loadLastRequestResult(employeName);
    } catch (error) {
      console.error("Erreur annulation demande :", error);
      setMessage("Erreur lors de l'annulation de la demande.");
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
    if (currentEmployeeConnectedRef.current) {
      setMessage(
        "Vous êtes actuellement connecté au poste principal. Aucune nouvelle connexion n'est nécessaire."
      );
      return;
    }

    if (!requestAuthorized || !isLibreRef.current) {
      setMessage(
        isOccupeRef.current
          ? "Connexion RDP bloquée : le poste principal est encore occupé. Veuillez attendre la libération complète de la session."
          : "Connexion RDP bloquée : aucune demande autorisée active."
      );
      return;
    }

    window.location.href = "/api/rdp-file";
  }

  if (!employeName) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
          <p className="mt-4 font-bold text-slate-700">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="relative z-50 bg-[#173987] text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-6 py-5 lg:grid-cols-[250px_minmax(0,1fr)_430px]">
          <div className="flex items-center justify-center lg:justify-start">
            <Image
              src="/images/logo-srm-icon.png"
              alt="Logo SRM-SM"
              width={320}
              height={160}
              className="h-[105px] w-auto object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              priority
            />
          </div>

          <div className="min-w-0 text-center">
            <h1 className="truncate text-2xl font-black leading-tight tracking-tight text-white xl:text-3xl">
              Gestion d&apos;accès par RDP
            </h1>

            <p className="mt-3 text-xs font-black uppercase tracking-[0.45em] text-blue-100">
              Espace employé
            </p>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-3 lg:justify-end">
            <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/15 backdrop-blur">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg">
                {getInitials(employeName)}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
                  Espace employé
                </p>
                <p className="max-w-[175px] truncate text-sm font-black text-white">
                  {employeName}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-red-500 px-5 text-sm font-black text-white shadow-xl shadow-red-950/20 transition hover:bg-red-600"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.75fr]">
          <div className="space-y-6">
            <section
              className={`relative overflow-hidden rounded-[2rem] shadow-2xl ring-1 ${
                isLibre
                  ? "bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-700 text-white shadow-emerald-900/30 ring-emerald-300"
                  : isOccupe
                  ? "bg-gradient-to-br from-red-500 via-red-600 to-rose-800 text-white shadow-red-900/35 ring-red-300"
                  : "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800 text-white shadow-slate-900/25 ring-slate-300"
              }`}
            >
              <div
                className={`absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl ${
                  isLibre
                    ? "bg-emerald-200/40"
                    : isOccupe
                    ? "bg-red-200/40"
                    : "bg-white/20"
                } animate-pulse`}
              />

              <div
                className={`absolute -bottom-28 right-8 h-80 w-80 rounded-full blur-3xl ${
                  isLibre
                    ? "bg-cyan-200/30"
                    : isOccupe
                    ? "bg-orange-200/30"
                    : "bg-slate-200/20"
                } animate-pulse`}
              />

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.26),transparent_30%),radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.18),transparent_28%)]" />

              <div className="relative p-7 md:p-9">
                <div className="flex flex-col gap-7 md:flex-row md:items-center">
                  <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
                    <div
                      className={`absolute h-28 w-28 rounded-[2rem] ${
                        isLibre
                          ? "bg-emerald-200/40"
                          : isOccupe
                          ? "bg-red-200/45"
                          : "bg-white/25"
                      } blur-xl animate-pulse`}
                    />

                    <div
                      className={`absolute h-28 w-28 rounded-[2rem] border ${
                        isLibre
                          ? "border-emerald-100/45"
                          : isOccupe
                          ? "border-red-100/45"
                          : "border-white/35"
                      } animate-ping`}
                    />

                    <div
                      className={`relative flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/30 bg-white/18 shadow-2xl backdrop-blur-md ${
                        isLibre
                          ? "shadow-emerald-950/20"
                          : isOccupe
                          ? "shadow-red-950/30"
                          : "shadow-slate-950/20"
                      }`}
                    >
                      {isLibre ? (
                        <CheckCircle2 className="h-16 w-16 text-white drop-shadow-lg" />
                      ) : isOccupe ? (
                        <LockKeyhole className="h-16 w-16 text-white drop-shadow-lg" />
                      ) : (
                        <AlertTriangle className="h-16 w-16 text-white drop-shadow-lg" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/18 px-5 py-2 text-xs font-black uppercase tracking-[0.25em] text-white/95 backdrop-blur">
                      {isLibre ? (
                        <>
                          <Activity className="h-4 w-4" />
                          Disponible
                        </>
                      ) : isOccupe ? (
                        <>
                          <Wifi className="h-4 w-4" />
                          Session en cours
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4" />
                          Synchronisation
                        </>
                      )}
                    </div>

                    <h1 className="mt-5 text-5xl font-black tracking-tight text-white md:text-6xl">
                      {isCurrentEmployeeConnected
                        ? "Session active"
                        : isLibre
                        ? "Poste libre"
                        : isOccupe
                        ? "Poste occupé"
                        : "Statut inconnu"}
                    </h1>

                    <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/90">
                      {isCurrentEmployeeConnected
                        ? "Vous êtes actuellement connecté au poste principal."
                        : isLibre
                        ? "Le poste principal est disponible. Vous pouvez envoyer une demande d'accès."
                        : isOccupe
                        ? "Le poste principal est occupé par une session RDP. Votre demande sera envoyée à l'utilisateur actif."
                        : "Statut en cours de synchronisation avec le poste principal."}
                    </p>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-3 text-sm font-black text-white/90 backdrop-blur">
                      <MonitorCheck className="h-5 w-5" />
                      {sessions} session(s) active(s)
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200 md:p-8">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-black text-white">
                  {getInitials(employeName)}
                </div>

                <div>
                  <h2 className="text-3xl font-black text-slate-950">
                    Demande d'accès
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Votre demande sera envoyée avec le nom :{" "}
                    <span className="font-black text-slate-900">
                      {employeName}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Nom complet
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {employeName}
                </p>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-black text-slate-800">
                  Motif de la demande
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {PRIORITY_OPTIONS.map((option) => {
                    const selected = priority === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPriority(option.value)}
                        disabled={isCurrentEmployeeConnected}
                        className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
                          selected
                            ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-lg font-black ${
                              selected ? "text-blue-800" : "text-slate-800"
                            }`}
                          >
                            {option.label}
                          </p>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                              option.level >= 5
                                ? "bg-orange-100 text-orange-700"
                                : option.level >= 3
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            P{option.level}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-black text-slate-800">
                  Message optionnel
                </label>

                <textarea
                  value={optionalMessage}
                  onChange={(event) => setOptionalMessage(event.target.value)}
                  rows={4}
                  disabled={isCurrentEmployeeConnected}
                  placeholder="Expliquez brièvement votre besoin si nécessaire"
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleRequestAccess}
                  disabled={
                    requestLoading ||
                    isCurrentEmployeeConnected ||
                    requestWaiting ||
                    requestAuthorized
                  }
                  className="w-full rounded-2xl bg-blue-700 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {requestLoading
                    ? "Traitement en cours..."
                    : isCurrentEmployeeConnected
                    ? "Session déjà active"
                    : requestWaiting || requestAuthorized
                    ? "Demande déjà envoyée"
                    : "Demander l'accès"}
                </button>

                {(requestWaiting || requestAuthorized) &&
                  !isCurrentEmployeeConnected && (
                    <button
                      onClick={handleCancelRequest}
                      disabled={requestLoading}
                      className="w-full rounded-2xl border border-orange-200 bg-orange-50 px-6 py-3 text-sm font-black text-orange-700 transition hover:-translate-y-0.5 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Annuler / reformuler ma demande
                    </button>
                  )}
              </div>

              <p className="mt-3 text-center text-xs font-semibold text-slate-400">
                Votre demande sera enregistrée et visible par le responsable.
              </p>

              {(message || isCurrentEmployeeConnected) && (
                <div
                  className={`mt-5 rounded-2xl p-4 text-sm font-bold ring-1 ${
                    isCurrentEmployeeConnected
                      ? "bg-blue-50 text-blue-700 ring-blue-200"
                      : requestAuthorized && isLibre
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : requestWaiting
                      ? "bg-orange-50 text-orange-700 ring-orange-200"
                      : requestAuthorized && isOccupe
                      ? "bg-orange-50 text-orange-700 ring-orange-200"
                      : "bg-red-50 text-red-700 ring-red-200"
                  }`}
                >
                  {isCurrentEmployeeConnected
                    ? "Vous êtes actuellement connecté au poste principal. Aucune nouvelle demande n'est nécessaire."
                    : message}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
              <h3 className="text-2xl font-black text-slate-950">
                État du poste principal
              </h3>

              <div className="mt-6 space-y-4">
                <InfoRow label="Sessions actives" value={String(sessions)} />
                <InfoRow label="Utilisateur actuel" value={isLibre ? "Aucun" : currentUserText} />
                <InfoRow label="Dernière activité" value={lastActivityText} />
                <InfoRow label="Dernière vérification" value={dateVerification} />
              </div>
            </section>

            <section className="rounded-[2rem] bg-blue-50 p-6 shadow-xl shadow-slate-200/70 ring-1 ring-blue-100">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-lg font-black text-white">
                  i
                </div>

                <div>
                  <h3 className="text-2xl font-black text-blue-950">
                    Accès exclusif
                  </h3>

                  <p className="mt-3 text-sm font-medium leading-7 text-blue-800">
                    Pour des raisons de sécurité et de performance, une seule
                    personne peut accéder au poste principal à la fois.
                  </p>

                  <p className="mt-3 text-sm font-medium leading-7 text-blue-800">
                    Si le poste est occupé, votre demande sera mise en attente et
                    l'utilisateur actif sera notifié.
                  </p>
                </div>
              </div>
            </section>

            <section
              className={`rounded-[2rem] p-6 shadow-xl shadow-slate-200/70 ring-1 ${rdpCard.className}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-black ring-1 ring-slate-200">
                  PC
                </div>

                <div className="flex-1">
                  <h3 className="text-2xl font-black">{rdpCard.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6">
                    {rdpCard.text}
                  </p>
                </div>
              </div>

              <button
                onClick={handleRdpConnect}
                disabled={!canDownloadRdp}
                className={`mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black shadow-lg transition ${
                  rdpCard.buttonClass
                } ${canDownloadRdp ? "hover:-translate-y-0.5" : ""}`}
              >
                Se connecter par RDP
              </button>

              <p className="mt-3 text-center text-xs font-semibold opacity-70">
                Connexion sécurisée via le protocole RDP
              </p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="max-w-[220px] text-right text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}