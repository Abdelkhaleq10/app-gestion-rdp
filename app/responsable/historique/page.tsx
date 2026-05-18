"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsableNav from "@/components/ResponsableNav";

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
  success: boolean;
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

function getItems(data: HistoryResponse): HistoryItem[] {
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.history)) return data.history;

  return [];
}

function getActionStyle(action: string) {
  const value = String(action || "").toLowerCase();

  if (value.includes("reconnexion")) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (value.includes("connexion")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (value.includes("deconnect")) {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  if (value.includes("autorisee") || value.includes("autorise")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (value.includes("refuse")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
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

export default function HistoriqueRdpPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [action, setAction] = useState("");
  const [typeIP, setTypeIP] = useState("");

  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState("");
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", "recent");

    if (search.trim()) params.set("search", search.trim());
    if (date.trim()) params.set("date", date.trim());
    if (action.trim()) params.set("action", action.trim());
    if (typeIP.trim()) params.set("typeIP", typeIP.trim());

    return params.toString();
  }, [page, pageSize, search, date, action, typeIP]);

  async function loadHistory(showLoader = false) {
    try {
      if (showLoader) setLoading(true);
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
      setLastRefresh(new Date().toLocaleTimeString("fr-FR"));

      if (!response.ok || data.success === false) {
        setError(data.message || "Erreur lors du chargement de l'historique.");
      }
    } catch (err) {
      console.error("Erreur historique :", err);
      setError("Erreur lors du chargement de l'historique.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory(true);

    const interval = setInterval(() => {
      loadHistory(false);
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function resetFilters() {
    setSearch("");
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResponsableNav active="historique" />

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Responsable
              </p>

              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Historique RDP
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                Journal complet des connexions, reconnexions et deconnexions RDP.
                Mise a jour automatique toutes les 2 secondes.
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 px-5 py-4 ring-1 ring-blue-100">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
                Derniere actualisation
              </p>
              <p className="mt-1 text-lg font-black text-blue-900">
                {lastRefresh || "Chargement..."}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Recherche
              </label>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Utilisateur, IP, action..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
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
                placeholder="Ex : 15/05/2026"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Toutes</option>
                <option value="connexion">Connexion</option>
                <option value="reconnexion">Reconnexion</option>
                <option value="deconnectee">Session deconnectee</option>
                <option value="autorisee">Demande autorisee</option>
                <option value="refusee">Demande refusee</option>
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Tous</option>
                <option value="Distante">Distante</option>
                <option value="Locale">Locale</option>
              </select>
            </div>

            <button
              onClick={resetFilters}
              className="rounded-2xl bg-slate-900 px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 lg:mt-7"
            >
              Reinitialiser
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Journal complet
              </h2>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Total des lignes :{" "}
                <span className="font-black text-slate-800">{total}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {loading && (
                <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                  Actualisation...
                </span>
              )}

              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700">
                Page {page} / {totalPages}
              </span>
            </div>
          </div>

          {error && (
            <div className="m-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-sm font-black text-slate-700">
                  <th className="px-6 py-5">N°</th>
                  <th className="px-6 py-5">Date</th>
                  <th className="px-6 py-5">Heure</th>
                  <th className="px-6 py-5">Utilisateur</th>
                  <th className="px-6 py-5">Session</th>
                  <th className="px-6 py-5">IP</th>
                  <th className="px-6 py-5">Type IP</th>
                  <th className="px-6 py-5">Action</th>
                  <th className="px-6 py-5">Ref DB</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-sm font-bold text-slate-400"
                    >
                      Aucune ligne trouvee.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={`${item.id}-${item.date}-${item.heure}-${item.refDb}`}
                      className="border-t border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-5 text-sm font-black text-slate-800">
                        {item.id}
                      </td>

                      <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                        {item.date}
                      </td>

                      <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                        {item.heure}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-sm font-black text-white">
                            {getInitials(item.utilisateur)}
                          </div>

                          <div>
                            <p className="font-black text-slate-950">
                              {item.utilisateur}
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Utilisateur
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                        {item.session || item.nomSession || "-"}
                      </td>

                      <td className="px-6 py-5 text-sm font-black text-slate-800">
                        {item.ip}
                      </td>

                      <td className="px-6 py-5">
                        <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                          {item.typeIP}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-4 py-2 text-xs font-black ring-1 ${getActionStyle(
                            item.action
                          )}`}
                        >
                          {item.action}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm font-black text-slate-400">
                        {item.refDb}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-semibold text-slate-500">
              Mise a jour automatique active. Les nouveaux evenements apparaissent
              sans recharger la page.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={previousPage}
                disabled={page <= 1}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Precedent
              </button>

              <button
                onClick={nextPage}
                disabled={page >= totalPages}
                className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}