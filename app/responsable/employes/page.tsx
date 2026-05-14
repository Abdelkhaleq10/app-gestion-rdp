"use client";

import { useEffect, useState } from "react";
import ResponsableGuard from "../../../components/ResponsableGuard";
import ResponsableNav from "../../../components/ResponsableNav";

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

      const data = await response.json();

      setEmployees(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error("Erreur chargement comptes :", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

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
    setMessage("");
  }

  function openEditForm(employee: Employee) {
    setForm({
      id: employee.id,
      full_name: employee.full_name || "",
      username: employee.username || makeUsername(employee.full_name),
      password: "",
      email: employee.email || "",
      pc_name: employee.pc_name || "",
      department: employee.department || "",
      role: employee.role || "Employe",
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
        setMessage("Le nom complet est obligatoire.");
        return;
      }

      if (!editing && password.length < 4) {
        setMessage("Le mot de passe doit contenir au moins 4 caracteres.");
        return;
      }

      const payload = {
        ...form,
        username: form.username || makeUsername(fullName),
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
        setMessage(data.message || "Erreur lors de l'enregistrement.");
        return;
      }

      setMessage(data.message || "Operation effectuee avec succes.");
      closeForm();
      await loadEmployees();
    } catch (error) {
      console.error("Erreur sauvegarde compte :", error);
      setMessage("Erreur lors de l'enregistrement.");
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
        setMessage(data.message || "Erreur lors du changement de statut.");
        return;
      }

      setMessage(data.message);
      await loadEmployees();
    } catch (error) {
      console.error("Erreur statut compte :", error);
      setMessage("Erreur lors du changement de statut.");
    }
  }

  async function resetPassword() {
    if (!resetEmployee) return;

    try {
      setSaving(true);
      setMessage("");

      if (newPassword.trim().length < 4) {
        setMessage("Le nouveau mot de passe doit contenir au moins 4 caracteres.");
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
        setMessage(data.message || "Erreur lors de la reinitialisation.");
        return;
      }

      setMessage(data.message || "Mot de passe reinitialise avec succes.");
      setResetEmployee(null);
      setNewPassword("");
      await loadEmployees();
    } catch (error) {
      console.error("Erreur reset mot de passe :", error);
      setMessage("Erreur lors de la reinitialisation du mot de passe.");
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
        setMessage(data.message || "Erreur lors de la suppression.");
        return;
      }

      setMessage(data.message);
      await loadEmployees();
    } catch (error) {
      console.error("Erreur suppression compte :", error);
      setMessage("Erreur lors de la suppression.");
    }
  }

  const activeCount = employees.filter((item) => item.is_active).length;
  const inactiveCount = employees.filter((item) => !item.is_active).length;
  const temporaryPasswordCount = employees.filter(
    (item) => item.must_change_password
  ).length;

  return (
    <ResponsableGuard>
      <main className="min-h-screen bg-slate-100">
        <header className="bg-blue-950 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center text-xl font-black">
                PC
              </div>

              <div>
                <p className="font-bold text-lg">SRM-SM</p>
                <p className="text-xs text-blue-200">Interface responsable</p>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-xl md:text-2xl font-black">
                Gestion d'acces RDP
              </h1>
            </div>

            <div className="flex items-center justify-start md:justify-end gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-blue-700 items-center justify-center font-black">
                RM
              </div>

              <div className="text-left md:text-right">
                <p className="text-xs text-blue-200">Espace responsable</p>
                <p className="font-bold leading-tight">Responsable</p>
              </div>

              <a
                href="/responsable/logout"
                className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 font-semibold transition"
              >
                Deconnexion
              </a>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-500">Total comptes</p>
              <p className="text-4xl font-black text-blue-700 mt-2">
                {employees.length}
              </p>
              <p className="text-sm text-slate-400 mt-3">Comptes crees</p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-500">Actifs</p>
              <p className="text-4xl font-black text-green-700 mt-2">
                {activeCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                Peuvent demander l'acces
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-500">Desactives</p>
              <p className="text-4xl font-black text-red-700 mt-2">
                {inactiveCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">Acces bloque</p>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-500">
                MDP temporaires
              </p>
              <p className="text-4xl font-black text-orange-600 mt-2">
                {temporaryPasswordCount}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                A changer par employe
              </p>
            </div>
          </div>

          <ResponsableNav />

          {message ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
              {message}
            </div>
          ) : null}

          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Gestion des comptes employes
                </h2>
                <p className="text-slate-500 mt-1">
                  Creation des comptes par nom complet et mot de passe, avec reset et controle d'acces.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher un employe..."
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Tous</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Desactives</option>
                </select>

                <button
                  onClick={() => setSearch(searchInput.trim())}
                  className="rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-black px-5 py-3"
                >
                  Rechercher
                </button>

                <button
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setStatus("");
                  }}
                  className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black px-5 py-3"
                >
                  Reset
                </button>

                <button
                  onClick={openAddForm}
                  className="rounded-2xl bg-green-700 hover:bg-green-800 text-white font-black px-5 py-3"
                >
                  + Ajouter compte
                </button>
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-12 text-slate-500 font-semibold">
                Chargement...
              </div>
            ) : employees.length === 0 ? (
              <div className="px-6 py-12 text-slate-500 font-semibold">
                Aucun compte employe trouve.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-6 py-4">Employe</th>
                      <th className="text-left px-6 py-4">Mot de passe</th>
                      <th className="text-left px-6 py-4">Statut</th>
                      <th className="text-left px-6 py-4">Derniere connexion</th>
                      <th className="text-right px-6 py-4">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {employees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">
                              {getInitials(employee.full_name)}
                            </div>

                            <div>
                              <p className="font-black text-slate-900">
                                {employee.full_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                Cree le {formatDate(employee.created_at)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {employee.must_change_password ? (
                            <span className="inline-flex rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                              MDP temporaire
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                              MDP defini
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {employee.is_active ? (
                            <span className="inline-flex rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                              Desactive
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-slate-600">
                          {formatDate(employee.last_login_at)}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              onClick={() => openEditForm(employee)}
                              className="rounded-xl bg-blue-100 px-3 py-2 font-bold text-blue-700 hover:bg-blue-200"
                            >
                              Modifier
                            </button>

                            <button
                              onClick={() => {
                                setResetEmployee(employee);
                                setNewPassword("");
                              }}
                              className="rounded-xl bg-orange-100 px-3 py-2 font-bold text-orange-700 hover:bg-orange-200"
                            >
                              Reset MDP
                            </button>

                            <button
                              onClick={() => toggleEmployee(employee)}
                              className={`rounded-xl px-3 py-2 font-bold ${
                                employee.is_active
                                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {employee.is_active ? "Desactiver" : "Activer"}
                            </button>

                            <button
                              onClick={() => deleteEmployee(employee)}
                              className="rounded-xl bg-red-100 px-3 py-2 font-bold text-red-700 hover:bg-red-200"
                            >
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
        </section>

        {showForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {editing ? "Modifier le compte" : "Ajouter un compte"}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Compte cree par nom complet et mot de passe.
                  </p>
                </div>

                <button
                  onClick={closeForm}
                  className="rounded-full bg-slate-100 h-10 w-10 font-black hover:bg-slate-200"
                >
                  X
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Nom complet
                  </label>
                  <input
                    value={form.full_name}
                    onChange={(e) => handleFullNameChange(e.target.value)}
                    placeholder="Ex : Said COTTI"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {!editing ? (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
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
                      placeholder="Ex : 1234"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      L'employe pourra demander au responsable de le reinitialiser en cas d'oubli.
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
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
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value={1}>Actif</option>
                    <option value={0}>Desactive</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveEmployee}
                    disabled={saving}
                    className="flex-1 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {saving ? "Enregistrement..." : editing ? "Modifier" : "Ajouter"}
                  </button>

                  <button
                    onClick={closeForm}
                    className="rounded-2xl bg-slate-800 px-5 py-3 font-black text-white hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {resetEmployee ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900">
                  Reset mot de passe
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Compte :{" "}
                  <span className="font-black text-slate-800">
                    {resetEmployee.full_name}
                  </span>
                </p>
              </div>

              <div className="p-6 space-y-4">
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="text"
                  placeholder="Nouveau mot de passe"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />

                <div className="flex gap-3">
                  <button
                    onClick={resetPassword}
                    disabled={saving}
                    className="flex-1 rounded-2xl bg-orange-600 px-5 py-3 font-black text-white hover:bg-orange-700 disabled:opacity-60"
                  >
                    Reinitialiser
                  </button>

                  <button
                    onClick={() => {
                      setResetEmployee(null);
                      setNewPassword("");
                    }}
                    className="rounded-2xl bg-slate-800 px-5 py-3 font-black text-white hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ResponsableGuard>
  );
}