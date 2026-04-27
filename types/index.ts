export type SystemStatus = {
  id: number;
  etat_poste: string;
  nombre_sessions_actives: number;
  date_verification: string;
};

export type AccessRequest = {
  id: number;
  pc_name: string;
  ip: string;
  request_time: string;
  status: string;
  reason: string;
};

export type RdpEvent = {
  id: number;
  date: string;
  heure: string;
  utilisateur: string;
  machine: string;
  session_id: string;
  nom_session: string;
  ip: string;
  type_ip: string;
  action: string;
  session_active: string;
};