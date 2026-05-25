"use client";

import { useEffect, useMemo, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import AppTopBar from "../../../components/AppTopBar";

import {
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserRound,
  UserX,
  X,
} from "lucide-react";

type Employee = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  pc_name: string;
  department: string;
  role: string;
  is_active: number;
  must_change_password: number;
  last_login_at: string;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: number;
  full_name: string;
  username: string;
  password: string;
  email: string;
  pc_name: string;
  department: string;
  role: string;
  is_active: number;
};

type EmployeesResponse = {
  success?: boolean;
  items?: Employee[];
  message?: string;
};

const EMPTY_FORM: FormState = {
  full_name: "",
  username: "",
  password: "",
  email: "",
  pc_name: "",
  department: "",
  role: "Employe",
  is_active: 1,
};

function makeUsername(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

function getInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDate(value: string) {
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

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
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
    <div className={`rounded-[1.6rem] border p-5 shadow-sm ${styles[color]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-600">{title}</p>

          <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-current/10 bg-white/80 p-3 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function EmployesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [resetEmployee, setResetEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  const [saving, setSaving] = useState(false);

  async function loadEmployees() {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        search,
        status,
      });

      const response = await fetch(`/api/employes?${params.toString()}`, {
        cache: "no-store",
      });

      const data: EmployeesResponse = await response.json();

      setEmployees(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Erreur chargement comptes :", error);
      setEmployees([]);
      setMessageType("error");
      setMessage("Erreur lors du chargement des comptes employés.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  function showSuccess(text: string) {
    setMessageType("success");
    setMessage(text);
  }

  function showError(text: string) {
    setMessageType("error");
    setMessage(text);
  }

  function openAddForm() {
    setForm(EMPTY_FORM);
    setEditing(false);
    setShowForm(true);
    setMessage("");
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setEditing(false);
    setShowForm(false);
  }

  function openEditForm(employee: Employee) {
    setForm({
      id: employee.id,
      full_name: employee.full_name || "",
      username: employee.username || makeUsername(employee.full_name),
      password: "",
      email: "",
      pc_name: "",
      department: "",
      role: "Employe",
      is_active: employee.is_active ? 1 : 0,
    });

    setEditing(true);
    setShowForm(true);
    setMessage("");
  }

  function handleFullNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      full_name: value,
      username: editing ? prev.username : makeUsername(value),
    }));
  }

  async function saveEmployee() {
    try {
      setSaving(true);
      setMessage("");

      const fullName = form.full_name.trim();
      const password = form.password.trim();

      if (!fullName) {
        showError("Le nom complet est obligatoire.");
        return;
      }

      if (!editing && password.length < 4) {
        showError("Le mot de passe doit contenir au moins 4 caracteres.");
        return;
      }

      const payload = {
        ...form,
        username: form.username || makeUsername(fullName),
        email: "",
        pc_name: "",
        department: "",
        role: "Employe",
      };

      const response = await fetch("/api/employes", {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showError(data.message || "Erreur lors de l'enregistrement.");
        return;
      }

      closeForm();
      showSuccess(data.message || "Operation effectuee avec succes.");
      await loadEmployees();
    } catch (error) {
      console.error("Erreur sauvegarde compte :", error);
      showError("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEmployee(employee: Employee) {
    try {
      const response = await fetch("/api/employes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: employee.id,
          is_active: employee.is_active ? 0 : 1,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showError(data.message || "Erreur lors du changement de statut.");
        return;
      }

      showSuccess(data.message || "Statut modifie avec succes.");
      await loadEmployees();
    } catch (error) {
      console.error("Erreur statut compte :", error);
      showError("Erreur lors du changement de statut.");
    }
  }

  async function resetPassword() {
    if (!resetEmployee) return;

    try {
      setSaving(true);
      setMessage("");

      if (newPassword.trim().length < 4) {
        showError("Le nouveau mot de passe doit contenir au moins 4 caracteres.");
        return;
      }

      const response = await fetch("/api/employes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: resetEmployee.id,
          action: "reset_password",
          password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showError(data.message || "Erreur lors de la reinitialisation.");
        return;
      }

      setResetEmployee(null);
      setNewPassword("");
      showSuccess(data.message || "Mot de passe reinitialise avec succes.");
      await loadEmployees();
    } catch (error) {
      console.error("Erreur reset mot de passe :", error);
      showError("Erreur lors de la reinitialisation du mot de passe.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Supprimer le compte de ${employee.full_name} ?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/employes?id=${employee.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showError(data.message || "Erreur lors de la suppression.");
        return;
      }

      showSuccess(data.message || "Compte supprime avec succés.");
      await loadEmployees();
    } catch (error) {
      console.error("Erreur suppression compte :", error);
      showError("Erreur lors de la suppression.");
    }
  }

  function handleSearch() {
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setMessage("");
  }

  const activeCount = useMemo(() => {
    return employees.filter((item) => item.is_active).length;
  }, [employees]);

  const inactiveCount = useMemo(() => {
    return employees.filter((item) => !item.is_active).length;
  }, [employees]);

  const temporaryPasswordCount = useMemo(() => {
    return employees.filter((item) => item.must_change_password).length;
  }, [employees]);

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
                    <UserCog className="h-4 w-4" />
                    Gestion des employés
                  </div>

                  <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                    Gestion des comptes employés
                  </h1>

                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
                    Création, modification, activation, désactivation et
                    réinitialisation des comptes employés.
                  </p>
                </div>

                <button
                  onClick={openAddForm}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un compte
                </button>
              </div>
            </div>

            {message ? (
              <div
                className={`rounded-2xl border px-5 py-4 text-sm font-black ${
                  messageType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total comptes"
                value={employees.length}
                subtitle="Comptes employés créés."
                icon={<UserRound className="h-6 w-6" />}
                color="blue"
              />

              <StatCard
                title="Actifs"
                value={activeCount}
                subtitle="Comptes autorisés à demander l'accès."
                icon={<UserCheck className="h-6 w-6" />}
                color="green"
              />

              <StatCard
                title="Désactivés"
                value={inactiveCount}
                subtitle="Comptes bloqués temporairement."
                icon={<UserX className="h-6 w-6" />}
                color="red"
              />

              <StatCard
                title="MDP temporaires"
                value={temporaryPasswordCount}
                subtitle="Comptes avec mot de passe temporaire."
                icon={<KeyRound className="h-6 w-6" />}
                color="orange"
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-700" />
                <h2 className="text-xl font-black text-slate-950">
                  Recherche et filtres
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px_130px_190px]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    placeholder="Rechercher par nom..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Tous</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Désactivés</option>
                </select>

                <button
                  onClick={handleSearch}
                  className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800"
                >
                  OK
                </button>

                <button
                  onClick={resetFilters}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700"
                >
                  Réinitialiser
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      Liste des comptes
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Total lignes : {employees.length}
                    </p>
                  </div>

                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600">
                    Comptes employés
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center font-semibold text-slate-500">
                  Chargement des comptes...
                </div>
              ) : employees.length === 0 ? (
                <div className="p-10 text-center font-semibold text-slate-500">
                  Aucun compte employé trouvé.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-5 py-4 text-left font-black">
                          Employé
                        </th>
                        <th className="px-5 py-4 text-left font-black">
                          Mot de passe
                        </th>
                        <th className="px-5 py-4 text-left font-black">
                          Statut
                        </th>
                        <th className="px-5 py-4 text-left font-black">
                          Dernière connexion
                        </th>
                        <th className="px-5 py-4 text-right font-black">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {employees.map((employee) => (
                        <tr
                          key={employee.id}
                          className="transition hover:bg-blue-50/40"
                        >
                          <td className="px-5 py-5 align-top">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-sm font-black text-white shadow-lg shadow-blue-950/10">
                                {getInitials(employee.full_name)}
                              </div>

                              <div>
                                <p className="font-black text-slate-950">
                                  {employee.full_name || "-"}
                                </p>

                                <p className="mt-1 text-xs font-semibold text-slate-400">
                                  Créé le {formatDate(employee.created_at)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5 align-top">
                            {employee.must_change_password ? (
                              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                                MDP temporaire
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                                MDP défini
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-5 align-top">
                            {employee.is_active ? (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                                Désactivé
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-5 align-top font-semibold text-slate-600">
                            {formatDate(employee.last_login_at)}
                          </td>

                          <td className="px-5 py-5 align-top">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                onClick={() => openEditForm(employee)}
                                className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 font-black text-blue-700 transition hover:bg-blue-100"
                              >
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </button>

                              <button
                                onClick={() => {
                                  setResetEmployee(employee);
                                  setNewPassword("");
                                  setMessage("");
                                }}
                                className="inline-flex items-center gap-1 rounded-xl bg-orange-50 px-3 py-2 font-black text-orange-700 transition hover:bg-orange-100"
                              >
                                <KeyRound className="h-4 w-4" />
                                Réinitialiser MDP
                              </button>

                              <button
                                onClick={() => toggleEmployee(employee)}
                                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 font-black transition ${
                                  employee.is_active
                                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {employee.is_active ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                                {employee.is_active ? "Désactiver" : "Activer"}
                              </button>

                              <button
                                onClick={() => deleteEmployee(employee)}
                                className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 font-black text-red-700 transition hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {showForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">
                    {editing ? "Modifier le compte" : "Ajouter un compte"}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Renseignez uniquement le nom complet et le mot de passe.
                  </p>
                </div>

                <button
                  onClick={closeForm}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Nom complet
                  </label>

                  <input
                    value={form.full_name}
                    onChange={(e) => handleFullNameChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {!editing ? (
                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700">
                      Mot de passe initial
                    </label>

                    <input
                      value={form.password}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />

                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Ce mot de passe sera utilisé par l'employé pour se
                      connecter à son espace.
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Statut
                  </label>

                  <select
                    value={form.is_active}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_active: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value={1}>Actif</option>
                    <option value={0}>Désactivé</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  onClick={closeForm}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700"
                >
                  Annuler
                </button>

                <button
                  onClick={saveEmployee}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving
                    ? "Enregistrement..."
                    : editing
                    ? "Modifier"
                    : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {resetEmployee ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-50 p-3 text-orange-700">
                    <LockKeyhole className="h-6 w-6" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      Réinitialisation du mot de passe
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Compte :{" "}
                      <span className="font-black text-slate-800">
                        {resetEmployee.full_name}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Nouveau mot de passe
                </label>

                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="text"
                  placeholder="Nouveau mot de passe"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setResetEmployee(null);
                    setNewPassword("");
                  }}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700"
                >
                  Annuler
                </button>

                <button
                  onClick={resetPassword}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 font-black text-white transition hover:bg-orange-700 disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ResponsableGuard>
  );
}