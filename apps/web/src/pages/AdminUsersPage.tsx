import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { getUsers, updateUserPlan, type UserEntry } from "../api/admin";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [planChangeError, setPlanChangeError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function fetchUsers() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    getUsers(token).then(setUsers).catch((err) => setError(err.message));
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
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{planChangeError}</p>
        )}

        {successMsg && (
          <p className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg px-4 py-3">{successMsg}</p>
        )}

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
                <th className="text-left px-4 py-3 font-semibold">Organización</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Stripe ID</th>
                <th className="text-left px-4 py-3 font-semibold">Registro</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{roleLabel(user.role)}</td>
                  <td className="px-4 py-3">
                    {user.organization ? user.organization.name : "Sin organización"}
                  </td>
                  <td className="px-4 py-3">
                    {user.organization?.accountType ?? "—"}
                  </td>
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
                  <td className="px-4 py-3 capitalize">
                    {user.organization?.subscription?.status ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {user.organization?.subscription?.stripeSubscriptionId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("es-MX")}
                  </td>
                </tr>
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
