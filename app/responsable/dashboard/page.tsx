"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

type DashboardData = {
  etat_poste?: string;
  nombre_sessions_actives?: number;
  date_verification?: string;
  total_rdp_events?: number;
  total_access_requests?: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  async function loadDashboard() {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Erreur dashboard :", error);
    }
  }

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const isOccupe = data?.etat_poste === "Occupe";

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
                  Dashboard responsable
                </h1>
                <p className="text-gray-600 mt-2">
                  Supervision globale du poste principal et des acces.
                </p>
              </div>

              <a
                href="/responsable/logout"
                className="inline-flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl"
              >
                Logout
              </a>
            </div>

            <ResponsableNav />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-800 mb-4">
                  Etat du poste
                </h2>

                <div
                  className={`inline-flex px-4 py-2 rounded-full font-semibold ${
                    isOccupe
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {data?.etat_poste || "Inconnu"}
                </div>

                <p className="mt-4 text-gray-600">
                  Derniere verification : {data?.date_verification || "-"}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-800 mb-4">
                  Sessions actives
                </h2>
                <p className="text-4xl font-bold text-blue-600">
                  {data?.nombre_sessions_actives ?? 0}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-800 mb-4">
                  Total des evenements RDP
                </h2>
                <p className="text-4xl font-bold text-slate-800">
                  {data?.total_rdp_events ?? 0}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-800 mb-4">
                  Total des demandes d'acces
                </h2>
                <p className="text-4xl font-bold text-slate-800">
                  {data?.total_access_requests ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ResponsableGuard>
  );
}