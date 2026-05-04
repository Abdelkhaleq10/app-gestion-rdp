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

  function actionBadgeClass(action: string) {
    const value = action.toLowerCase();

    if (value.includes("autorisee") || value.includes("autorisée")) {
      return "bg-green-100 text-green-700";
    }

    if (value.includes("refusee") || value.includes("refusée")) {
      return "bg-red-100 text-red-700";
    }

    if (value === "connexion") {
      return "bg-green-100 text-green-700";
    }

    if (value === "deconnexion" || value === "déconnexion") {
      return "bg-red-100 text-red-700";
    }

    if (value === "reconnexion") {
      return "bg-blue-100 text-blue-700";
    }

    if (value === "session deconnectee" || value === "session déconnectée") {
      return "bg-gray-100 text-gray-700";
    }

    return "bg-gray-100 text-gray-700";
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

  return (
    <ResponsableGuard>
      <main className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-100 to-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-2">
                  SRM - SM | Interface responsable
                </p>

                <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
                  Historique RDP
                </h1>

                <p className="text-gray-600 mt-2">
                  Consultation, recherche, filtrage et export des connexions RDP.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={exportUrl()}
                  className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl"
                >
                  Export CSV
                </a>

                <a
                  href="/responsable/logout"
                  className="inline-flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl"
                >
                  Logout
                </a>
              </div>
            </div>

            <ResponsableNav />

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 md:p-5 mt-8 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Recherche
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Utilisateur, IP, session, action..."
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      onClick={handleSearch}
                      className="rounded-xl bg-blue-600 text-white font-semibold px-4 py-3 hover:bg-blue-700"
                    >
                      Rechercher
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Action
                  </label>

                  <select
                    value={actionFilter}
                    onChange={(e) => {
                      setActionFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Toutes</option>
                    <option value="Connexion">Connexion</option>
                    <option value="Deconnexion">Déconnexion</option>
                    <option value="Reconnexion">Reconnexion</option>
                    <option value="Session deconnectee">Session déconnectée</option>
                    <option value="Demande autorisee">Demande autorisée</option>
                    <option value="Demande refusee">Demande refusée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Type IP
                  </label>

                  <select
                    value={typeIpFilter}
                    onChange={(e) => {
                      setTypeIpFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous</option>
                    <option value="Distante">Distante</option>
                    <option value="Locale">Locale</option>
                    <option value="Inconnue">Inconnue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tri
                  </label>

                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="recent">Plus recent</option>
                    <option value="oldest">Plus ancien</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[250px_auto] gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date
                  </label>

                  <input
                    type="text"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Exemple : 00/00/0000"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleReset}
                    className="rounded-xl bg-slate-800 text-white font-semibold px-5 py-3 hover:bg-slate-700"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-8 overflow-x-auto shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-700 font-medium">
                  Total des lignes : {total}
                </p>

                <p className="text-gray-700 font-medium">
                  Page {page} / {totalPages}
                </p>
              </div>

              {loading ? (
                <p className="text-gray-500">Chargement...</p>
              ) : history.length === 0 ? (
                <p className="text-gray-500">Aucun historique RDP trouvée.</p>
              ) : (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-700 bg-slate-50">
                        <th className="py-3 px-3">N°</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Heure</th>
                        <th className="py-3 px-3">Utilisateur</th>
                        <th className="py-3 px-3">NomSession</th>
                        <th className="py-3 px-3">IP</th>
                        <th className="py-3 px-3">TypeIP</th>
                        <th className="py-3 px-3">Action</th>
                        <th className="py-3 px-3">Ref DB</th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((item, index) => (
                        <tr
                          key={`${item.id}-${item.date}-${item.heure}-${index}`}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {displayNumber(index)}
                          </td>
                          <td className="py-3 px-3">{item.date || "-"}</td>
                          <td className="py-3 px-3">{item.heure || "-"}</td>
                          <td className="py-3 px-3">
                            {item.utilisateur || "-"}
                          </td>
                          <td className="py-3 px-3">
                            {item.nomSession || "-"}
                          </td>
                          <td className="py-3 px-3">{item.ip || "-"}</td>
                          <td className="py-3 px-3">{item.typeIP || "-"}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${actionBadgeClass(
                                item.action || ""
                              )}`}
                            >
                              {item.action || "-"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-500">
                            {item.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50"
                    >
                      Precedent
                    </button>

                    <span className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                      {page}
                    </span>

                    <button
                      onClick={() =>
                        setPage((p) => Math.min(p + 1, totalPages))
                      }
                      disabled={page === totalPages}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </ResponsableGuard>
  );
}