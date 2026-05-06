"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

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
  success?: boolean;
  items?: HistoryItem[];
  data?: HistoryItem[];
  history?: HistoryItem[];
  events?: HistoryItem[];
  rows?: HistoryItem[];
  total: number;
  page: number;
  pageSize?: number;
  limit?: number;
  totalPages: number;
};

function actionBadgeClass(action: string) {
  const value = String(action || "").toLowerCase();

  if (value.includes("autorisee") || value.includes("autorisée")) {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (value.includes("refusee") || value.includes("refusée")) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (value.includes("reconnexion")) {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  if (value.includes("deconnexion") || value.includes("déconnexion")) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (value.includes("session deconnectee") || value.includes("session déconnectée")) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  if (value.includes("connexion")) {
    return "bg-green-100 text-green-700 border-green-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function typeIpBadgeClass(typeIP: string) {
  const value = String(typeIP || "").toLowerCase();

  if (value.includes("distante")) {
    return "bg-blue-50 text-blue-700 border-blue-100";
  }

  if (value.includes("locale")) {
    return "bg-purple-50 text-purple-700 border-purple-100";
  }

  return "bg-slate-50 text-slate-600 border-slate-100";
}

function getInitials(name: string) {
  const clean = String(name || "").trim();

  if (!clean || clean === "N/A" || clean.includes("Acces direct")) {
    return "AD";
  }

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getActionIcon(action: string) {
  const value = String(action || "").toLowerCase();

  if (value.includes("reconnexion")) return "↻";
  if (value.includes("deconnexion") || value.includes("deconnectee")) return "⏻";
  if (value.includes("autorisee")) return "✓";
  if (value.includes("refusee")) return "!";
  if (value.includes("connexion")) return "→";

  return "•";
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

      const res = await fetch(`/api/history?${params.toString()}`, {
        cache: "no-store",
      });

      const data: HistoryResponse = await res.json();

      const items =
        Array.isArray(data.items)
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

    if (sort === "oldest") {
      return positionInAllResults + 1;
    }

    return total - positionInAllResults;
  }

  function exportUrl() {
    const params = new URLSearchParams({
      search,
      action: actionFilter,
      typeIP: typeIpFilter,
      date: dateFilter,
      sort,
    });

    return `/api/export-history?${params.toString()}`;
  }

  const connexionCount = history.filter((item) =>
    String(item.action || "").toLowerCase().includes("connexion")
  ).length;

  const deconnexionCount = history.filter((item) => {
    const value = String(item.action || "").toLowerCase();
    return value.includes("deconnexion") || value.includes("deconnectee");
  }).length;

  const demandeCount = history.filter((item) =>
    String(item.action || "").toLowerCase().includes("demande")
  ).length;

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
                Logout
              </a>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">Total historique</p>
              <p className="text-4xl font-black text-blue-700 mt-2">{total}</p>
              <p className="text-sm text-slate-400 mt-3">
                Evenements RDP + demandes
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Connexions/Reconnexions
              </p>
              <p className="text-4xl font-black text-green-700 mt-2">
                {connexionCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Affichees sur cette page
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">Deconnexions</p>
              <p className="text-4xl font-black text-red-700 mt-2">
                {deconnexionCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Affichees sur cette page
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">Demandes</p>
              <p className="text-4xl font-black text-purple-700 mt-2">
                {demandeCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Autorisees ou refusees
              </p>
            </div>
          </div>

          <ResponsableNav />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-800">
                Historique RDP
              </h2>
              <p className="text-slate-500 mt-1">
                Consultation, recherche, filtrage et export des connexions RDP
                et des demandes d'acces.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => loadHistory(page)}
                className="rounded-2xl bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 font-black shadow-lg shadow-blue-200"
              >
                ↻ Actualiser
              </button>

              <a
                href={exportUrl()}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 font-black shadow-lg shadow-emerald-100"
              >
                Export CSV
              </a>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Recherche
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Utilisateur, IP, session, action..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />

                  <button
                    onClick={handleSearch}
                    className="rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-black px-5 py-3"
                  >
                    Rechercher
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Action
                </label>

                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
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
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Type IP
                </label>

                <select
                  value={typeIpFilter}
                  onChange={(e) => {
                    setTypeIpFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Tous</option>
                  <option value="Distante">Distante</option>
                  <option value="Locale">Locale</option>
                  <option value="Inconnue">Inconnue</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Tri
                </label>

                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="recent">Plus recent</option>
                  <option value="oldest">Plus ancien</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[250px_auto] gap-4 mt-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Date
                </label>

                <input
                  type="text"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ex : 06/05/2026"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleReset}
                  className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black px-5 py-3"
                >
                  Reinitialiser les filtres
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  Journal complet
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Total des lignes : {total}
                </p>
              </div>

              <p className="text-sm text-slate-500 font-bold">
                Page {page} / {totalPages}
              </p>
            </div>

            {loading ? (
              <div className="px-6 py-10 text-slate-500">Chargement...</div>
            ) : history.length === 0 ? (
              <div className="px-6 py-10 text-slate-500">
                Aucun historique RDP trouve.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-6 py-4">N°</th>
                        <th className="text-left px-6 py-4">Date</th>
                        <th className="text-left px-6 py-4">Heure</th>
                        <th className="text-left px-6 py-4">Utilisateur</th>
                        <th className="text-left px-6 py-4">Session</th>
                        <th className="text-left px-6 py-4">IP</th>
                        <th className="text-left px-6 py-4">Type IP</th>
                        <th className="text-left px-6 py-4">Action</th>
                        <th className="text-left px-6 py-4">Ref DB</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {history.map((item, index) => (
                        <tr
                          key={`${item.id}-${item.date}-${item.heure}-${index}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-6 py-4 font-black text-slate-700">
                            {displayNumber(index)}
                          </td>

                          <td className="px-6 py-4 text-slate-700">
                            {item.date || "-"}
                          </td>

                          <td className="px-6 py-4 text-slate-700">
                            {item.heure || "-"}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">
                                {getInitials(item.utilisateur || "N/A")}
                              </div>

                              <div>
                                <p className="font-black text-slate-800">
                                  {item.utilisateur || "-"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Utilisateur
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-slate-700">
                            {item.nomSession || "-"}
                          </td>

                          <td className="px-6 py-4 text-slate-700 font-semibold">
                            {item.ip || "-"}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex border px-3 py-1 rounded-full text-xs font-black ${typeIpBadgeClass(
                                item.typeIP || ""
                              )}`}
                            >
                              {item.typeIP || "-"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-2 border px-3 py-1 rounded-full text-xs font-black ${actionBadgeClass(
                                item.action || ""
                              )}`}
                            >
                              <span>{getActionIcon(item.action || "")}</span>
                              {item.action || "-"}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-slate-400 font-semibold">
                            #{item.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-center gap-3 px-6 py-6 border-t border-slate-100">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="px-5 py-3 rounded-2xl bg-slate-800 text-white font-black disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Precedent
                  </button>

                  <span className="px-5 py-3 rounded-2xl bg-blue-100 text-blue-700 font-black">
                    {page}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="px-5 py-3 rounded-2xl bg-slate-800 text-white font-black disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </ResponsableGuard>
  );
}