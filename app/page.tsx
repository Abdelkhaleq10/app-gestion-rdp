"use client";

import { useEffect, useState } from "react";

type StatusType = {
  etat_poste: string;
  nombre_sessions_actives: number;
  date_verification: string;
};

type RequestResponse = {
  success?: boolean;
  status?: string;
  reason?: string;
  ip?: string;
  message?: string;
};

export default function HomePage() {
  const [status, setStatus] = useState<StatusType>({
    etat_poste: "Chargement...",
    nombre_sessions_actives: 0,
    date_verification: "",
  });

  const [utilisateur, setUtilisateur] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [accessGranted, setAccessGranted] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch(`${window.location.origin}/api/status`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Erreur lors du chargement du statut.");
      }

      const data = await res.json();

      setStatus({
        etat_poste: data.etat_poste || "Inconnu",
        nombre_sessions_actives: data.nombre_sessions_actives ?? 0,
        date_verification: data.date_verification || "",
      });
    } catch (error) {
      console.error("Erreur status:", error);
      setStatus({
        etat_poste: "Inconnu",
        nombre_sessions_actives: 0,
        date_verification: "",
      });
    }
  }

  async function handleRequestAccess() {
    const value = utilisateur.trim();

    if (!value) {
      setMessage("Veuillez saisir votre nom d utilisateur.");
      setMessageType("error");
      setAccessGranted(false);
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setMessageType("");
      setAccessGranted(false);

      const res = await fetch(`${window.location.origin}/api/request-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utilisateur: value,
        }),
      });

      const data: RequestResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la demande.");
      }

      setMessage(data.message || "Demande traitee.");
      setMessageType(data.status === "autorise" ? "success" : "error");
      setAccessGranted(data.status === "autorise");

      await loadStatus();
    } catch (error) {
      console.error("Erreur demande:", error);
      setMessage("Erreur lors de la demande d acces.");
      setMessageType("error");
      setAccessGranted(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const isOccupe = status.etat_poste === "Occupe";
  const isLibre = status.etat_poste === "Libre";
  const isLoading = status.etat_poste === "Chargement...";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 px-6 md:px-10 py-8 md:py-10 text-white">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300 mb-3">
              SRM - SM | Controle d acces RDP
            </p>

            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Gestion d acces au poste principal
            </h1>

            <p className="text-slate-200 text-sm md:text-base leading-relaxed">
              Cette interface permet aux employes d envoyer une demande d acces
              au poste principal. Si le poste est libre, l acces peut etre
              autorise et la connexion RDP devient disponible.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 font-medium">
            Acces reserve a un seul employe a la fois.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Etat du poste principal
              </p>

              <div
                className={`inline-flex items-center px-5 py-2 rounded-full font-bold text-base ${
                  isLoading
                    ? "bg-gray-200 text-gray-700"
                    : isOccupe
                    ? "bg-red-100 text-red-700"
                    : isLibre
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {status.etat_poste}
              </div>

              <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                Le systeme verifie automatiquement si le poste principal est
                libre ou occupe.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Informations en temps reel
              </p>

              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <span className="font-semibold text-gray-900">
                    Sessions actives :
                  </span>{" "}
                  {status.nombre_sessions_actives}
                </p>

                <p>
                  <span className="font-semibold text-gray-900">
                    Derniere verification :
                  </span>{" "}
                  {status.date_verification || "Non disponible"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Demande d acces
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Saisissez votre nom puis envoyez votre demande d acces au poste
              principal.
            </p>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Utilisateur
              </label>

              <input
                type="text"
                value={utilisateur}
                onChange={(e) => setUtilisateur(e.target.value)}
                placeholder="Exemple : Abdelkhaleq El Mataoui"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleRequestAccess}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3.5 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Traitement de la demande..." : "Demander l acces"}
            </button>

            {message && (
              <div
                className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
                  messageType === "success"
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            {accessGranted && (
              <div className="mt-5">
                <a
                  href="/api/rdp-file"
                  className="block w-full text-center rounded-xl bg-slate-800 text-white font-semibold py-3.5 hover:bg-slate-700 transition shadow-sm"
                >
                  Se connecter par RDP
                </a>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                Remarque : le bouton RDP apparait uniquement lorsque la demande
                d acces est autorisee.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
            Version 1 - Application web de gestion et de controle d acces via
            RDP
          </p>
        </div>
      </div>
    </main>
  );
}