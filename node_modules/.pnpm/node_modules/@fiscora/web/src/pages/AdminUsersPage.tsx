import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import {
  getUsers,
  updateUserPlan,
  updateUserStatus,
  updateUser,
  deleteUser,
  type UserEntry,
} from "../api/admin";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [planChangeError, setPlanChangeError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [addUserError, setAddUserError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createAccountType, setCreateAccountType] = useState<"INDIVIDUAL" | "ORGANIZATION">(
    "INDIVIDUAL",
  );
  const [createOrgName, setCreateOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editOrgName, setEditOrgName] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function fetchUsers() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    getUsers(token)
      .then(setUsers)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    getMe(token)
      .then(() => fetchUsers())
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function roleLabel(role: string): string {
    const labels: Record<string, string> = {
      SUPER_ADMIN: "Super Admin",
      ORG_ADMIN: "Admin Org",
      ORG_USER: "Usuario",
      EXTERNAL_AUDITOR: "Auditor Externo",
    };
    return labels[role] ?? role;
  }

  async function handleExport() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setExportError("");
    setExporting(true);

    try {
      const res = await fetch("/api/admin/users/export", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        throw new Error("No tienes permisos de administrador");
      }

      if (!res.ok) {
        throw new Error("Error al exportar usuarios");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fiscora-usuarios.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setExporting(false);
    }
  }

  async function handlePlanChange(userId: string, planKey: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!window.confirm("¿Confirmas cambiar el plan de este usuario?")) return;

    setPlanChangeError("");
    setSuccessMsg("");

    try {
      const result = await updateUserPlan(token, userId, planKey);
      setSuccessMsg(result.message);
      fetchUsers();
    } catch (err) {
      setPlanChangeError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  const PLAN_OPTIONS = ["ESSENTIAL", "PROFESSIONAL", "CORPORATION", "FORENSIC_AUDITOR"];

  async function handleSuspend(userId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    const reason = window.prompt("Indica el motivo de suspensión");
    if (reason === null) return;

    setActionError("");
    setSuccessMsg("");

    try {
      const result = await updateUserStatus(token, userId, { status: "BANNED", reason });
      setSuccessMsg(result.message);
      fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  async function handleReactivate(userId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!window.confirm("¿Confirmas reactivar este usuario?")) return;

    setActionError("");
    setSuccessMsg("");

    try {
      const result = await updateUserStatus(token, userId, { status: "ACTIVE" });
      setSuccessMsg(result.message);
      fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setAddUserError("");
    setSuccessMsg("");
    setCreating(true);

    try {
      const body: Record<string, unknown> = {
        name: createName,
        email: createEmail,
        password: createPassword,
        accountType: createAccountType,
      };

      if (createAccountType === "ORGANIZATION" && createOrgName) {
        body.organizationName = createOrgName;
      }

      if (createAccountType === "INDIVIDUAL" && createOrgName) {
        body.organizationName = createOrgName;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        throw new Error("No tienes permisos de administrador");
      }

      if (res.status === 409) {
        throw new Error("El email ya está registrado.");
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Error al crear usuario");
      }

      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateAccountType("INDIVIDUAL");
      setCreateOrgName("");
      setSuccessMsg("Usuario creado correctamente.");
      fetchUsers();
    } catch (err) {
      setAddUserError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  function handleEditClick(user: UserEntry) {
    setEditUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditOrgName(user.organization?.name ?? "");
    setEditError("");
  }

  function handleEditCancel() {
    setEditUserId(null);
  }

  async function handleEditSave(userId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setEditError("");
    setSuccessMsg("");
    setSavingEdit(true);

    try {
      const data: { name?: string; email?: string; organizationName?: string } = {};
      data.name = editName;
      data.email = editEmail;
      if (editOrgName) data.organizationName = editOrgName;

      const result = await updateUser(token, userId, data);
      setSuccessMsg(result.message);
      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(userId: string) {
    const confirmed = window.confirm(
      "Esta acción desactivará la cuenta sin borrar su historial. ¿Confirmas continuar?",
    );
    if (!confirmed) return;

    const reason = window.prompt("Indica el motivo de eliminación");
    if (reason === null) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setSuccessMsg("");
    setError("");

    try {
      const result = await deleteUser(token, userId, reason ?? undefined);
      setSuccessMsg(result.message);
      fetchUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Usuarios</h1>
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Usuarios ({users.length})</h1>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
        )}

        {exportError && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{exportError}</p>
        )}

        {planChangeError && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">
            {planChangeError}
          </p>
        )}

        {actionError && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{actionError}</p>
        )}

        {successMsg && (
          <p className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg px-4 py-3">
            {successMsg}
          </p>
        )}

        {addUserError && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{addUserError}</p>
        )}

        <form
          onSubmit={handleCreateUser}
          className="p-6 rounded-xl border border-border bg-card space-y-4"
        >
          <h2 className="font-semibold text-lg">Crear usuario</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nombre</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Email</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Contraseña (min 12)
              </label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={12}
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Tipo de cuenta</label>
              <select
                value={createAccountType}
                onChange={(e) =>
                  setCreateAccountType(e.target.value as "INDIVIDUAL" | "ORGANIZATION")
                }
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="INDIVIDUAL">INDIVIDUAL</option>
                <option value="ORGANIZATION">ORGANIZATION</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground font-medium">
                Nombre organización{" "}
                {createAccountType === "ORGANIZATION" ? "(requerido)" : "(opcional)"}
              </label>
              <input
                type="text"
                value={createOrgName}
                onChange={(e) => setCreateOrgName(e.target.value)}
                required={createAccountType === "ORGANIZATION"}
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {creating ? "Creando..." : "Crear usuario"}
          </button>
        </form>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {exporting ? "Exportando..." : "Exportar Excel"}
        </button>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Rol</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Suspensión</th>
                <th className="text-left px-4 py-3 font-semibold">Motivo</th>
                <th className="text-left px-4 py-3 font-semibold">Organización</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-left px-4 py-3 font-semibold">Stripe</th>
                <th className="text-left px-4 py-3 font-semibold">Registro</th>
                <th className="text-left px-4 py-3 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <React.Fragment key={user.id}>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{roleLabel(user.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : user.status === "DELETED"
                              ? "bg-gray-500/10 text-gray-500"
                              : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {user.bannedAt ? new Date(user.bannedAt).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">
                      {user.bannedReason ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {user.organization ? user.organization.name : "Sin organización"}
                    </td>
                    <td className="px-4 py-3">{user.organization?.accountType ?? "—"}</td>
                    <td className="px-4 py-3">
                      {user.organization ? (
                        <select
                          value={user.organization.subscription?.plan.key ?? "ESSENTIAL"}
                          onChange={(e) => handlePlanChange(user.id, e.target.value)}
                          className="bg-transparent border border-border/50 rounded px-2 py-1 text-sm cursor-pointer"
                        >
                          {PLAN_OPTIONS.map((key) => (
                            <option key={key} value={key}>
                              {key}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">Sin organización</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {user.organization?.subscription?.stripeSubscriptionId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("es-MX")}
                    </td>
                    <td className="px-4 py-3">
                      {user.status === "DELETED" ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-500/10 text-gray-500">
                          DELETED
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(user)}
                            className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                          >
                            Editar
                          </button>
                          {user.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleSuspend(user.id)}
                              className="text-xs font-semibold px-2 py-1 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                            >
                              Suspender
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(user.id)}
                              className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                            >
                              Reactivar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-xs font-semibold px-2 py-1 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editUserId === user.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={14} className="px-6 py-4">
                        <div className="max-w-lg mx-auto space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">
                            Editar usuario — {user.name}
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Nombre
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Organización
                              </label>
                              <input
                                type="text"
                                value={editOrgName}
                                onChange={(e) => setEditOrgName(e.target.value)}
                                disabled={!user.organization}
                                className={`w-full bg-background border border-border rounded px-2 py-1.5 text-sm ${
                                  !user.organization ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                              />
                            </div>
                          </div>
                          {editError && <p className="text-xs text-red-500">{editError}</p>}
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleEditCancel}
                              className="text-xs font-semibold px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleEditSave(user.id)}
                              disabled={savingEdit}
                              className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                              {savingEdit ? "Guardando..." : "Guardar"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
