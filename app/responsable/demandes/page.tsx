"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";
import {
  PageShell,
  PageTitle,
  Panel,
  StatCard,
} from "../../../components/AppChrome";

const PAGE_SIZE = 20;

type Demande = {
  id: number;
  Utilisateur?: string;
  utilisateur?: string;
  ip?: string;
  pc_name?: string | null;
  request_time?: string;
  status?: string;
  reason?: string;
  priority?: string;
  priority_level?: number;
  message?: string;
  current_user_response?: string;
  response_message?: string;
  response_at?: string;
};

type RequestsResponse = {
  items?: Demande[];
  data?: Demande[];
  requests?: Demande[];
  total?: number;
  page?: number;
  totalPages?: number;
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

function getStatusLabel(status: string | undefined) {
  const value = normalize(status);

  if (value === "authorized" || value === "autorise" || value === "autorisee") {
    return "Autorisee";
  }

  if (value === "rejected" || value === "refuse" || value === "refusee") {
    return "Refusee";
  }

  if (value === "waiting_current_user") {
    return "En attente de reponse";
  }

  if (value === "pending") {
    return "En attente";
  }

  return "En attente";
}

function getStatusClass(status: string | undefined) {
  const value = normalize(status);

  if (value === "authorized" || value === "autorise" || value === "autorisee") {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (value === "rejected" || value === "refuse" || value === "refusee") {
    return "border-red-100 bg-red-50 text-red-700";
  }

  if (value === "waiting_current_user" || value === "pending") {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  return "border-slate-100 bg-slate-50 text-slate-700";
}

function getPriorityLabel(priority: string | undefined, reason?: string) {
  const value = normalize(priority || reason);

  if (value === "urgent") return "Urgent";
  if (value === "assistance") return "Assistance";
  if (value === "verification") return "Verification";
  if (value === "consultation") return "Consultation";
  if (value === "impression") return "Impression";
  if (value === "autre" || value === "other") return "Autre";

  return reason || "Normal";
}

function getPriorityClass(priority: string | undefined, reason?: string) {
  const value = normalize(priority || reason);

  if (value === "urgent") {
    return "border-red-100 bg-red-50 text-red-700";
  }

  if (value === "assistance") {
    return "border-orange-100 bg-orange-50 text-orange-700";
  }

  if (value === "verification") {
    return "border-violet-100 bg-violet-50 text-violet-700";
  }

  if (value === "consultation") {
    return "border-blue-100 bg-blue-50 text-blue-700";
  }

  return "border-slate-100 bg-slate-50 text-slate-700";
}

function getResponseLabel(response: string | undefined) {
  const value = normalize(response);

  if (value === "accepted") return "Acceptee";
  if (value === "rejected") return "Refusee";
  if (value === "timeout") return "Expiree";
  if (value === "no_active_session") return "Aucune session active";
  if (value === "error") return "Erreur";

  return "-";
}

function getInitials(name: string) {
  const clean = String(name || "").trim();

  if (!clean || clean === "N/A") return "NA";

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

  async function synchroniserReponses() {
    try {
      await fetch("/api/sync-request-responses", { cache: "no-store" });
    } catch (error) {
      console.error("Erreur synchronisation reponses :", error);
    }
  }

  async function loadDemandes(currentPage: number, showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      await synchroniserReponses();

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        search,
        status: statusFilter,
        date: dateFilter,
        sort,
      });

      const response = await fetch(`/api/requests?${params.toString()}`, {
        cache: "no-store",
      });

      const data: RequestsResponse = await response.json();

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

  const autoriseCount = demandes.filter((demande) => {
    const value = normalize(demande.status);
    return value === "authorized" || value.includes("autor");
  }).length;

  const refuseCount = demandes.filter((demande) => {
    const value = normalize(demande.status);
    return value === "rejected" || value.includes("refus");
  }).length;

  const attenteCount = demandes.filter((demande) => {
    const value = normalize(demande.status);
    return value === "waiting_current_user" || value === "pending";
  }).length;

  return (
    <ResponsableGuard>
      <PageShell>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            icon={ClipboardList}
            label="Total des demandes"
            value={total}
            detail="Toutes les demandes enregistrees"
            tone="blue"
          />

          <StatCard
            icon={Clock3}
            label="En attente"
            value={attenteCount}
            detail="Demandes affichees sur cette page"
            tone="yellow"
          />

          <StatCard
            icon={CheckCircle2}
            label="Autorisees"
            value={autoriseCount}
            detail="Demandes autorisees sur cette page"
            tone="green"
          />

          <StatCard
            icon={XCircle}
            label="Refusees"
            value={refuseCount}
            detail="Demandes refusees sur cette page"
            tone="red"
          />
        </div>

        <ResponsableNav />

        <PageTitle
          title="Demandes d'acces"
          subtitle="Suivi des demandes envoyees par les employes."
          action={
            <a
              href={exportUrl()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
            >
              <Download className="size-4" />
              Export CSV
            </a>
          }
        />

        <Panel className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Recherche
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Utilisateur, IP, motif..."
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />

                <button
                  onClick={handleSearch}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800"
                >
                  <Search className="size-4" />
                  Rechercher
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Statut
              </label>

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Tous</option>
                <option value="authorized">Autorisee</option>
                <option value="waiting_current_user">En attente</option>
                <option value="rejected">Refusee</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Tri
              </label>

              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              >
                <option value="recent">Plus recent</option>
                <option value="oldest">Plus ancien</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Date
              </label>

              <input
                type="text"
                value={dateFilter}
                onChange={(event) => {
                  setDateFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Ex : 12/05/2026"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700"
            >
              <RefreshCcw className="size-4" />
              Reinitialiser
            </button>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Liste des demandes
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Total des lignes : {total}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-bold text-slate-500">
                Page {page} / {totalPages}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {refreshing ? "Actualisation..." : "A jour"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-slate-500">Chargement...</div>
          ) : demandes.length === 0 ? (
            <div className="px-5 py-10 text-slate-500">
              Aucune demande trouvee.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 text-left">Ref</th>
                      <th className="px-5 py-3 text-left">Employe</th>
                      <th className="px-5 py-3 text-left">Adresse IP</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Statut</th>
                      <th className="px-5 py-3 text-left">Priorite</th>
                      <th className="px-5 py-3 text-left">Motif</th>
                      <th className="px-5 py-3 text-left">Reponse</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {demandes.map((demande) => {
                      const user = getUserName(demande);
                      const message = String(demande.message || "").trim();
                      const responseMessage = String(
                        demande.response_message || ""
                      ).trim();

                      return (
                        <tr key={demande.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-semibold text-slate-500">
                            #{demande.id}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-700 text-xs font-black text-white">
                                {getInitials(user)}
                              </div>

                              <div>
                                <p className="font-black text-slate-900">
                                  {user}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Employe
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-700">
                            <div>{cleanIp(demande.ip)}</div>
                            {demande.pc_name ? (
                              <div className="mt-1 text-xs font-normal text-slate-400">
                                {demande.pc_name}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {formatDate(demande.request_time)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${getStatusClass(
                                demande.status
                              )}`}
                            >
                              {getStatusLabel(demande.status)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${getPriorityClass(
                                demande.priority,
                                demande.reason
                              )}`}
                            >
                              {getPriorityLabel(demande.priority, demande.reason)}
                            </span>
                          </td>

                          <td className="min-w-[220px] px-5 py-4 text-slate-700">
                            <p className="font-semibold">
                              {demande.reason || "-"}
                            </p>

                            {message ? (
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {message}
                              </p>
                            ) : null}
                          </td>

                          <td className="min-w-[220px] px-5 py-4 text-slate-700">
                            <p className="font-bold">
                              {getResponseLabel(demande.current_user_response)}
                            </p>

                            {responseMessage ? (
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {responseMessage}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-slate-400">
                                Aucune reponse
                              </p>
                            )}

                            {demande.response_at ? (
                              <p className="mt-1 text-xs text-slate-400">
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

              <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-5 py-5">
                <button
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={page === 1}
                  className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Precedent
                </button>

                <span className="rounded-lg bg-blue-100 px-4 py-2.5 text-sm font-black text-blue-700">
                  {page}
                </span>

                <button
                  onClick={() =>
                    setPage((current) => Math.min(current + 1, totalPages))
                  }
                  disabled={page === totalPages}
                  className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </>
          )}
        </Panel>
      </PageShell>
    </ResponsableGuard>
  );
}