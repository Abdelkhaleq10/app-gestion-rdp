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
  request_time?: string;
  status?: string;
  reason?: string;
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

function normalizeStatus(value?: string) {
  const status = String(value || "Inconnu").toLowerCase();

  if (status.includes("libre")) return "Libre";
  if (status.includes("occupe") || status.includes("occupé")) return "Occupe";

  return "Inconnu";
}

function statusBadgeClass(status?: string) {
  const value = String(status || "").toLowerCase();

  if (value.includes("autorise") || value.includes("autoris")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("refuse") || value.includes("refus")) {
    return "bg-red-100 text-red-700";
  }

  return "bg-orange-100 text-orange-700";
}

function statusLabel(status?: string) {
  const value = String(status || "").toLowerCase();

  if (value.includes("autorise") || value.includes("autoris")) return "Autorisée";
  if (value.includes("refuse") || value.includes("refus")) return "Refusée";

  return status || "En attente";
}

function actionBadgeClass(action?: string) {
  const value = String(action || "").toLowerCase();

  if (value.includes("connexion") && !value.includes("déconnexion")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("reconnexion")) {
    return "bg-blue-100 text-blue-700";
  }

  if (value.includes("déconnexion") || value.includes("déconnectée")) {
    return "bg-red-100 text-red-700";
  }

  if (value.includes("autorisée")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("refusée")) {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function ResponsableDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const etat = normalizeStatus(dashboard?.etat_poste);
  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";

  async function loadDashboard() {
    try {
      setLoading(true);

      const [dashboardRes, requestsRes, historyRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/requests?page=1&pageSize=5", { cache: "no-store" }),
        fetch("/api/history?page=1&pageSize=5", { cache: "no-store" }),
      ]);

      const dashboardJson: DashboardData = await dashboardRes.json();
      const requestsJson: RequestsResponse = await requestsRes.json();
      const historyJson: HistoryResponse = await historyRes.json();

      const requestItems =
        Array.isArray(requestsJson.items)
          ? requestsJson.items
          : Array.isArray(requestsJson.data)
          ? requestsJson.data
          : Array.isArray(requestsJson.requests)
          ? requestsJson.requests
          : [];

      const historyItems =
        Array.isArray(historyJson.items)
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
      setRequests(requestItems.slice(0, 5));
      setHistory(historyItems.slice(0, 5));
    } catch (error) {
      console.error("Erreur chargement dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
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
                🖥️
              </div>
              <div>
                <p className="font-bold text-lg">SRM-SM</p>
                <p className="text-xs text-blue-200">Interface responsable</p>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-xl md:text-2xl font-black">
                Gestion d'accès RDP
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
                Déconnexion
              </a>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <div className="flex items-center gap-4">
                <div
                  className={`h-16 w-16 rounded-full flex items-center justify-center text-3xl ${
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
                Dernière vérification :{" "}
                <span className="font-bold text-slate-700">
                  {dashboard?.date_verification || "..."}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-3xl">
                  👥
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Sessions actives
                  </p>
                  <p className="text-4xl font-black text-blue-700 mt-1">
                    {dashboard?.nombre_sessions_actives ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                Utilisateurs connectés
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-3xl">
                  📄
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Demandes d'accès
                  </p>
                  <p className="text-4xl font-black text-orange-600 mt-1">
                    {dashboard?.total_access_requests ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                Total des demandes enregistrées
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-3xl">
                  📈
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Événements RDP
                  </p>
                  <p className="text-4xl font-black text-purple-700 mt-1">
                    {dashboard?.total_rdp_events ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                Connexions, reconnexions et déconnexions
              </div>
            </div>
          </div>

          <ResponsableNav />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                Tableau de bord responsable
              </h2>
              <p className="text-slate-500 mt-1">
                Vue générale de l'état du poste, des demandes et de l'historique RDP.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
            
              <a
                href="/api/export-history"
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 font-black shadow-lg shadow-emerald-100"
              >
                Exporter CSV
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1.1fr] gap-6">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">
                  Demandes récentes
                </h3>
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
                      <th className="text-left px-6 py-4">Utilisateur</th>
                      <th className="text-left px-6 py-4">IP</th>
                      <th className="text-left px-6 py-4">Date / heure</th>
                      <th className="text-left px-6 py-4">Motif</th>
                      <th className="text-left px-6 py-4">Statut</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-slate-500">
                          Aucune demande récente.
                        </td>
                      </tr>
                    ) : (
                      requests.map((item) => {
                        const user = item.Utilisateur || item.utilisateur || "N/A";

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">
                                  {user.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">{user}</p>
                                  <p className="text-xs text-slate-400">Employe</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {item.ip || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {item.request_time || "-"}
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {item.reason || "-"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-black ${statusBadgeClass(
                                  item.status
                                )}`}
                              >
                                {statusLabel(item.status)}
                              </span>
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
                <h3 className="text-xl font-black text-slate-800">
                  Historique RDP récent
                </h3>
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
                    Aucun événement récent.
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={`${item.id}-${item.date}-${item.heure}`} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`h-10 w-10 rounded-full flex items-center justify-center font-black ${actionBadgeClass(
                              item.action
                            )}`}
                          >
                            {item.action?.toLowerCase().includes("deconnexion") ||
                            item.action?.toLowerCase().includes("deconnectee")
                              ? "⏻"
                              : item.action?.toLowerCase().includes("reconnexion")
                              ? "↻"
                              : "→"}
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
                Résumé opérationnel
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-green-50 border border-green-100 p-5">
                  <p className="text-sm text-green-700 font-bold">
                    Poste principal
                  </p>
                  <p className="text-2xl font-black text-green-800 mt-2">
                    {etat}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
                  <p className="text-sm text-blue-700 font-bold">
                    Sessions actives
                  </p>
                  <p className="text-2xl font-black text-blue-800 mt-2">
                    {dashboard?.nombre_sessions_actives ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 border border-purple-100 p-5">
                  <p className="text-sm text-purple-700 font-bold">
                    Total historique
                  </p>
                  <p className="text-2xl font-black text-purple-800 mt-2">
                    {(dashboard?.total_rdp_events ?? 0) +
                      (dashboard?.total_access_requests ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-3xl border border-blue-100 p-6">
              <h3 className="text-xl font-black text-blue-950">
                Supervision RDP
              </h3>
              <p className="text-blue-900/80 mt-3 leading-7">
                Le responsable peut suivre l'état du poste principal, consulter
                les demandes d'accès, analyser l'historique RDP et exporter les
                données pour la traçabilité.
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-center text-sm text-slate-400">
              Actualisation des données...
            </p>
          )}
        </section>
      </main>
    </ResponsableGuard>
  );
}