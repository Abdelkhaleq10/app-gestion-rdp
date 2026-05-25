"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import AppTopBar from "../../../components/AppTopBar";

import {
  Activity,
  Clock3,
  Database,
  Download,
  Filter,
  History,
  Monitor,
  Search,
  ShieldCheck,
  UserRound,
  Wifi,
} from "lucide-react";

const PAGE_SIZE = 20;

type HistoryItem = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  session: string;
  nomSession?: string;
  ip: string;
  typeIP: string;
  action: string;
  refDb: string;
};

type HistoryResponse = {
  success?: boolean;
  items?: HistoryItem[];
  rows?: HistoryItem[];
  data?: HistoryItem[];
  history?: HistoryItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  generatedAt?: string;
  message?: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getItems(data: HistoryResponse): HistoryItem[] {
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.history)) return data.history;

  return [];
}

function getInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function cleanText(value?: string) {
  const text = String(value || "").trim();
  return text || "-";
}

function getActionLabel(action: string) {
  const value = normalize(action);

  if (value.includes("reconnexion")) return "Reconnexion RDP";
  if (value.includes("deconnect")) return "Session déconnectée";
  if (value.includes("connexion")) return "Connexion RDP";
  if (value.includes("autorisee") || value.includes("autorise")) {
    return "Demande autorisée";
  }
  if (value.includes("refuse")) return "Demande refusée";

  return action || "Evenement RDP";
}

function getActionStyle(action: string) {
  const value = normalize(action);

  if (value.includes("reconnexion")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value.includes("connexion")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value.includes("deconnect")) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (value.includes("autorisee") || value.includes("autorise")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value.includes("refuse")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getTypeIpStyle(typeIP: string) {
  const value = normalize(typeIP);

  if (value.includes("locale")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value.includes("distante")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isConnexion(action: string) {
  const value = normalize(action);
  return value.includes("connexion") && !value.includes("reconnexion");
}

function isReconnexion(action: string) {
  return normalize(action).includes("reconnexion");
}

function isDeconnexion(action: string) {
  return normalize(action).includes("deconnect");
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
  color: "blue" | "green" | "slate" | "orange";
}) {
  const styles = {
    blue: "border-blue-100 bg-white text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-white text-slate-700",
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

export default function HistoriqueRdpPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [date, setDate] = useState("");
  const [action, setAction] = useState("");
  const [typeIP, setTypeIP] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", "recent");

    if (search.trim()) params.set("search", search.trim());
    if (date.trim()) params.set("date", date.trim());
    if (action.trim()) params.set("action", action.trim());
    if (typeIP.trim()) params.set("typeIP", typeIP.trim());

    return params.toString();
  }, [page, search, date, action, typeIP]);

  async function loadHistory(showLoader = false) {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await fetch(`/api/history?${queryString}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });

      const data: HistoryResponse = await response.json();
      const nextItems = getItems(data);

      setItems(nextItems);
      setTotal(Number(data.total || nextItems.length || 0));
      setTotalPages(Number(data.totalPages || 1));

      if (!response.ok || data.success === false) {
        setError(data.message || "Erreur lors du chargement de l'historique.");
      }
    } catch (err) {
      console.error("Erreur historique :", err);
      setError("Erreur lors du chargement de l'historique.");
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadHistory(true);

    const interval = setInterval(() => {
      loadHistory(false);
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function handleSearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearch("");
    setSearchInput("");
    setDate("");
    setAction("");
    setTypeIP("");
    setPage(1);
  }

  function nextPage() {
    setPage((current) => Math.min(current + 1, totalPages));
  }

  function previousPage() {
    setPage((current) => Math.max(current - 1, 1));
  }

  function exportUrl() {
    const params = new URLSearchParams({
      search,
      date,
      action,
      typeIP,
      sort: "recent",
    });

    return `/api/export-history?${params.toString()}`;
  }

  const connexionCount = useMemo(() => {
    return items.filter((item) => isConnexion(item.action)).length;
  }, [items]);

  const reconnexionCount = useMemo(() => {
    return items.filter((item) => isReconnexion(item.action)).length;
  }, [items]);

  const deconnexionCount = useMemo(() => {
    return items.filter((item) => isDeconnexion(item.action)).length;
  }, [items]);

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
                    <History className="h-4 w-4" />
                    Historique RDP
                  </div>

                  <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                    Journal complet des accès RDP
                  </h1>

                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
                    Suivi des connexions, reconnexions, déconnexions et événements
                    liés aux demandes d&apos;accès au poste principal.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={exportUrl()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-700"
                  >
                    <Download className="h-4 w-4" />
                    Export historique
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total événements"
                value={total}
                icon={<Database className="h-6 w-6" />}
                color="blue"
              />

              <StatCard
                title="Connexions"
                value={connexionCount}
                icon={<ShieldCheck className="h-6 w-6" />}
                color="green"
              />

              <StatCard
                title="Reconnexions"
                value={reconnexionCount}
                icon={<Activity className="h-6 w-6" />}
                color="orange"
              />

              <StatCard
                title="Déconnexions"
                value={deconnexionCount}
                icon={<Clock3 className="h-6 w-6" />}
                color="slate"
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
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleSearch();
                        }}
                        placeholder="Utilisateur, IP, session, action..."
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
                    Date
                  </label>

                  <input
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Ex : 00/00/0000"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Action
                  </label>

                  <select
                    value={action}
                    onChange={(event) => {
                      setAction(event.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Toutes</option>
                    <option value="connexion">Connexion</option>
                    <option value="reconnexion">Reconnexion</option>
                    <option value="deconnectee">Session déconnectée</option>
                    <option value="autorisee">Demande autorisée</option>
                    <option value="refusee">Demande refusée</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Type IP
                  </label>

                  <select
                    value={typeIP}
                    onChange={(event) => {
                      setTypeIP(event.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Tous</option>
                    <option value="Distante">Distante</option>
                    <option value="Locale">Locale</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={resetFilters}
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
                      Journal des événements
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

              {error ? (
                <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="p-10 text-center font-semibold text-slate-500">
                  Chargement de l&apos;historique...
                </div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center font-semibold text-slate-500">
                  Aucune ligne trouvée.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-5 py-4 text-left font-black">N</th>
                          <th className="px-5 py-4 text-left font-black">
                            Date
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Heure
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Utilisateur
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Session
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Adresse IP
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Type IP
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Action
                          </th>
                          <th className="px-5 py-4 text-left font-black">
                            Ref DB
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                          <tr
                            key={`${item.id}-${item.date}-${item.heure}-${item.refDb}`}
                            className="transition hover:bg-blue-50/40"
                          >
                            <td className="px-5 py-5 align-top">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                                #{item.id}
                              </span>
                            </td>

                            <td className="px-5 py-5 align-top font-semibold text-slate-700">
                              {cleanText(item.date)}
                            </td>

                            <td className="px-5 py-5 align-top font-semibold text-slate-700">
                              {cleanText(item.heure)}
                            </td>

                            <td className="px-5 py-5 align-top">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-sm font-black text-white shadow-lg shadow-blue-950/10">
                                  {getInitials(item.utilisateur)}
                                </div>

                                <div>
                                  <p className="font-black text-slate-950">
                                    {cleanText(item.utilisateur)}
                                  </p>

                                  <p className="mt-1 text-xs font-semibold text-slate-400">
                                    Utilisateur RDP
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <div className="flex items-start gap-2">
                                <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                                <div>
                                  <p className="font-black text-slate-800">
                                    {cleanText(item.session || item.nomSession)}
                                  </p>

                                  {item.nomSession && item.nomSession !== item.session ? (
                                    <p className="mt-1 text-xs font-semibold text-slate-400">
                                      {item.nomSession}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <div className="flex items-center gap-2 font-black text-slate-800">
                                <Wifi className="h-4 w-4 text-slate-400" />
                                {cleanText(item.ip)}
                              </div>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTypeIpStyle(
                                  item.typeIP
                                )}`}
                              >
                                {cleanText(item.typeIP)}
                              </span>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getActionStyle(
                                  item.action
                                )}`}
                              >
                                {getActionLabel(item.action)}
                              </span>
                            </td>

                            <td className="px-5 py-5 align-top font-black text-slate-400">
                              {cleanText(item.refDb)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-6 py-6">
                    <button
                      onClick={previousPage}
                      disabled={page <= 1}
                      className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Précédent
                    </button>

                    <span className="rounded-2xl bg-blue-100 px-5 py-3 font-black text-blue-700">
                      {page}
                    </span>

                    <button
                      onClick={nextPage}
                      disabled={page >= totalPages}
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
