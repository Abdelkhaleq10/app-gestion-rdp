"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

type DashboardData = {
  etat_poste?: string;
  nombre_sessions_actives?: number;
  date_verification?: string;
  total_rdp_events?: number;
  total_access_requests?: number;
};

type RequestItem = {
  id: number;
  Utilisateur?: string;
  utilisateur?: string;
  ip?: string;
  pc_name?: string;
  request_time?: string;
  status?: string;
  reason?: string;
  priority?: string;
  priority_level?: number;
  message?: string;
  active_user_name?: string;
  current_user_response?: string;
  response_message?: string;
  response_at?: string;
};

type RequestsResponse = {
  items?: RequestItem[];
  data?: RequestItem[];
  requests?: RequestItem[];
  total?: number;
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

type HistoryResponse = {
  items?: HistoryItem[];
  data?: HistoryItem[];
  history?: HistoryItem[];
  events?: HistoryItem[];
  rows?: HistoryItem[];
  total?: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizePosteStatus(value?: string) {
  const status = normalize(value || "Inconnu");

  if (status.includes("libre")) return "Libre";
  if (status.includes("occupe")) return "Occupe";

  return "Inconnu";
}

function getRequestUser(item: RequestItem) {
  return item.Utilisateur || item.utilisateur || "N/A";
}

function cleanIp(ip?: string) {
  const value = String(ip || "").trim();

  if (!value) return "N/A";
  if (value === "::1") return "127.0.0.1";
  if (value.startsWith("::ffff:")) return value.replace("::ffff:", "");

  return value;
}

function formatDate(value?: string) {
  if (!value) return "-";

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return value;
}

function statusBadgeClass(status?: string) {
  const value = normalize(status);

  if (value === "authorized" || value.includes("autor")) {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (value === "rejected" || value.includes("refus")) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (value === "waiting_release") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  if (value === "waiting_current_user" || value === "pending") {
    return "bg-orange-100 text-orange-700 border-orange-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusLabel(status?: string) {
  const value = normalize(status);

  if (value === "authorized" || value.includes("autor")) return "Autorisee";
  if (value === "rejected" || value.includes("refus")) return "Refusee";
  if (value === "waiting_current_user") return "En attente de reponse";
  if (value === "waiting_release") return "En attente de liberation";
  if (value === "pending") return "En attente";

  return "En attente";
}

function responseLabel(response?: string) {
  const value = normalize(response);

  if (value === "accepted") return "Acceptee";
  if (value === "rejected") return "Refusee";
  if (value === "timeout") return "Expiree";
  if (value === "no_active_session") return "Aucune session active";
  if (value === "error") return "Erreur notification";

  return "Aucune reponse";
}

function priorityLabel(priority?: string, reason?: string) {
  const value = normalize(priority || reason);

  if (value === "urgent") return "Urgent";
  if (value === "consultation") return "Consultation";
  if (value === "verification") return "Verification";
  if (value === "impression") return "Impression";
  if (value === "assistance") return "Assistance";
  if (value === "autre" || value === "other") return "Autre";

  return reason || "Normal";
}

function getInitials(name: string) {
  const clean = String(name || "").trim();

  if (!clean || clean === "N/A") return "NA";

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function actionBadgeClass(action?: string) {
  const value = normalize(action);

  if (value.includes("reconnexion")) {
    return "bg-blue-100 text-blue-700";
  }

  if (value.includes("connexion") && !value.includes("deconnexion")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("deconnexion") || value.includes("deconnectee")) {
    return "bg-red-100 text-red-700";
  }

  if (value.includes("autorisee")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("refusee")) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function isAuthorized(status?: string) {
  const value = normalize(status);
  return value === "authorized" || value.includes("autor");
}

function isRejected(status?: string) {
  const value = normalize(status);
  return value === "rejected" || value.includes("refus");
}

function isWaitingResponse(status?: string) {
  return normalize(status) === "waiting_current_user";
}

function isWaitingRelease(status?: string) {
  return normalize(status) === "waiting_release";
}

function isPending(status?: string) {
  return normalize(status) === "pending";
}

export default function ResponsableDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const etat = normalizePosteStatus(dashboard?.etat_poste);
  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";

  const authorizedCount = requests.filter((item) =>
    isAuthorized(item.status)
  ).length;

  const rejectedCount = requests.filter((item) => isRejected(item.status)).length;

  const waitingResponseCount = requests.filter((item) =>
    isWaitingResponse(item.status)
  ).length;

  const waitingReleaseCount = requests.filter((item) =>
    isWaitingRelease(item.status)
  ).length;

  const pendingCount = requests.filter((item) => isPending(item.status)).length;

  const urgentRequest = requests.find(
    (item) =>
      normalize(item.priority) === "urgent" ||
      normalize(item.reason) === "urgent"
  );

  const lastResponseRequest = requests.find((item) =>
    String(item.response_message || "").trim()
  );

  const currentActiveUser =
    requests.find((item) => String(item.active_user_name || "").trim())
      ?.active_user_name || "Aucun";

  async function syncBackend() {
    await fetch("/api/sync-request-responses", {
      cache: "no-store",
    }).catch(() => null);

    await fetch("/api/sync-release", {
      cache: "no-store",
    }).catch(() => null);
  }

  async function loadDashboard(showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      await syncBackend();

      const [dashboardRes, requestsRes, historyRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/requests?page=1&pageSize=20&sort=recent", {
          cache: "no-store",
        }),
        fetch("/api/history?page=1&pageSize=5&sort=recent", {
          cache: "no-store",
        }),
      ]);

      const dashboardJson: DashboardData = await dashboardRes.json();
      const requestsJson: RequestsResponse = await requestsRes.json();
      const historyJson: HistoryResponse = await historyRes.json();

      const requestItems = Array.isArray(requestsJson.items)
        ? requestsJson.items
        : Array.isArray(requestsJson.data)
        ? requestsJson.data
        : Array.isArray(requestsJson.requests)
        ? requestsJson.requests
        : [];

      const historyItems = Array.isArray(historyJson.items)
        ? historyJson.items
        : Array.isArray(historyJson.data)
        ? historyJson.data
        : Array.isArray(historyJson.history)
        ? historyJson.history
        : Array.isArray(historyJson.events)
        ? historyJson.events
        : Array.isArray(historyJson.rows)
        ? historyJson.rows
        : [];

      setDashboard(dashboardJson);
      setRequests(requestItems);
      setHistory(historyItems.slice(0, 5));
      setTotalRequests(requestsJson.total || dashboardJson.total_access_requests || 0);
      setTotalHistory(historyJson.total || dashboardJson.total_rdp_events || 0);
    } catch (error) {
      console.error("Erreur chargement dashboard :", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard(true);

    const interval = setInterval(() => {
      loadDashboard(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ResponsableGuard>
      <main className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
        <header className="bg-blue-950 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center text-xl">
                PC
              </div>

              <div>
                <p className="font-bold text-lg">SRM-SM</p>
                <p className="text-xs text-blue-200">Interface responsable</p>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-xl md:text-2xl font-black">
                Gestion d'acces RDP
              </h1>
            </div>

            <div className="flex items-center justify-start md:justify-end gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-blue-700 items-center justify-center font-black">
                RM
              </div>

              <div className="text-left md:text-right">
                <p className="text-xs text-blue-200">Espace responsable</p>
                <p className="font-bold leading-tight">Responsable</p>
              </div>

              <a
                href="/responsable/logout"
                className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 font-semibold transition"
              >
                Deconnexion
              </a>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <div className="flex items-center gap-4">
                <div
                  className={`h-16 w-16 rounded-full flex items-center justify-center text-3xl font-black ${
                    isLibre
                      ? "bg-green-100 text-green-700"
                      : isOccupe
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isLibre ? "OK" : isOccupe ? "!" : "?"}
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Etat du poste principal
                  </p>
                  <p
                    className={`text-3xl font-black mt-1 ${
                      isLibre
                        ? "text-green-700"
                        : isOccupe
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {etat}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                Derniere verification :{" "}
                <span className="font-bold text-slate-700">
                  {dashboard?.date_verification || "..."}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Sessions actives
              </p>
              <p className="text-4xl font-black text-blue-700 mt-2">
                {dashboard?.nombre_sessions_actives ?? 0}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Utilisateur actif :{" "}
                <span className="font-bold text-slate-700">
                  {isLibre ? "Aucun" : currentActiveUser}
                </span>
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Demandes d'acces
              </p>
              <p className="text-4xl font-black text-orange-600 mt-2">
                {totalRequests}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Total des demandes enregistrees
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Evenements RDP
              </p>
              <p className="text-4xl font-black text-purple-700 mt-2">
                {totalHistory}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Connexions, reconnexions et deconnexions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-500">
                Autorisees
              </p>
              <p className="text-3xl font-black text-green-700 mt-2">
                {authorizedCount}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Sur les dernieres demandes affichees
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-500">
                Refusees
              </p>
              <p className="text-3xl font-black text-red-700 mt-2">
                {rejectedCount}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Reponse negative de l'utilisateur actif
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-500">
                En attente de reponse
              </p>
              <p className="text-3xl font-black text-orange-600 mt-2">
                {waitingResponseCount}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Notification envoyee a l'utilisateur actif
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-500">
                En attente de liberation
              </p>
              <p className="text-3xl font-black text-blue-700 mt-2">
                {waitingReleaseCount}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Acceptation recue, session non liberee
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-500">
                En attente
              </p>
              <p className="text-3xl font-black text-slate-700 mt-2">
                {pendingCount}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Demandes non finalisees
              </p>
            </div>
          </div>

          <ResponsableNav />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                Tableau de bord responsable
              </h2>
              <p className="text-slate-500 mt-1">
                Vue generale de l'etat du poste, des demandes prioritaires et
                de l'historique RDP.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/api/export-requests"
                className="rounded-2xl bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 font-black shadow-lg shadow-blue-100"
              >
                Export demandes
              </a>

              <a
                href="/api/export-history"
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 font-black shadow-lg shadow-emerald-100"
              >
                Export historique RDP
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1.1fr] gap-6">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    Demandes recentes
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Priorites, messages et reponses de l'utilisateur actif.
                  </p>
                </div>

                <a
                  href="/responsable/demandes"
                  className="text-blue-700 font-bold"
                >
                  Voir toutes
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-6 py-4">Demandeur</th>
                      <th className="text-left px-6 py-4">Motif</th>
                      <th className="text-left px-6 py-4">Statut</th>
                      <th className="text-left px-6 py-4">
                        Utilisateur actif / reponse
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {requests.slice(0, 6).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-slate-500">
                          Aucune demande recente.
                        </td>
                      </tr>
                    ) : (
                      requests.slice(0, 6).map((item) => {
                        const user = getRequestUser(item);
                        const msg = String(item.message || "").trim();
                        const activeUser = String(
                          item.active_user_name || ""
                        ).trim();
                        const responseMsg = String(
                          item.response_message || ""
                        ).trim();

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">
                                  {getInitials(user)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">
                                    {user}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {cleanIp(item.ip)} - {formatDate(item.request_time)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-slate-700 max-w-[260px]">
                              <p className="font-bold">
                                {priorityLabel(item.priority, item.reason)}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {item.reason || "-"}
                              </p>
                              {msg ? (
                                <p className="text-xs text-slate-600 mt-2 leading-5">
                                  Message : {msg}
                                </p>
                              ) : null}
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center border px-3 py-1 rounded-full text-xs font-black ${statusBadgeClass(
                                  item.status
                                )}`}
                              >
                                {statusLabel(item.status)}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-slate-700 max-w-[320px]">
                              <p className="font-bold">
                                {activeUser || "Aucun utilisateur actif"}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Reponse : {responseLabel(item.current_user_response)}
                              </p>
                              {responseMsg ? (
                                <p className="text-xs text-slate-600 mt-2 leading-5">
                                  {responseMsg}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-2">
                                  Aucune reponse enregistree
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    Historique RDP recent
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Derniers evenements detectes.
                  </p>
                </div>

                <a
                  href="/responsable/historique"
                  className="text-blue-700 font-bold"
                >
                  Voir tout
                </a>
              </div>

              <div className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <div className="px-6 py-8 text-slate-500">
                    Aucun evenement recent.
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={`${item.id}-${item.date}-${item.heure}`}
                      className="px-6 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`h-10 w-10 rounded-full flex items-center justify-center font-black ${actionBadgeClass(
                              item.action
                            )}`}
                          >
                            {normalize(item.action).includes("deconnexion") ||
                            normalize(item.action).includes("deconnectee")
                              ? "OFF"
                              : normalize(item.action).includes("reconnexion")
                              ? "RE"
                              : "ON"}
                          </span>

                          <div>
                            <p className="font-black text-slate-800">
                              {item.action || item.nomSession || "Evenement"}
                            </p>
                            <p className="text-sm text-slate-500">
                              {item.utilisateur || "N/A"}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {item.ip || "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right text-xs text-slate-500">
                          <p>{item.date}</p>
                          <p>{item.heure}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <h3 className="text-xl font-black text-slate-800 mb-6">
                Resume operationnel
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
                  <p className="text-sm text-blue-700 font-bold">
                    Derniere demande urgente
                  </p>
                  <p className="text-lg font-black text-blue-950 mt-2">
                    {urgentRequest ? getRequestUser(urgentRequest) : "Aucune"}
                  </p>
                  <p className="text-xs text-blue-900/70 mt-2">
                    {urgentRequest
                      ? urgentRequest.message || urgentRequest.reason || "Urgent"
                      : "Aucune demande urgente recente"}
                  </p>
                </div>

                <div className="rounded-2xl bg-green-50 border border-green-100 p-5">
                  <p className="text-sm text-green-700 font-bold">
                    Derniere reponse
                  </p>
                  <p className="text-lg font-black text-green-950 mt-2">
                    {lastResponseRequest
                      ? responseLabel(lastResponseRequest.current_user_response)
                      : "Aucune"}
                  </p>
                  <p className="text-xs text-green-900/70 mt-2">
                    {lastResponseRequest?.response_message ||
                      "Aucune reponse recente"}
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 border border-purple-100 p-5">
                  <p className="text-sm text-purple-700 font-bold">
                    Total suivi
                  </p>
                  <p className="text-2xl font-black text-purple-800 mt-2">
                    {totalHistory + totalRequests}
                  </p>
                  <p className="text-xs text-purple-900/70 mt-2">
                    Demandes et evenements RDP
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-3xl border border-blue-100 p-6">
              <h3 className="text-xl font-black text-blue-950">
                Supervision RDP
              </h3>
              <p className="text-blue-900/80 mt-3 leading-7">
                Le responsable suit l'etat du poste principal, les demandes
                prioritaires, les reponses de l'utilisateur actif et
                l'historique RDP pour garantir une tracabilite complete.
              </p>
              <p className="text-xs text-blue-900/60 mt-4">
                {refreshing ? "Actualisation en cours..." : "Donnees a jour"}
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-center text-sm text-slate-400">
              Chargement des donnees...
            </p>
          )}
        </section>
      </main>
    </ResponsableGuard>
  );
}