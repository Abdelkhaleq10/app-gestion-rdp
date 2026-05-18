"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  {
    value: "urgent",
    label: "Urgent",
    description: "Besoin prioritaire ou situation bloquante.",
    level: 5,
  },
  {
    value: "consultation",
    label: "Consultation",
    description: "Consultation rapide d'une information.",
    level: 2,
  },
  {
    value: "verification",
    label: "Verification",
    description: "Verification d'un element ou d'un document.",
    level: 3,
  },
  {
    value: "impression",
    label: "Impression",
    description: "Impression ou recuperation d'un document.",
    level: 2,
  },
  {
    value: "assistance",
    label: "Assistance",
    description: "Besoin d'aide ou d'intervention.",
    level: 4,
  },
  {
    value: "autre",
    label: "Autre",
    description: "Autre motif de demande.",
    level: 1,
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
  return (
    status?.date_verification || status?.dateVerification || "Non disponible"
  );
}

function getInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

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
  const text = normalize(
    `${item.action || ""} ${item.nomSession || ""} ${item.session || ""}`
  );

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
  const [lastDisplayedFinalId, setLastDisplayedFinalId] = useState<number | null>(
    null
  );

  const [lastActivityText, setLastActivityText] = useState(
    "Aucune activite recente"
  );
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
        text: "Vous etes actuellement connecte au poste principal. Aucune nouvelle demande n'est necessaire.",
        className: "bg-blue-50 text-blue-800 ring-blue-200",
        buttonClass: "bg-slate-200 text-slate-500 cursor-not-allowed",
      };
    }

    if (canDownloadRdp) {
      return {
        title: "Acces autorise",
        text: "Vous pouvez maintenant vous connecter au poste principal.",
        className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
        buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      };
    }

    if (requestAuthorized && isOccupe) {
      return {
        title: "En attente de liberation",
        text: "Votre demande est autorisee, mais le poste est encore occupe. Le fichier RDP sera disponible apres fermeture complete de la session active.",
        className: "bg-orange-50 text-orange-800 ring-orange-200",
        buttonClass: "bg-slate-200 text-slate-500 cursor-not-allowed",
      };
    }

    return {
      title: "Connexion RDP",
      text: "Le bouton sera active apres une demande autorisee et un poste libre.",
      className: "bg-white text-slate-700 ring-slate-200",
      buttonClass: "bg-slate-200 text-slate-500 cursor-not-allowed",
    };
  }, [
    canDownloadRdp,
    requestAuthorized,
    isOccupe,
    isCurrentEmployeeConnected,
  ]);

  useEffect(() => {
    const savedName = localStorage.getItem("employe_nom");

    if (!savedName) {
      router.push("/employe/login");
      return;
    }

    setEmployeName(savedName);

    fetch("/api/employe-last-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: savedName,
        employeeName: savedName,
        employeName: savedName,
      }),
    }).catch((error) => {
      console.error("Erreur mise a jour derniere connexion :", error);
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
        "Vous etes actuellement connecte au poste principal. Aucune nouvelle demande n'est necessaire."
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

      const response = await fetch("/api/status", {
        cache: "no-store",
      });

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
          `${last.action || last.nomSession || last.session || "Activite"} - ${
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
          "Vous etes actuellement connecte au poste principal. Aucune nouvelle demande n'est necessaire."
        );
        return;
      }

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

      if (currentEmployeeConnectedRef.current) {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setActiveRequestId(null);
        setLastDisplayedFinalId(null);
        setMessage(
          "Vous etes actuellement connecte au poste principal. Aucune nouvelle demande n'est necessaire."
        );
        return;
      }

      if (activeRequestId && requestId !== activeRequestId) {
        return;
      }

      if (isWaitingStatus(requestStatus)) {
        setActiveRequestId(requestId);
        setLastDisplayedFinalId(null);
        setRequestAuthorized(false);
        setRequestWaiting(true);
        setMessage(
          responseMessage ||
            "Demande envoyee a l'utilisateur actuellement connecte. En attente de sa reponse."
        );
        return;
      }

      if (isAuthorizedStatus(requestStatus)) {
        setActiveRequestId(requestId);
        setRequestWaiting(false);
        setRequestAuthorized(true);

        if (isLibreRef.current) {
          setMessage(
            responseMessage ||
              "Poste libre. Acces autorise. Vous pouvez vous connecter par RDP."
          );
        } else {
          setMessage(
            "Acces autorise, mais le poste principal est encore occupe. Veuillez attendre la liberation complete de la session."
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
              "Demande refusee par l'utilisateur actuellement connecte."
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

        return;
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
        "Vous etes actuellement connecte au poste principal. Aucune nouvelle demande n'est necessaire."
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
              "Poste libre. Acces autorise. Vous pouvez vous connecter par RDP."
          );
        } else {
          setMessage(
            "Acces autorise, mais connexion RDP bloquee temporairement : le poste principal est encore occupe."
          );
        }
      } else if (waiting) {
        setRequestAuthorized(false);
        setRequestWaiting(true);
        setMessage(
          responseMessage ||
            "Demande envoyee a l'utilisateur actuellement connecte. En attente de sa reponse."
        );
      } else if (rejected) {
        setRequestAuthorized(false);
        setRequestWaiting(false);
        setMessage(responseMessage || "Demande refusee.");

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
            "Acces refuse : le poste principal est actuellement occupe."
        );
      }

      await loadAllData();
      await loadLastRequestResult(employeName);
    } catch (error) {
      console.error("Erreur demande acces :", error);
      setMessage("Erreur lors de l'envoi de la demande d'acces.");
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
        headers: {
          "Content-Type": "application/json",
        },
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
          "Demande annulee. Vous pouvez reformuler une nouvelle demande."
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
        "Vous etes actuellement connecte au poste principal. Aucune nouvelle connexion n'est necessaire."
      );
      return;
    }

    if (!requestAuthorized || !isLibreRef.current) {
      setMessage(
        isOccupeRef.current
          ? "Connexion RDP bloquee : le poste principal est encore occupe. Veuillez attendre la liberation complete de la session."
          : "Connexion RDP bloquee : aucune demande autorisee active."
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-950 text-lg font-black text-white shadow-lg">
              PC
            </div>

            <div>
              <p className="text-xl font-black text-slate-950">SRM-SM</p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Acces au poste principal
              </p>
            </div>
          </div>

          <div className="hidden text-center md:block">
            <p className="text-2xl font-black text-slate-950">
              Gestion d'acces RDP
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-2xl bg-slate-100 px-3 py-2 ring-1 ring-slate-200 md:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-black text-white">
                {getInitials(employeName)}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Espace employe
                </p>
                <p className="max-w-[190px] truncate text-sm font-black text-slate-900">
                  {employeName}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-2xl bg-blue-950 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-blue-900"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.75fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
              <div
                className={`h-1.5 ${
                  isLibre
                    ? "bg-emerald-500"
                    : isOccupe
                    ? "bg-red-500"
                    : "bg-slate-400"
                }`}
              />

              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-5">
                    <div
                      className={`flex h-24 w-24 items-center justify-center rounded-[1.75rem] text-4xl font-black ring-1 ${
                        isLibre
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : isOccupe
                          ? "bg-red-50 text-red-700 ring-red-200"
                          : "bg-slate-100 text-slate-500 ring-slate-200"
                      }`}
                    >
                      {isLibre ? "OK" : isOccupe ? "!" : "?"}
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        Etat du poste principal
                      </p>

                      <h1
                        className={`mt-2 text-4xl font-black ${
                          isLibre
                            ? "text-emerald-700"
                            : isOccupe
                            ? "text-red-700"
                            : "text-slate-700"
                        }`}
                      >
                        {isCurrentEmployeeConnected
                          ? "Session active"
                          : `Poste ${etat.toLowerCase()}`}
                      </h1>

                      <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-slate-500">
                        {isCurrentEmployeeConnected
                          ? "Vous etes actuellement connecte au poste principal."
                          : isLibre
                          ? "Le poste principal est disponible."
                          : isOccupe
                          ? "Le poste principal est actuellement occupe par une session RDP."
                          : "Statut en cours de synchronisation."}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Derniere verification
                    </p>
                    <p className="mt-2 font-black text-slate-800">
                      {loadingStatus ? "Chargement..." : dateVerification}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      Mise a jour automatique toutes les 5 secondes.
                    </p>
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
                    Demande d'acces
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Votre demande sera envoyee avec le nom :{" "}
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
                  placeholder="Expliquez brievement votre besoin si necessaire"
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
                    ? "Session deja active"
                    : requestWaiting || requestAuthorized
                    ? "Demande deja envoyee"
                    : "Demander l'acces"}
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
                Votre demande sera enregistree et visible par le responsable.
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
                    ? "Vous etes actuellement connecte au poste principal. Aucune nouvelle demande n'est necessaire."
                    : message}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
              <h3 className="text-2xl font-black text-slate-950">
                Etat du poste principal
              </h3>

              <div className="mt-6 space-y-4">
                <InfoRow label="Sessions actives" value={String(sessions)} />
                <InfoRow
                  label="Utilisateur actuel"
                  value={isLibre ? "Aucun" : currentUserText}
                />
                <InfoRow label="Derniere activite" value={lastActivityText} />
                <InfoRow label="Derniere verification" value={dateVerification} />
              </div>
            </section>

            <section className="rounded-[2rem] bg-blue-50 p-6 shadow-xl shadow-slate-200/70 ring-1 ring-blue-100">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-lg font-black text-white">
                  i
                </div>

                <div>
                  <h3 className="text-2xl font-black text-blue-950">
                    Acces exclusif
                  </h3>

                  <p className="mt-3 text-sm font-medium leading-7 text-blue-800">
                    Pour des raisons de securite et de performance, une seule
                    personne peut acceder au poste principal a la fois.
                  </p>

                  <p className="mt-3 text-sm font-medium leading-7 text-blue-800">
                    Si le poste est occupe, votre demande sera mise en attente et
                    l'utilisateur actif sera notifie.
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
                Connexion securisee via le protocole RDP
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