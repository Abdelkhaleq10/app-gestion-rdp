"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

type Demande = {
  id: number;
  Utilisateur: string;
  ip: string;
  request_time: string;
  status: string;
  reason: string;
};

type RequestsResponse = {
  items: Demande[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function DemandesPage() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState("recent");

  async function loadDemandes(currentPage: number) {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: "20",
        search,
        status: statusFilter,
        date: dateFilter,
        sort,
      });

      const res = await fetch(`/api/requests?${params.toString()}`, {
        cache: "no-store",
      });

      const data: RequestsResponse = await res.json();

      setDemandes(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Erreur chargement demandes :", error);
      setDemandes([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDemandes(page);
    const interval = setInterval(() => {
      loadDemandes(page);
    }, 5000);

    return () => clearInterval(interval);
  }, [page, search, statusFilter, dateFilter, sort]);

  function handleSearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleReset() {
    setSearch("");
    setSearchInput("");
    setStatusFilter("");
    setDateFilter("");
    setSort("recent");
    setPage(1);
  }

  function statusBadgeClass(status: string) {
    const value = status.toLowerCase();

    if (value === "autorise") return "bg-green-100 text-green-700";
    if (value === "refuse") return "bg-red-100 text-red-700";

    return "bg-gray-100 text-gray-700";
  }

  function exportUrl() {
    const params = new URLSearchParams({
      search,
      status: statusFilter,
      date: dateFilter,
      sort,
    });

    return `/api/export-requests?${params.toString()}`;
  }

  return (
    <ResponsableGuard>
      <main className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-100 to-gray-200 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-2">
                  SRM - SM | Interface responsable
                </p>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
                  Historique des demandes d'acces
                </h1>
                <p className="text-gray-600 mt-2">
                  Suivi, recherche, filtrage et export des demandes envoyees par les employes.
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="xl:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Recherche
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Utilisateur, IP, raison..."
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
                    Statut
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous</option>
                    <option value="autorise">Autorise</option>
                    <option value="refuse">Refuse</option>
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
                    placeholder="Exemple : 24/04/2026"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleReset}
                    className="rounded-xl bg-slate-800 text-white font-semibold px-5 py-3 hover:bg-slate-700"
                  >
                    Reinitialiser les filtres
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
              ) : demandes.length === 0 ? (
                <p className="text-gray-500">Aucune demande trouvee.</p>
              ) : (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-700 bg-slate-50">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">Utilisateur</th>
                        <th className="py-3 px-3">IP</th>
                        <th className="py-3 px-3">Date / Heure</th>
                        <th className="py-3 px-3">Statut</th>
                        <th className="py-3 px-3">Raison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demandes.map((demande) => (
                        <tr key={demande.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-3">{demande.id}</td>
                          <td className="py-3 px-3">{demande.Utilisateur || "-"}</td>
                          <td className="py-3 px-3">{demande.ip || "-"}</td>
                          <td className="py-3 px-3">{demande.request_time || "-"}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadgeClass(
                                demande.status || ""
                              )}`}
                            >
                              {demande.status || "-"}
                            </span>
                          </td>
                          <td className="py-3 px-3">{demande.reason || "-"}</td>
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
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
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