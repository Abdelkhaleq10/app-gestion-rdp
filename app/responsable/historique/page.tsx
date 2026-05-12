"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, History, RotateCcw, Search, Unplug, Users } from "lucide-react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";
import { ExportButton, PageShell, PageTitle, Panel, StatCard } from "../../../components/AppChrome";

const PAGE_SIZE = 20;

type HistoryItem = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  sessionId: string;
  nomSession: string;
  ip: string;
  typeIP: string;
  action: string;
  sessionActive: string;
};

type HistoryResponse = {
  items?: HistoryItem[];
  data?: HistoryItem[];
  history?: HistoryItem[];
  events?: HistoryItem[];
  rows?: HistoryItem[];
  total: number;
  page: number;
  totalPages: number;
};

function normalize(value: string) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function actionBadgeClass(action: string) {
  const value = normalize(action);
  if (value.includes("autorisee")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (value.includes("refusee")) return "bg-red-50 text-red-700 border-red-100";
  if (value.includes("reconnexion")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (value.includes("deconnexion") || value.includes("deconnectee")) return "bg-red-50 text-red-700 border-red-100";
  if (value.includes("connexion")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function typeIpBadgeClass(typeIP: string) {
  const value = normalize(typeIP);
  if (value.includes("distante")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (value.includes("locale")) return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-50 text-slate-600 border-slate-100";
}

function getInitials(name: string) {
  const clean = String(name || "").trim();
  if (!clean || clean === "N/A" || clean.includes("Acces direct")) return "AD";
  const parts = clean.split(" ").filter(Boolean);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function displayAction(action: string) {
  const value = normalize(action);
  if (value.includes("reconnexion")) return "Reconnexion";
  if (value.includes("deconnexion") || value.includes("deconnectee")) return "Deconnexion";
  if (value.includes("autorisee")) return "Demande autorisee";
  if (value.includes("refusee")) return "Demande refusee";
  if (value.includes("connexion")) return "Connexion";
  return action || "-";
}

export default function HistoriquePage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [typeIpFilter, setTypeIpFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState("recent");

  async function loadHistory(currentPage: number) {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        search,
        action: actionFilter,
        typeIP: typeIpFilter,
        date: dateFilter,
        sort,
      });
      const res = await fetch(`/api/history?${params.toString()}`, { cache: "no-store" });
      const data: HistoryResponse = await res.json();
      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.history)
        ? data.history
        : Array.isArray(data.events)
        ? data.events
        : Array.isArray(data.rows)
        ? data.rows
        : [];

      setHistory(items);
      setPage(data.page || currentPage || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || items.length || 0);
    } catch (error) {
      console.error("Erreur chargement historique :", error);
      setHistory([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, actionFilter, typeIpFilter, dateFilter, sort]);

  function handleSearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleReset() {
    setSearch("");
    setSearchInput("");
    setActionFilter("");
    setTypeIpFilter("");
    setDateFilter("");
    setSort("recent");
    setPage(1);
  }

  function displayNumber(index: number) {
    const positionInAllResults = (page - 1) * PAGE_SIZE + index;
    return sort === "oldest" ? positionInAllResults + 1 : total - positionInAllResults;
  }

  function exportUrl() {
    const params = new URLSearchParams({ search, action: actionFilter, typeIP: typeIpFilter, date: dateFilter, sort });
    return `/api/export-history?${params.toString()}`;
  }

  const connexionCount = history.filter((item) => normalize(item.action).includes("connexion")).length;
  const deconnexionCount = history.filter((item) => {
    const value = normalize(item.action);
    return value.includes("deconnexion") || value.includes("deconnectee");
  }).length;
  const demandeCount = history.filter((item) => normalize(item.action).includes("demande")).length;

  return (
    <ResponsableGuard>
      <PageShell>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={History} label="Total historique" value={total} detail="Evenements RDP + demandes" tone="blue" />
          <StatCard icon={CheckCircle2} label="Connexions" value={connexionCount} detail="Affichees sur cette page" tone="green" />
          <StatCard icon={Unplug} label="Deconnexions" value={deconnexionCount} detail="Affichees sur cette page" tone="red" />
          <StatCard icon={Users} label="Demandes" value={demandeCount} detail="Autorisees ou refusees" tone="slate" />
        </div>

        <ResponsableNav />

        <PageTitle
          title="Historique RDP"
          subtitle="Consultation, recherche, filtrage et export des connexions RDP et des demandes d'acces."
          action={<ExportButton href={exportUrl()} />}
        />

        <Panel className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">Recherche</label>
              <div className="flex gap-2">
                <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Utilisateur, IP, session, action..." className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                <button onClick={handleSearch} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800">
                  <Search className="size-4" />
                  Rechercher
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Action</label>
              <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                <option value="">Toutes</option>
                <option value="Connexion">Connexion</option>
                <option value="Deconnexion">Deconnexion</option>
                <option value="Reconnexion">Reconnexion</option>
                <option value="Session deconnectee">Session deconnectee</option>
                <option value="Demande autorisee">Demande autorisee</option>
                <option value="Demande refusee">Demande refusee</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Type IP</label>
              <select value={typeIpFilter} onChange={(e) => { setTypeIpFilter(e.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                <option value="">Tous</option>
                <option value="Distante">Distante</option>
                <option value="Locale">Locale</option>
                <option value="Inconnue">Inconnue</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Tri</label>
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                <option value="recent">Plus recent</option>
                <option value="oldest">Plus ancien</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[250px_auto]">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
              <input type="text" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} placeholder="Ex : 06/05/2026" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </div>
            <div className="flex items-end">
              <button onClick={handleReset} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700">
                <RotateCcw className="size-4" />
                Reinitialiser
              </button>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Journal complet</h3>
              <p className="mt-1 text-sm text-slate-500">Total des lignes : {total}</p>
            </div>
            <p className="text-sm font-bold text-slate-500">Page {page} / {totalPages}</p>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-slate-500">Chargement...</div>
          ) : history.length === 0 ? (
            <div className="px-5 py-10 text-slate-500">Aucun historique RDP trouve.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 text-left">N</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Heure</th>
                      <th className="px-5 py-3 text-left">Utilisateur</th>
                      <th className="px-5 py-3 text-left">Session</th>
                      <th className="px-5 py-3 text-left">IP</th>
                      <th className="px-5 py-3 text-left">Type IP</th>
                      <th className="px-5 py-3 text-left">Action</th>
                      <th className="px-5 py-3 text-left">Ref DB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item, index) => (
                      <tr key={`${item.id}-${item.date}-${item.heure}-${index}`} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-black text-slate-700">{displayNumber(index)}</td>
                        <td className="px-5 py-4 text-slate-700">{item.date || "-"}</td>
                        <td className="px-5 py-4 text-slate-700">{item.heure || "-"}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-700 text-xs font-black text-white">{getInitials(item.utilisateur || "N/A")}</div>
                            <div>
                              <p className="font-black text-slate-900">{item.utilisateur || "-"}</p>
                              <p className="text-xs text-slate-400">Utilisateur</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{item.nomSession || "-"}</td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{item.ip || "-"}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${typeIpBadgeClass(item.typeIP || "")}`}>{item.typeIP || "-"}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-black ${actionBadgeClass(item.action || "")}`}>
                            <Activity className="size-3.5" />
                            {displayAction(item.action || "")}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-400">#{item.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-5 py-5">
                <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1} className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Precedent</button>
                <span className="rounded-lg bg-blue-100 px-4 py-2.5 text-sm font-black text-blue-700">{page}</span>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Suivant</button>
              </div>
            </>
          )}
        </Panel>
      </PageShell>
    </ResponsableGuard>
  );
}
