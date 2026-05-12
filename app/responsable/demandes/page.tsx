"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

const PAGE_SIZE = 20;

type Demande = {
  id: number;
  Utilisateur?: string;
  utilisateur?: string;
  ip: string;
  request_time: string;
  status: string;
  reason: string;
};

type RequestsResponse = {
  items?: Demande[];
  data?: Demande[];
  requests?: Demande[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function getUserName(demande: Demande) {
  return demande.Utilisateur || demande.utilisateur || "N/A";
}

function statusBadgeClass(status: string) {
  const value = String(status || "").toLowerCase();

  if (value.includes("autorise") || value.includes("autoris")) {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (value.includes("refuse") || value.includes("refus")) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-orange-100 text-orange-700 border-orange-200";
}

function statusLabel(status: string) {
  const value = String(status || "").toLowerCase();

  if (value.includes("autorise") || value.includes("autoris")) {
    return "Autorisee";
  }

  if (value.includes("refuse") || value.includes("refus")) {
    return "Refusee";
  }

  return status || "En attente";
}

function getInitials(name: string) {
  const clean = String(name || "").trim();

  if (!clean || clean === "N/A") {
    return "NA";
  }

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

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
        pageSize: String(PAGE_SIZE),
        search,
        status: statusFilter,
        date: dateFilter,
        sort,
      });

      const res = await fetch(`/api/requests?${params.toString()}`, {
        cache: "no-store",
      });

      const data: RequestsResponse = await res.json();

      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.requests)
        ? data.requests
        : [];

      setDemandes(items);
      setPage(data.page || currentPage || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || items.length || 0);
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

  function exportUrl() {
    const params = new URLSearchParams({
      search,
      status: statusFilter,
      date: dateFilter,
      sort,
    });

    return `/api/export-requests?${params.toString()}`;
  }

  const autoriseCount = demandes.filter((d) =>
    String(d.status || "").toLowerCase().includes("autor")
  ).length;

  const refuseCount = demandes.filter((d) =>
    String(d.status || "").toLowerCase().includes("refus")
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Total des demandes
              </p>
              <p className="text-4xl font-black text-blue-700 mt-2">{total}</p>
              <p className="text-sm text-slate-400 mt-3">
                Toutes les demandes enregistrées
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Autorisées sur cette page
              </p>
              <p className="text-4xl font-black text-green-700 mt-2">
                {autoriseCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Demandes acceptées affichées
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Refusées sur cette page
              </p>
              <p className="text-4xl font-black text-red-700 mt-2">
                {refuseCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Demandes refusées affichées
              </p>
            </div>
          </div>

          <ResponsableNav />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-800">
                Demandes d'accès
              </h2>
              <p className="text-slate-500 mt-1">
                Suivi, recherche, filtrage et export des demandes envoyées par
                les employés.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

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
                    placeholder="Utilisateur, IP, raison..."
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
                  Statut
                </label>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Tous</option>
                  <option value="autorise">Autorise</option>
                  <option value="refuse">Refuse</option>
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
                  <option value="recent">Plus récent</option>
                  <option value="oldest">Plus ancien</option>
                </select>
              </div>

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
                  placeholder="Ex : 00/00/0000"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleReset}
                className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black px-5 py-3"
              >
                réinitialiser les filtres
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  Historique des demandes
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
            ) : demandes.length === 0 ? (
              <div className="px-6 py-10 text-slate-500">
                Aucune demande trouvée.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-6 py-4">Ref</th>
                        <th className="text-left px-6 py-4">Utilisateur</th>
                        <th className="text-left px-6 py-4">IP</th>
                        <th className="text-left px-6 py-4">Date / heure</th>
                        <th className="text-left px-6 py-4">Statut</th>
                        <th className="text-left px-6 py-4">Raison</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {demandes.map((demande) => {
                        const user = getUserName(demande);

                        return (
                          <tr key={demande.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-slate-500 font-semibold">
                              #{demande.id}
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">
                                  {getInitials(user)}
                                </div>

                                <div>
                                  <p className="font-black text-slate-800">
                                    {user}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Employé
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-slate-700 font-semibold">
                              {demande.ip || "N/A"}
                            </td>

                            <td className="px-6 py-4 text-slate-700">
                              {demande.request_time || "-"}
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center border px-3 py-1 rounded-full text-xs font-black ${statusBadgeClass(
                                  demande.status || ""
                                )}`}
                              >
                                {statusLabel(demande.status || "")}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-slate-700">
                              {demande.reason || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-center gap-3 px-6 py-6 border-t border-slate-100">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="px-5 py-3 rounded-2xl bg-slate-800 text-white font-black disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Précédent
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