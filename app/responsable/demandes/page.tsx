"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

const PAGE_SIZE = 20;

type Demande = {
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
  success?: boolean;
  items?: Demande[];
  data?: Demande[];
  requests?: Demande[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getUserName(demande: Demande) {
  return demande.Utilisateur || demande.utilisateur || "N/A";
}

function cleanIp(ip: string | undefined) {
  const value = String(ip || "").trim();

  if (!value) return "N/A";
  if (value === "::1") return "127.0.0.1";
  if (value.startsWith("::ffff:")) return value.replace("::ffff:", "");

  return value;
}

function statusBadgeClass(status: string | undefined) {
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

function statusLabel(status: string | undefined) {
  const value = normalize(status);

  if (value === "authorized" || value.includes("autor")) {
    return "Autorisee";
  }

  if (value === "rejected" || value.includes("refus")) {
    return "Refusee";
  }

  if (value === "waiting_release") {
    return "En attente de liberation";
  }

  if (value === "waiting_current_user") {
    return "En attente de reponse";
  }

  if (value === "pending") {
    return "En attente";
  }

  return "En attente";
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

function responseLabel(response?: string) {
  const value = normalize(response);

  if (value === "accepted") return "Acceptee";
  if (value === "rejected") return "Refusee";
  if (value === "timeout") return "Expiree";
  if (value === "no_active_session") return "Aucune session active";
  if (value === "error") return "Erreur notification";

  return "Aucune reponse";
}

function formatDate(value: string | undefined) {
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
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState("recent");

  async function syncBackend() {
    await fetch("/api/sync-request-responses", {
      cache: "no-store",
    }).catch(() => null);

    await fetch("/api/sync-release", {
      cache: "no-store",
    }).catch(() => null);
  }

  async function loadDemandes(currentPage: number, showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      await syncBackend();

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
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDemandes(page, true);

    const interval = setInterval(() => {
      loadDemandes(page, false);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const autoriseCount = demandes.filter((d) => {
    const value = normalize(d.status);
    return value === "authorized" || value.includes("autor");
  }).length;

  const refuseCount = demandes.filter((d) => {
    const value = normalize(d.status);
    return value === "rejected" || value.includes("refus");
  }).length;

  const attenteCount = demandes.filter((d) => {
    const value = normalize(d.status);
    return (
      value === "waiting_current_user" ||
      value === "waiting_release" ||
      value === "pending"
    );
  }).length;

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
                Deconnexion
              </a>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Total des demandes
              </p>
              <p className="text-4xl font-black text-blue-700 mt-2">{total}</p>
              <p className="text-sm text-slate-400 mt-3">
                Toutes les demandes enregistrees
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Autorisees sur cette page
              </p>
              <p className="text-4xl font-black text-green-700 mt-2">
                {autoriseCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Demandes autorisees affichees
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                En attente sur cette page
              </p>
              <p className="text-4xl font-black text-orange-600 mt-2">
                {attenteCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Reponse ou liberation en attente
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <p className="text-sm font-bold text-slate-500">
                Refusees sur cette page
              </p>
              <p className="text-4xl font-black text-red-700 mt-2">
                {refuseCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Demandes refusees affichees
              </p>
            </div>
          </div>

          <ResponsableNav />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-800">
                Demandes d'acces
              </h2>
              <p className="text-slate-500 mt-1">
                Suivi des demandes, des priorites, des messages et des reponses
                de l'utilisateur actif.
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
                    placeholder="Utilisateur, IP, motif, message..."
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
                  <option value="authorized">Autorisee</option>
                  <option value="waiting_current_user">
                    En attente de reponse
                  </option>
                  <option value="waiting_release">
                    En attente de liberation
                  </option>
                  <option value="rejected">Refusee</option>
                  <option value="pending">En attente</option>
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
                  placeholder="Ex : 13/05/2026"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleReset}
                className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black px-5 py-3"
              >
                Reinitialiser les filtres
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

              <div className="text-right">
                <p className="text-sm text-slate-500 font-bold">
                  Page {page} / {totalPages}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {refreshing ? "Actualisation..." : "A jour"}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-10 text-slate-500">Chargement...</div>
            ) : demandes.length === 0 ? (
              <div className="px-6 py-10 text-slate-500">
                Aucune demande trouvee.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-6 py-4">Ref</th>
                        <th className="text-left px-6 py-4">Demandeur</th>
                        <th className="text-left px-6 py-4">IP / PC</th>
                        <th className="text-left px-6 py-4">Date / heure</th>
                        <th className="text-left px-6 py-4">Statut</th>
                        <th className="text-left px-6 py-4">Motif / message</th>
                        <th className="text-left px-6 py-4">
                          Utilisateur actif / reponse
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {demandes.map((demande) => {
                        const user = getUserName(demande);
                        const detailMessage = String(demande.message || "").trim();
                        const activeUser = String(
                          demande.active_user_name || ""
                        ).trim();
                        const responseMessage = String(
                          demande.response_message || ""
                        ).trim();

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
                                    Employe demandeur
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-slate-700 font-semibold">
                              <div>{cleanIp(demande.ip)}</div>
                              {demande.pc_name ? (
                                <div className="text-xs text-slate-400 mt-1 font-normal">
                                  {demande.pc_name}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-6 py-4 text-slate-700">
                              {formatDate(demande.request_time)}
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center border px-3 py-1 rounded-full text-xs font-black ${statusBadgeClass(
                                  demande.status
                                )}`}
                              >
                                {statusLabel(demande.status)}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-slate-700 max-w-[280px]">
                              <p className="font-bold">
                                {priorityLabel(demande.priority, demande.reason)}
                              </p>

                              <p className="text-xs text-slate-500 mt-1">
                                {demande.reason || "-"}
                              </p>

                              {detailMessage ? (
                                <p className="text-xs text-slate-600 mt-2 leading-5">
                                  Message : {detailMessage}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-2">
                                  Aucun message ajoute
                                </p>
                              )}
                            </td>

                            <td className="px-6 py-4 text-slate-700 max-w-[340px]">
                              <p className="font-bold">
                                {activeUser || "Aucun utilisateur actif"}
                              </p>

                              <p className="text-xs text-slate-500 mt-1">
                                Reponse :{" "}
                                {responseLabel(demande.current_user_response)}
                              </p>

                              {responseMessage ? (
                                <p className="text-xs text-slate-600 mt-2 leading-5">
                                  {responseMessage}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-2">
                                  Aucune reponse enregistree
                                </p>
                              )}

                              {demande.response_at ? (
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatDate(demande.response_at)}
                                </p>
                              ) : null}
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