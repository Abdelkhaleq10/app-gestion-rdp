"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  MonitorCheck,
  MonitorX,
  Network,
  Users,
} from "lucide-react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";
import {
  ExportButton,
  PageShell,
  PageTitle,
  Panel,
  PrimaryLink,
  StatCard,
} from "../../../components/AppChrome";

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
};

type HistoryItem = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  nomSession: string;
  ip: string;
  action: string;
};

type HistoryResponse = {
  items?: HistoryItem[];
  data?: HistoryItem[];
  history?: HistoryItem[];
  events?: HistoryItem[];
  rows?: HistoryItem[];
};

function normalizeStatus(value?: string) {
  const status = String(value || "Inconnu").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (status.includes("libre")) return "Libre";
  if (status.includes("occupe") || status.includes("occupe")) return "Occupe";
  return "Inconnu";
}

function statusBadgeClass(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value.includes("autorise") || value.includes("autoris")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (value.includes("refuse") || value.includes("refus")) return "bg-red-50 text-red-700 border-red-100";
  return "bg-amber-50 text-amber-700 border-amber-100";
}

function statusLabel(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value.includes("autorise") || value.includes("autoris")) return "Autorisee";
  if (value.includes("refuse") || value.includes("refus")) return "Refusee";
  return status || "En attente";
}

function actionTone(action?: string) {
  const value = String(action || "").toLowerCase();
  if (value.includes("deconnexion") || value.includes("deconnectee") || value.includes("refusee")) {
    return "bg-red-50 text-red-700 border-red-100";
  }
  if (value.includes("reconnexion")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (value.includes("connexion") || value.includes("autorisee")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function initials(name: string) {
  return String(name || "NA").trim().slice(0, 2).toUpperCase();
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
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ResponsableGuard>
      <PageShell>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={isLibre ? MonitorCheck : isOccupe ? MonitorX : Activity}
            label="Etat du poste"
            value={etat}
            detail={`Derniere verification : ${dashboard?.date_verification || "..."}`}
            tone={isLibre ? "green" : isOccupe ? "red" : "slate"}
          />
          <StatCard
            icon={Users}
            label="Sessions actives"
            value={dashboard?.nombre_sessions_actives ?? 0}
            detail="Utilisateurs connectes au poste principal"
            tone="blue"
          />
          <StatCard
            icon={ClipboardList}
            label="Demandes d'acces"
            value={dashboard?.total_access_requests ?? 0}
            detail="Total des demandes enregistrees"
            tone="amber"
          />
          <StatCard
            icon={Network}
            label="Evenements RDP"
            value={dashboard?.total_rdp_events ?? 0}
            detail="Connexions, reconnexions et deconnexions"
            tone="slate"
          />
        </div>

        <ResponsableNav />

        <PageTitle
          title="Tableau de bord"
          subtitle="Vue claire de l'etat du poste, des dernieres demandes et de l'activite RDP recente."
          action={<ExportButton href="/api/export-history" />}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-black text-slate-900">Demandes recentes</h3>
              <PrimaryLink href="/responsable/demandes">Voir toutes</PrimaryLink>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left">Utilisateur</th>
                    <th className="px-5 py-3 text-left">IP</th>
                    <th className="px-5 py-3 text-left">Date / heure</th>
                    <th className="px-5 py-3 text-left">Motif</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-slate-500">
                        Aucune demande recente.
                      </td>
                    </tr>
                  ) : (
                    requests.map((item) => {
                      const user = item.Utilisateur || item.utilisateur || "N/A";
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-700 text-xs font-black text-white">
                                {initials(user)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{user}</p>
                                <p className="text-xs text-slate-400">Employe</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-700">{item.ip || "N/A"}</td>
                          <td className="px-5 py-4 text-slate-700">{item.request_time || "-"}</td>
                          <td className="px-5 py-4 text-slate-700">{item.reason || "-"}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${statusBadgeClass(item.status)}`}>
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
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-black text-slate-900">Activite recente</h3>
              <PrimaryLink href="/responsable/historique">Voir tout</PrimaryLink>
            </div>
            <div className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">Aucun evenement recent.</div>
              ) : (
                history.map((item) => (
                  <div key={`${item.id}-${item.date}-${item.heure}`} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className={`flex size-9 items-center justify-center rounded-lg border ${actionTone(item.action)}`}>
                          <CheckCircle2 className="size-4" />
                        </span>
                        <div>
                          <p className="font-black text-slate-900">{item.action || item.nomSession || "Evenement"}</p>
                          <p className="text-sm text-slate-500">{item.utilisateur || "N/A"}</p>
                          <p className="mt-1 text-xs text-slate-400">{item.ip || "N/A"}</p>
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
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel className="p-5">
            <h3 className="text-lg font-black text-slate-900">Resume operationnel</h3>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-700">Poste principal</p>
                <p className="mt-2 text-2xl font-black text-emerald-800">{etat}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-700">Sessions actives</p>
                <p className="mt-2 text-2xl font-black text-blue-800">{dashboard?.nombre_sessions_actives ?? 0}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-700">Total historique</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {(dashboard?.total_rdp_events ?? 0) + (dashboard?.total_access_requests ?? 0)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="border-blue-100 bg-blue-50 p-5">
            <h3 className="text-lg font-black text-blue-950">Supervision RDP</h3>
            <p className="mt-3 text-sm leading-6 text-blue-900/80">
              Le responsable peut suivre etat du poste principal, consulter les demandes,
              analyser historique RDP et exporter les donnees pour la tracabilite.
            </p>
          </Panel>
        </div>

        {loading && <p className="text-center text-sm text-slate-400">Actualisation des donnees...</p>}
      </PageShell>
    </ResponsableGuard>
  );
}
