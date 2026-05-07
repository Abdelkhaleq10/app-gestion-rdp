"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StatusData = {
  etat_poste?: string;
  etatPoste?: string;
  status?: string;
  nombre_sessions_actives?: number;
  nombreSessionsActives?: number;
  sessionsActives?: number;
  date_verification?: string;
  dateVerification?: string;
};

type RequestResult = {
  success?: boolean;
  authorized?: boolean;
  autorise?: boolean;
  message?: string;
  status?: string;
};

type HistoryItem = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  nomSession: string;
  ip: string;
  typeIP: string;
  action: string;
};

function getEtatLabel(status: StatusData | null) {
  const raw =
    status?.etat_poste ||
    status?.etatPoste ||
    status?.status ||
    "Inconnu";

  const value = String(raw).toLowerCase();

  if (value.includes("libre")) return "Libre";
  if (value.includes("occupe") || value.includes("occupé")) return "Occupe";

  return "Inconnu";
}

function getSessions(status: StatusData | null) {
  return (
    status?.nombre_sessions_actives ??
    status?.nombreSessionsActives ??
    status?.sessionsActives ??
    0
  );
}

function getDateVerification(status: StatusData | null) {
  return (
    status?.date_verification ||
    status?.dateVerification ||
    "Non disponible"
  );
}

function isValidUserName(value: string) {
  const user = String(value || "").trim().toLowerCase();

  if (!user) return false;
  if (user === "n/a") return false;
  if (user === "-") return false;
  if (user.includes("acces direct non identifie")) return false;
  if (user === "autocad_user") return false;

  return true;
}

function isActiveAction(action: string) {
  const value = String(action || "").toLowerCase();

  if (value.includes("demande autorisee")) return true;
  if (value.includes("reconnexion")) return true;
  if (value.includes("connexion") && !value.includes("deconnexion")) return true;

  return false;
}

export default function EmployePage() {
  const router = useRouter();

  const [employeName, setEmployeName] = useState("");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requestAuthorized, setRequestAuthorized] = useState(false);

  const [lastActivityText, setLastActivityText] = useState(
    "Aucune activite recente"
  );
  const [currentUserText, setCurrentUserText] = useState("Aucun");

  const etat = getEtatLabel(status);
  const sessions = getSessions(status);
  const dateVerification = getDateVerification(status);

  const isLibre = etat === "Libre";
  const isOccupe = etat === "Occupe";

  useEffect(() => {
    const savedName = localStorage.getItem("employe_nom");

    if (!savedName) {
      router.push("/employe/login");
      return;
    }

    setEmployeName(savedName);
    loadAllData();

    const interval = setInterval(() => {
      loadAllData();
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  async function loadAllData() {
    await loadStatus();
    await loadHistoryInfos();
    await loadCurrentRdpUser();
  }

  async function loadStatus() {
    try {
      setLoadingStatus(true);

      const response = await fetch("/api/status", {
        cache: "no-store",
      });

      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Erreur chargement statut:", error);
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadHistoryInfos() {
    try {
      const response = await fetch("/api/history?page=1&pageSize=20&sort=recent", {
        cache: "no-store",
      });

      const data = await response.json();

      const items: HistoryItem[] = Array.isArray(data.items)
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

      if (items.length > 0) {
        const last = items[0];

        setLastActivityText(
          `${last.action || last.nomSession || "Activite"} - ${
            last.date || "-"
          } ${last.heure || ""}`
        );
      } else {
        setLastActivityText("Aucune activite recente");
      }

      const authorizedItem = items.find((item) => {
        const action = String(item.action || "").toLowerCase();

        return (
          isValidUserName(item.utilisateur) &&
          action.includes("demande autorisee")
        );
      });

      const activeItem = items.find((item) => {
        const action = item.action || item.nomSession || "";
        return isValidUserName(item.utilisateur) && isActiveAction(action);
      });

      const selectedUser = authorizedItem || activeItem;

      if (selectedUser) {
        setCurrentUserText(selectedUser.utilisateur);
      } else if (sessions > 0) {
        setCurrentUserText("Session active");
      } else {
        setCurrentUserText("Aucun");
      }
    } catch (error) {
      console.error("Erreur chargement historique recent:", error);
      setLastActivityText("Non disponible");

      if (sessions > 0) {
        setCurrentUserText("Session active");
      } else {
        setCurrentUserText("Aucun");
      }
    }
  }

  async function loadCurrentRdpUser() {
    try {
      const response = await fetch("/api/current-rdp-user", {
        cache: "no-store",
      });

      const data = await response.json();

      const windowsUser = String(data?.utilisateur_actuel || "")
        .trim()
        .toLowerCase();

      /*
        autocad_user = compte Windows/RDP technique.
        On ne l'affiche pas comme employe actuel.
        L'utilisateur reel vient de l'historique des demandes autorisees.
      */
      if (
        data?.session_active &&
        data?.utilisateur_actuel &&
        windowsUser !== "autocad_user"
      ) {
        setCurrentUserText(data.utilisateur_actuel);
      }

      if (!data?.session_active && sessions === 0) {
        setCurrentUserText("Aucun");
      }
    } catch (error) {
      console.error("Erreur chargement utilisateur RDP actuel:", error);
    }
  }

  async function handleRequestAccess() {
    try {
      setRequestLoading(true);
      setMessage("");
      setRequestAuthorized(false);

      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utilisateur: employeName,
          nom: employeName,
          user: employeName,
        }),
      });

      const result: RequestResult = await response.json();

      const text = result.message || "";

      const authorized =
        result.authorized === true ||
        result.autorise === true ||
        String(result.status || "").toLowerCase().includes("autor") ||
        text.toLowerCase().includes("autor");

      setRequestAuthorized(authorized);

      if (text) {
        setMessage(text);
      } else if (authorized) {
        setMessage(
          "Acces autorise. Vous pouvez maintenant vous connecter au poste principal."
        );
      } else {
        setMessage("Acces refuse. Le poste principal est actuellement occupe.");
      }

      if (authorized) {
        setCurrentUserText(employeName);
      }

      await loadAllData();
    } catch (error) {
      console.error("Erreur demande acces:", error);
      setMessage("Erreur lors de l'envoi de la demande d'acces.");
      setRequestAuthorized(false);
    } finally {
      setRequestLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("employe_id");
    localStorage.removeItem("employe_nom");
    router.push("/employe/login");
  }

  function handleRdpConnect() {
    window.location.href = "/api/rdp-file";
  }

  const displayedCurrentUser = isLibre ? "Aucun" : currentUserText;

  if (!employeName) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <header className="bg-blue-950 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center text-xl">
              🖥️
            </div>

            <div>
              <p className="font-bold text-lg">SRM-SM</p>
              <p className="text-xs text-blue-200">Acces au poste principal</p>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-black">
              Gestion d&apos;acces RDP
            </h1>
          </div>

          <div className="flex items-center justify-start md:justify-end gap-3">
            <div className="hidden sm:flex h-10 w-10 rounded-full bg-blue-700 items-center justify-center font-black">
              EM
            </div>

            <div className="text-left md:text-right">
              <p className="text-xs text-blue-200">Espace employe</p>
              <p className="font-bold leading-tight">{employeName}</p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1.1fr] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 md:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div
                    className={`h-28 w-28 rounded-full flex items-center justify-center text-5xl ${
                      isLibre
                        ? "bg-green-100 text-green-700"
                        : isOccupe
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isLibre ? "✓" : isOccupe ? "!" : "?"}
                  </div>

                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400 font-bold">
                      Etat du poste principal
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <h2
                        className={`text-4xl font-black ${
                          isLibre
                            ? "text-green-700"
                            : isOccupe
                            ? "text-red-700"
                            : "text-slate-700"
                        }`}
                      >
                        Poste {etat.toLowerCase()}
                      </h2>

                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          isLibre
                            ? "bg-green-100 text-green-700"
                            : isOccupe
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isLibre
                          ? "Disponible"
                          : isOccupe
                          ? "Occupe"
                          : "Inconnu"}
                      </span>
                    </div>

                    <p className="text-slate-600 mt-3">
                      {isLibre
                        ? "Le poste principal est actuellement libre et pret a etre utilise."
                        : isOccupe
                        ? "Le poste principal est actuellement occupe par une session RDP."
                        : "Le statut du poste principal n'est pas encore disponible."}
                    </p>
                  </div>
                </div>

                <div className="lg:border-l border-slate-200 lg:pl-8 min-w-[230px]">
                  <p className="text-sm font-semibold text-slate-500">
                    Derniere verification
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isLibre
                          ? "bg-green-500"
                          : isOccupe
                          ? "bg-red-500"
                          : "bg-slate-400"
                      }`}
                    />

                    <p className="font-bold text-slate-800">
                      {loadingStatus ? "Chargement..." : dateVerification}
                    </p>
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    Mise a jour automatique chaque 5 secondes.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 md:p-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-blue-700 text-white flex items-center justify-center font-black text-xl">
                  👤
                </div>

                <div>
                  <h2 className="text-2xl font-black text-slate-800">
                    Demande d&apos;acces
                  </h2>

                  <p className="text-slate-600 mt-1">
                    Votre demande sera envoyee avec le nom :
                    <span className="font-black text-slate-900">
                      {" "}
                      {employeName}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400 font-bold">
                  Nom complet
                </p>
                <p className="text-slate-900 font-bold mt-1">{employeName}</p>
              </div>

              <button
                onClick={handleRequestAccess}
                disabled={requestLoading}
                className="mt-6 w-full rounded-2xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-black py-4 shadow-lg shadow-blue-200 transition"
              >
                🔒{" "}
                {requestLoading ? "Envoi de la demande..." : "Demander l'acces"}
              </button>

              <p className="text-center text-sm text-slate-500 mt-4">
                Votre demande sera enregistree et visible par le responsable.
              </p>

              {message && (
                <div
                  className={`mt-5 rounded-2xl border p-4 font-semibold ${
                    requestAuthorized
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {message}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
              <h3 className="text-xl font-black text-slate-800">
                Etat du poste principal
              </h3>

              <div className="mt-5 divide-y divide-slate-100">
                <div className="py-4 flex items-center justify-between gap-4">
                  <span className="text-slate-500">Sessions actives</span>
                  <span className="text-blue-700 font-black text-xl">
                    {sessions}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between gap-4">
                  <span className="text-slate-500">Utilisateur actuel</span>
                  <span className="font-bold text-slate-800 text-right">
                    {displayedCurrentUser}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between gap-4">
                  <span className="text-slate-500">Derniere activite</span>
                  <span className="font-bold text-slate-800 text-right">
                    {lastActivityText}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between gap-4">
                  <span className="text-slate-500">Derniere verification</span>
                  <span className="font-bold text-slate-800 text-right">
                    {loadingStatus ? "..." : dateVerification}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-3xl border border-blue-100 p-6">
              <div className="flex items-start gap-3">
                <span className="h-11 w-11 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">
                  i
                </span>

                <div>
                  <h3 className="text-xl font-black text-blue-950">
                    Acces exclusif
                  </h3>

                  <p className="text-blue-900/80 mt-3 leading-7">
                    Pour des raisons de securite et de performance, une seule
                    personne peut acceder au poste principal a la fois.
                  </p>

                  <p className="text-blue-900/80 mt-3 leading-7">
                    Veuillez attendre la liberation du poste ou reessayer plus
                    tard.
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-3xl shadow-lg border p-6 ${
                requestAuthorized
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-slate-100"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-16 w-16 rounded-full flex items-center justify-center text-3xl ${
                    requestAuthorized
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  🖥️
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    {requestAuthorized ? "Acces autorise" : "Connexion RDP"}
                  </h3>

                  <p className="text-slate-600 mt-2">
                    {requestAuthorized
                      ? "Vous pouvez maintenant vous connecter au poste principal."
                      : "Le bouton sera active apres une demande autorisee."}
                  </p>
                </div>
              </div>

              <button
                onClick={handleRdpConnect}
                disabled={!requestAuthorized}
                className={`mt-6 w-full rounded-2xl py-4 font-black transition ${
                  requestAuthorized
                    ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                🖥️ Se connecter par RDP
              </button>

              <p className="text-center text-sm text-slate-500 mt-4">
                Connexion securisee via le protocole RDP.
              </p>
            </div>
          </div>
        </div>

        <footer className="text-center text-sm text-slate-400 mt-8">
          © 2026 SRM-SM. Tous droits reserves.
        </footer>
      </section>
    </main>
  );
}