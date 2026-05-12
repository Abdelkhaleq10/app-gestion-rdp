export const APP_TEXT = {
  common: {
    loading: "Chargement...",
    error: "Une erreur est survenue",
    success: "Operation effectuee avec succes",
    cancel: "Annuler",
    confirm: "Confirmer",
    save: "Enregistrer",
    close: "Fermer",
    yes: "Oui",
    no: "Non",
    ok: "OK",
    search: "Rechercher",
    filter: "Filtrer",
    exportCsv: "Exporter CSV",
    refresh: "Actualiser",
  },

  auth: {
    loginTitle: "Connexion",
    registerTitle: "Creation de compte",
    fullName: "Nom complet",
    password: "Mot de passe",
    loginButton: "Se connecter",
    registerButton: "Creer un compte",
    logout: "Se deconnecter",
    invalidCredentials: "Nom complet ou mot de passe incorrect",
    accountCreated: "Compte cree avec succes",
  },

  employee: {
    title: "Espace employe",
    subtitle: "Gestion de l'acces au poste principal",
    workstationStatus: "Etat du poste principal",
    workstationFree: "Poste libre",
    workstationBusy: "Poste occupe",
    requestAccess: "Demander l'acces",
    accessAuthorized: "Acces autorise",
    accessRejected: "Demande refusee",
    accessPending: "Demande en attente",
    openRdp: "Ouvrir la connexion RDP",
    chooseReason: "Choisissez le motif de votre demande",
    optionalMessage: "Message optionnel",
    sendRequest: "Envoyer la demande",
    requestSent: "Votre demande a ete envoyee avec succes",
    requestWaiting:
      "Votre demande est en attente. Une notification a ete envoyee a l'utilisateur actuellement connecte.",
    requestAccepted:
      "Votre demande a ete acceptee. Vous pouvez maintenant ouvrir la connexion RDP.",
    requestRefused:
      "Votre demande a ete refusee par l'utilisateur actuellement connecte.",
    directAccessUnknown: "Acces direct non identifie",
  },

  responsible: {
    title: "Espace responsable",
    dashboard: "Tableau de bord",
    requests: "Demandes d'acces",
    history: "Historique RDP",
    users: "Employes",
    currentSession: "Session actuelle",
    activeUser: "Utilisateur actuellement connecte",
    noActiveUser: "Aucun utilisateur connecte",
    pendingRequests: "Demandes en attente",
    urgentRequests: "Demandes urgentes",
    totalRequests: "Total des demandes",
    totalEvents: "Total des evenements RDP",
  },

  request: {
    employee: "Employe",
    ipAddress: "Adresse IP",
    pcName: "Nom du PC",
    priority: "Priorite",
    reason: "Motif",
    message: "Message",
    status: "Statut",
    requestDate: "Date de demande",
    actions: "Actions",
    authorize: "Autoriser",
    reject: "Refuser",
    waitingCurrentUser: "En attente de reponse utilisateur",
    acceptedByCurrentUser: "Acceptee par l'utilisateur actif",
    rejectedByCurrentUser: "Refusee par l'utilisateur actif",
  },

  priority: {
    urgent: "Urgent",
    assistance: "Assistance",
    verification: "Verification",
    consultation: "Consultation",
    impression: "Impression",
    other: "Autre",
  },

  status: {
    free: "Libre",
    busy: "Occupe",
    pending: "En attente",
    authorized: "Autorisee",
    rejected: "Refusee",
    expired: "Expiree",
    unknown: "Inconnu",
  },

  history: {
    title: "Historique RDP",
    date: "Date",
    time: "Heure",
    user: "Utilisateur",
    machine: "Machine",
    ip: "Adresse IP",
    action: "Action",
    activeSession: "Session active",
    noData: "Aucun evenement trouve",
    directAccessUnknown: "Acces direct non identifie",
    rdpConnection: "Connexion RDP",
    rdpReconnection: "Reconnexion RDP",
    rdpDisconnection: "Session deconnectee",
  },

  notification: {
    title: "Demande d'acces RDP",
    body: "Un employe demande l'acces au poste principal.",
    question: "Voulez-vous liberer la session ?",
    accepted: "Vous avez accepte de liberer la session.",
    rejected: "Vous avez refuse de liberer la session.",
  },
};

export const PRIORITY_OPTIONS = [
  {
    value: "urgent",
    label: APP_TEXT.priority.urgent,
    level: 5,
    description: "Cas critique ou travail bloque",
  },
  {
    value: "assistance",
    label: APP_TEXT.priority.assistance,
    level: 4,
    description: "Besoin d'assister un collegue",
  },
  {
    value: "verification",
    label: APP_TEXT.priority.verification,
    level: 3,
    description: "Verification rapide",
  },
  {
    value: "consultation",
    label: APP_TEXT.priority.consultation,
    level: 2,
    description: "Consultation d'information",
  },
  {
    value: "impression",
    label: APP_TEXT.priority.impression,
    level: 2,
    description: "Impression ou recuperation de document",
  },
  {
    value: "other",
    label: APP_TEXT.priority.other,
    level: 1,
    description: "Demande normale",
  },
];

export function getPriorityLabel(value: string | null | undefined): string {
  const found = PRIORITY_OPTIONS.find((item) => item.value === value);
  return found?.label ?? APP_TEXT.priority.other;
}

export function getPriorityLevel(value: string | null | undefined): number {
  const found = PRIORITY_OPTIONS.find((item) => item.value === value);
  return found?.level ?? 1;
}

export function getStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return APP_TEXT.status.pending;
    case "authorized":
    case "autorisee":
    case "autorise":
    case "autorisé":
      return APP_TEXT.status.authorized;
    case "rejected":
    case "refusee":
    case "refuse":
    case "refusée":
      return APP_TEXT.status.rejected;
    case "waiting_current_user":
      return APP_TEXT.request.waitingCurrentUser;
    case "accepted_by_current_user":
      return APP_TEXT.request.acceptedByCurrentUser;
    case "rejected_by_current_user":
      return APP_TEXT.request.rejectedByCurrentUser;
    case "expired":
      return APP_TEXT.status.expired;
    default:
      return APP_TEXT.status.unknown;
  }
}