"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import AppTopBar from "../../../components/AppTopBar";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Lock,
  Monitor,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

type DashboardData = {
  etat_poste?: string;
  etatPoste?: string;
  nombre_sessions_actives?: number;
  nombreSessionsActives?: number;
  sessionsActives?: number;
  date_verification?: string;
  dateVerification?: string;
  total_rdp_events?: number;
  total_access_requests?: number;
  utilisateur_actif?: string;
  utilisateurActif?: string;
  active_user?: string;
  activeUser?: string;
  current_user?: string;
  currentUser?: string;
};

type RequestItem = {
  id: number;
  Utilisateur?: string;
  utilisateur?: string;
  employee_name?: string;
  status?: string;
  active_user_name?: string;
};

type RequestsResponse = {
  items?: RequestItem[];
  data?: RequestItem[];
  requests?: RequestItem[];
  total?: number;
};

type HistoryItem = {
  id?: number;
  date?: string;
  heure?: string;
  utilisateur?: string;
  Utilisateur?: string;
  user?: string;
  nom?: string;
  fullName?: string;
  action?: string;
  ip?: string;
  machine?: string;
  session_active?: string | boolean;
};

type HistoryResponse = {
  items?: HistoryItem[];
  data?: HistoryItem[];
  history?: HistoryItem[];
  events?: HistoryItem[];
  total?: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizePosteStatus(value?: string) {
  const status = normalize(value || "Inconnu");

  if (status.includes("libre")) return "Libre";
  if (status.includes("occupe")) return "Occupe";

  return "Inconnu";
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
    value.includes("timeout") ||
    value.includes("cancel")
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

function cleanText(value?: string) {
  const text = String(value || "").trim();
  return text || "";
}

function getActiveUserFromDashboard(dashboard: DashboardData | null) {
  if (!dashboard) return "";

  return (
    cleanText(dashboard.utilisateur_actif) ||
    cleanText(dashboard.utilisateurActif) ||
    cleanText(dashboard.active_user) ||
    cleanText(dashboard.activeUser) ||
    cleanText(dashboard.current_user) ||
    cleanText(dashboard.currentUser)
  );
}

function isInvalidActiveUser(value?: string) {
  const text = normalize(value);

  if (!text) return true;
  if (text === "n/a") return true;
  if (text === "aucun") return true;
  if (text.includes("session rdp active")) return true;
  if (text.includes("utilisateur rdp actif")) return true;
  if (text.includes("utilisateur actuellement")) return true;
  if (text.includes("utilisateur actif non identifie")) return true;
  if (text.includes("non identifie")) return true;
  if (text.includes("acces direct")) return true;
  if (text.includes("autocad_user")) return true;
  if (text.includes("s.cotti")) return true;

  return false;
}

function isRdpConnectionAction(value?: string) {
  const action = normalize(value);

  return (
    action.includes("connexion rdp") ||
    action.includes("reconnexion rdp") ||
    action.includes("connexion") ||
    action.includes("reconnexion")
  );
}

function isRdpDisconnectAction(value?: string) {
  const action = normalize(value);

  return (
    action.includes("session deconnectee") ||
    action.includes("deconnexion") ||
    action.includes("deconnect")
  );
}

function getHistoryUser(item?: HistoryItem) {
  if (!item) return "";

  return (
    cleanText(item.utilisateur) ||
    cleanText(item.Utilisateur) ||
    cleanText(item.user) ||
    cleanText(item.nom) ||
    cleanText(item.fullName)
  );
}

function getActiveUserFromHistory(items: HistoryItem[], sessionsActives: number) {
  const normalizedItems = Array.isArray(items) ? items : [];

  // Important:
  // Kanqelbo 3la akher Connexion/Reconnexion RDP fih smiya s7i7a.
  // Ma kanwa9foch 3nd "Session deconnectee" hit sometimes kayji event deconnexion
  // qbel reconnexion f affichage / tri, w dashboard kayb9a fih sessionsActives = 1.
  for (const item of normalizedItems) {
    const action = item.action || "";
    const user = getHistoryUser(item);

    if (isRdpConnectionAction(action) && !isInvalidActiveUser(user)) {
      return user;
    }
  }

  // Ila makaynach smiya f history, mais session active kayna,
  // n'affichiw fallback wa9ti.
  return sessionsActives > 0 ? "Utilisateur RDP actif" : "Aucun";
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
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
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`rounded-[1.7rem] border p-6 shadow-sm transition hover:shadow-xl ${styles[color]}`}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-sm font-black text-slate-600">{title}</p>

          <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-current/10 bg-white/75 p-4 shadow-sm">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function SmallStatusCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "green" | "red" | "orange";
}) {
  const styles = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`rounded-[1.7rem] border p-6 shadow-sm ${styles[color]}`}
    >
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-white/80 p-3 shadow-sm">{icon}</div>

        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-4xl font-black">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ResponsableDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loading, setLoading] = useState(true);

  const etat = normalizePosteStatus(
    dashboard?.etat_poste || dashboard?.etatPoste
  );

  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";

  const sessionsActives =
    dashboard?.nombre_sessions_actives ??
    dashboard?.nombreSessionsActives ??
    dashboard?.sessionsActives ??
    0;

  const dateVerification =
    dashboard?.date_verification || dashboard?.dateVerification || "...";

  const authorizedRequests = requests.filter((item) =>
    isAuthorized(item.status)
  );

  const rejectedCount = requests.filter((item) => isRejected(item.status)).length;
  const pendingCount = requests.filter((item) => isPending(item.status)).length;

  const currentActiveUser = useMemo(() => {
    const fromHistory = getActiveUserFromHistory(history, sessionsActives);

    if (!isInvalidActiveUser(fromHistory)) {
      return fromHistory;
    }

    const fromDashboard = getActiveUserFromDashboard(dashboard);

    if (!isInvalidActiveUser(fromDashboard)) {
      return fromDashboard;
    }

    return sessionsActives > 0 ? "Utilisateur RDP actif" : "Aucun";
  }, [history, dashboard, sessionsActives]);

  async function loadDashboard(showLoader = false) {
    try {
      if (showLoader) setLoading(true);

      const [dashboardRes, requestsRes, historyRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/requests?page=1&pageSize=50&sort=recent", {
          cache: "no-store",
        }),
        fetch("/api/history?page=1&pageSize=20&sort=recent", {
          cache: "no-store",
        }),
      ]);

      const dashboardJson: DashboardData = await dashboardRes.json();
      const requestsJson: RequestsResponse = await requestsRes.json();
      const historyJson: HistoryResponse = await historyRes.json();

      const requestItems = Array.isArray(requestsJson.items)
        ? requestsJson.items
        : Array.isArray(requestsJson.data)
        ? requestsJson.data
        : Array.isArray(requestsJson.requests)
        ? requestsJson.requests
        : [];

      const historyItems = Array.isArray(historyJson.items)
        ? historyJson.items
        : Array.isArray(historyJson.data)
        ? historyJson.data
        : Array.isArray(historyJson.history)
        ? historyJson.history
        : Array.isArray(historyJson.events)
        ? historyJson.events
        : [];

      setDashboard(dashboardJson);
      setRequests(requestItems);
      setHistory(historyItems);

      setTotalRequests(
        requestsJson.total || dashboardJson.total_access_requests || 0
      );

      setTotalHistory(historyJson.total || dashboardJson.total_rdp_events || 0);
    } catch (error) {
      console.error("Erreur chargement dashboard :", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(true);

    const interval = setInterval(() => {
      loadDashboard(false);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ResponsableGuard>
      <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
        <AppTopBar />

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          {loading ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Chargement du tableau de bord...
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-7"
            >
              <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-700">
                  <Monitor className="h-4 w-4" />
                  Tableau de bord principal
                </div>

                <h2 className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                  Supervision du poste principal
                </h2>

                <p className="mt-3 text-base leading-7 text-slate-500">
                  Suivi rapide de l&apos;état du poste, des sessions actives et
                  des demandes d&apos;accès RDP.
                </p>
              </div>

              <div className="overflow-hidden rounded-[2.2rem] border border-red-200 bg-white shadow-[0_24px_70px_rgba(220,38,38,0.18)]">
                <div className="grid min-h-[320px] lg:grid-cols-[360px_1fr]">
                  <motion.div
                    animate={{
                      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className={`relative flex items-center justify-center overflow-hidden ${
                      isOccupe
                        ? "bg-[linear-gradient(135deg,#dc000b,#ff1f35,#b90009,#ff3347)] bg-[length:300%_300%]"
                        : isLibre
                        ? "bg-[linear-gradient(135deg,#059669,#10b981,#047857,#34d399)] bg-[length:300%_300%]"
                        : "bg-[linear-gradient(135deg,#1d4ed8,#2563eb,#1e3a8a,#3b82f6)] bg-[length:300%_300%]"
                    }`}
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.18, 1],
                        opacity: [0.35, 0.1, 0.35],
                      }}
                      transition={{ duration: 2.4, repeat: Infinity }}
                      className="absolute h-56 w-56 rounded-full border border-white/35"
                    />

                    <motion.div
                      animate={{
                        scale: [1.1, 1, 1.1],
                        opacity: [0.18, 0.42, 0.18],
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute h-36 w-36 rounded-full border border-white/40"
                    />

                    <motion.div
                      animate={{ y: [0, -7, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                      className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white/15 text-white shadow-2xl ring-1 ring-white/30 backdrop-blur-md"
                    >
                      {isOccupe ? (
                        <Lock className="h-12 w-12" />
                      ) : isLibre ? (
                        <CheckCircle2 className="h-12 w-12" />
                      ) : (
                        <Monitor className="h-12 w-12" />
                      )}
                    </motion.div>
                  </motion.div>

                  <div className="p-8 lg:p-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p
                          className={`text-xs font-black uppercase tracking-[0.25em] ${
                            isOccupe
                              ? "text-red-600"
                              : isLibre
                              ? "text-emerald-600"
                              : "text-blue-700"
                          }`}
                        >
                          État du poste
                        </p>

                        <h1
                          className={`mt-3 text-6xl font-black tracking-tight lg:text-7xl ${
                            isOccupe
                              ? "text-red-600"
                              : isLibre
                              ? "text-emerald-600"
                              : "text-blue-700"
                          }`}
                        >
                          {etat}
                        </h1>
                      </div>

                      <div
                        className={`rounded-full px-4 py-2 text-xs font-black ${
                          isOccupe
                            ? "bg-red-50 text-red-700"
                            : isLibre
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {isOccupe
                          ? "Session en cours"
                          : isLibre
                          ? "Disponible"
                          : "Non déterminé"}
                      </div>
                    </div>

                    <div className="mt-8 grid gap-5 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        <div className="flex items-center gap-2 text-red-500">
                          <UserCheck className="h-5 w-5" />
                          <p className="text-xs font-black uppercase tracking-wide">
                            Utilisateur actif
                          </p>
                        </div>

                        <p className="mt-3 text-lg font-black text-slate-950">
                          {isLibre ? "Aucun" : currentActiveUser}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        <div className="flex items-center gap-2 text-red-500">
                          <Clock3 className="h-5 w-5" />
                          <p className="text-xs font-black uppercase tracking-wide">
                            Vérification
                          </p>
                        </div>

                        <p className="mt-3 text-lg font-black text-slate-950">
                          {dateVerification}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        <div className="flex items-center gap-2 text-red-500">
                          <Monitor className="h-5 w-5" />
                          <p className="text-xs font-black uppercase tracking-wide">
                            Sessions actives
                          </p>
                        </div>

                        <p className="mt-3 text-lg font-black text-slate-950">
                          {sessionsActives}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <KpiCard
                  title="Sessions actives"
                  value={sessionsActives}
                  subtitle={`Utilisateur actif : ${
                    isLibre ? "Aucun" : currentActiveUser
                  }`}
                  icon={<UserCheck className="h-6 w-6" />}
                  color="blue"
                />

                <KpiCard
                  title="Total demandes"
                  value={totalRequests}
                  subtitle="Nombre total des demandes enregistrées."
                  icon={<Clock3 className="h-6 w-6" />}
                  color="orange"
                />

                <KpiCard
                  title="Événements RDP"
                  value={totalHistory}
                  subtitle="Connexions et déconnexions enregistrées."
                  icon={<Monitor className="h-6 w-6" />}
                  color="blue"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <SmallStatusCard
                  title="Demandes en attente"
                  value={pendingCount}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color="orange"
                />

                <SmallStatusCard
                  title="Demandes autorisées"
                  value={authorizedRequests.length}
                  icon={<ShieldCheck className="h-5 w-5" />}
                  color="green"
                />

                <SmallStatusCard
                  title="Demandes refusées"
                  value={rejectedCount}
                  icon={<XCircle className="h-5 w-5" />}
                  color="red"
                />
              </div>
            </motion.div>
          )}
        </section>
      </main>
    </ResponsableGuard>
  );
}




