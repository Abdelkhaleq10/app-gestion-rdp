"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import AppTopBar from "../../../components/AppTopBar";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  MessageSquare,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 20;

type Demande = {
  id: number;
  Utilisateur?: string;
  utilisateur?: string;
  employee_name?: string;
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
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cleanText(value?: string) {
  return String(value || "").trim();
}

function getUserName(demande: Demande) {
  return (
    cleanText(demande.Utilisateur) ||
    cleanText(demande.utilisateur) ||
    cleanText(demande.employee_name) ||
    "N/A"
  );
}

function cleanIp(ip: string | undefined) {
  const value = String(ip || "").trim();

  if (!value) return "N/A";
  if (value === "::1") return "127.0.0.1";
  if (value.startsWith("::ffff:")) return value.replace("::ffff:", "");

  return value;
}

function statusLabel(status: string | undefined) {
  const value = normalize(status);

  if (value === "authorized" || value.includes("autor")) return "Autorisee";
  if (value === "rejected" || value.includes("refus")) return "Refusée";
  if (value.includes("cancel")) return "Annulee";
  if (value.includes("timeout")) return "Expirée";
  if (value === "waiting_release") return "Attente de libération";
  if (value === "waiting_current_user") return "Attente de réponse";
  if (value === "pending") return "En attente";

  return "En attente";
}

function statusBadgeClass(status: string | undefined) {
  const value = normalize(status);

  if (value === "authorized" || value.includes("autor")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (
    value === "rejected" ||
    value.includes("refus") ||
    value.includes("cancel") ||
    value.includes("timeout")
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (value === "waiting_release" || value === "waiting_current_user") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function priorityLabel(priority?: string, reason?: string) {
  const value = normalize(priority || reason);

  if (value === "urgent") return "Urgent";
  if (value === "consultation") return "Consultation";
  if (value === "verification") return "Vérification";
  if (value === "impression") return "Impression";
  if (value === "assistance") return "Assistance";
  if (value === "autre" || value === "other") return "Autre";

  return reason || "Normal";
}

function priorityBadgeClass(priority?: string, reason?: string) {
  const value = normalize(priority || reason);

  if (value === "urgent") return "bg-red-50 text-red-700 border-red-200";

  if (value === "verification") {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  if (value === "assistance") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (value === "consultation" || value === "impression") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function responseLabel(response?: string) {
  const value = normalize(response);

  if (value === "accepted") return "Acceptée";
  if (value === "rejected") return "Refusée";
  if (value === "timeout") return "Expirée";
  if (value === "no_active_session") return "Aucune session active";
  if (value === "error") return "Erreur notification";
  if (value === "cancelled_by_employee") return "Annulée par l'employé";
  if (value === "superseded") return "Remplacée par priorité";
  if (value === "refused_release") return "Refus de libération";

  return "Aucune réponse";
}

function responseText(demande: Demande) {
  const response = normalize(demande.current_user_response);
  const activeUserRaw = String(demande.active_user_name || "").trim();
  const responseMessage = String(demande.response_message || "").trim();

  const activeUserIsPlaceholder =
    !activeUserRaw ||
    normalize(activeUserRaw).includes("utilisateur actuellement") ||
    normalize(activeUserRaw).includes("utilisateur actif");

  const userName = activeUserIsPlaceholder ? "" : activeUserRaw;

  if (response === "accepted") {
    return userName
      ? `Accepte par ${userName}`
      : "Accepte par utilisateur actif non identifié";
  }

  if (response === "rejected" || response === "refused_release") {
    return userName
      ? `Refuse par ${userName}`
      : "Refus par utilisateur actif non identifié";
  }

  if (response === "timeout") {
    return "Expirée automatiquement";
  }

  if (response === "cancelled_by_employee") {
    return "Annulée par l'employé";
  }

  if (response === "superseded") {
    return "Remplacée par une demande plus prioritaire";
  }

  if (response === "no_active_session") {
    return "Aucune session active";
  }

  if (responseMessage) {
    return responseMessage;
  }

  return responseLabel(demande.current_user_response);
}

function cleanResponseMessage(message?: string) {
  const text = String(message || "").trim();

  if (!text) return "Aucune réponse détaillée.";

  if (normalize(text).includes("utilisateur actuellement connecté")) {
    return "La demande a été traitée par l'utilisateur actif.";
  }

  return text;
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

  if (!clean || clean === "N/A") return "NA";

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isAuthorized(status?: string) {
  const value = normalize(status);
  return value === "authorized" || value.includes("autor");
}

function isRejected(status?: string) {
  const value = normalize(status);

  return (
    value === "rejected" ||
    value.includes("refus") ||
    value.includes("cancel") ||
    value.includes("timeout")
  );
}

function isPending(status?: string) {
  const value = normalize(status);

  return (
    value === "pending" ||
    value === "waiting_current_user" ||
    value === "waiting_release" ||
    value.includes("attente")
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "orange";
}) {
  const styles = {
    blue: "border-blue-100 bg-white text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };

  return (
    <div className={`rounded-[1.6rem] border p-5 shadow-sm ${styles[color]}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-600">{title}</p>
          <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className="rounded-2xl border border-current/10 bg-white/80 p-3 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
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
    }, 30000);

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

  const autoriseCount = useMemo(() => {
    return demandes.filter((d) => isAuthorized(d.status)).length;
  }, [demandes]);

  const refuseCount = useMemo(() => {
    return demandes.filter((d) => isRejected(d.status)).length;
  }, [demandes]);

  const attenteCount = useMemo(() => {
    return demandes.filter((d) => isPending(d.status)).length;
  }, [demandes]);

  return (
    <ResponsableGuard>
      <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
        <AppTopBar />

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="space-y-7">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-700">
                    <ShieldCheck className="h-4 w-4" />
                    Demandes d&apos;accès
                  </div>

                  <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                    Tableau des demandes RDP
                  </h1>

                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
                    Suivi des demandes, des priorités, des messages et des
                    réponses de l&apos;utilisateur actif.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={exportUrl()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-700"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total demandes"
                value={total}
                icon={<Clock3 className="h-6 w-6" />}
                color="blue"
              />

              <StatCard
                title="Autorisées"
                value={autoriseCount}
                icon={<CheckCircle2 className="h-6 w-6" />}
                color="green"
              />

              <StatCard
                title="En attente"
                value={attenteCount}
                icon={<AlertTriangle className="h-6 w-6" />}
                color="orange"
              />

              <StatCard
                title="Refusées"
                value={refuseCount}
                icon={<XCircle className="h-6 w-6" />}
                color="red"
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-700" />
                <h2 className="text-xl font-black text-slate-950">
                  Filtres et recherche
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Recherche
                  </label>

                  <div className="flex gap-2">
                    <div className="relative w-full">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                        placeholder="Utilisateur, IP, motif, message..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <button
                      onClick={handleSearch}
                      className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800"
                    >
                      OK
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Statut
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Tous</option>
                    <option value="authorized">Autorisée</option>
                    <option value="waiting_current_user">Attente de réponse</option>
                    <option value="waiting_release">Attente de libération</option>
                    <option value="rejected">Refusée</option>
                    <option value="pending">En attente</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Tri
                  </label>

                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="recent">Plus récent</option>
                    <option value="oldest">Plus ancien</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
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
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={handleReset}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-700"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      Historique des demandes
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Total lignes : {total}
                    </p>
                  </div>

                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600">
                    Page {page} / {totalPages}
                    {refreshing ? " - Actualisation..." : ""}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center font-semibold text-slate-500">
                  Chargement des demandes...
                </div>
              ) : demandes.length === 0 ? (
                <div className="p-10 text-center font-semibold text-slate-500">
                  Aucune demande trouvée.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-5 py-4 text-left font-black">Ref</th>
                          <th className="px-5 py-4 text-left font-black">
                            Demandeur
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            IP / PC
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Date / heure
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Statut
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Priorité
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Motif / message
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Réponse
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {demandes.map((demande) => {
                          const user = getUserName(demande);
                          const message = String(demande.message || "").trim();
                          const responseMessage = cleanResponseMessage(
                            demande.response_message
                          );

                          return (
                            <tr
                              key={demande.id}
                              className="transition hover:bg-blue-50/40"
                            >
                              <td className="px-5 py-5 align-top">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                                  #{demande.id}
                                </span>
                              </td>

                              <td className="px-5 py-5 align-top">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-sm font-black text-white shadow-lg shadow-blue-950/10">
                                    {getInitials(user)}
                                  </div>

                                  <div>
                                    <p className="font-black text-slate-950">
                                      {user}
                                    </p>

                                    <p className="mt-1 text-xs font-semibold text-slate-400">
                                      Employé demandeur
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-5 align-top">
                                <p className="font-black text-slate-700">
                                  {cleanIp(demande.ip)}
                                </p>

                                <p className="mt-1 text-xs font-semibold text-slate-400">
                                  {demande.pc_name || "-"}
                                </p>
                              </td>

                              <td className="px-5 py-5 align-top font-semibold text-slate-600">
                                {formatDate(demande.request_time)}
                              </td>

                              <td className="px-5 py-5 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass(
                                    demande.status
                                  )}`}
                                >
                                  {statusLabel(demande.status)}
                                </span>
                              </td>

                              <td className="px-5 py-5 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${priorityBadgeClass(
                                    demande.priority,
                                    demande.reason
                                  )}`}
                                >
                                  {priorityLabel(
                                    demande.priority,
                                    demande.reason
                                  )}
                                  {demande.priority_level
                                    ? ` - P${demande.priority_level}`
                                    : ""}
                                </span>
                              </td>

                              <td className="max-w-[360px] px-5 py-5 align-top">
                                <div className="flex items-start gap-2">
                                  <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-slate-400" />

                                  <div>
                                    <p className="font-black text-slate-800">
                                      {demande.reason || "-"}
                                    </p>

                                    <p className="mt-1 whitespace-normal break-words text-sm leading-6 text-slate-500">
                                      {message || "Aucun message ajouté."}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="max-w-[430px] px-5 py-5 align-top">
                                <p className="whitespace-normal break-words font-black text-slate-900">
                                  {responseText(demande)}
                                </p>

                                <p className="mt-1 whitespace-normal break-words text-sm leading-6 text-slate-500">
                                  {responseMessage}
                                </p>

                                {demande.response_at ? (
                                  <p className="mt-2 text-xs font-bold text-slate-400">
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

                  <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-6 py-6">
                    <button
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={page === 1}
                      className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Precedent
                    </button>

                    <span className="rounded-2xl bg-blue-100 px-5 py-3 font-black text-blue-700">
                      {page}
                    </span>

                    <button
                      onClick={() =>
                        setPage((p) => Math.min(p + 1, totalPages))
                      }
                      disabled={page === totalPages}
                      className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </ResponsableGuard>
  );
}