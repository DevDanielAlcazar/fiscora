import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import {
  getModuleAccessMatrix,
  updateModuleAccess,
  type PlanModuleAccessEntry,
} from "../api/admin";

export default function AdminModulesPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PlanModuleAccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    getMe(token)
      .then(() =>
        getModuleAccessMatrix(token)
          .then(setEntries)
          .catch((err) => setError(err.message)),
      )
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleToggle(entry: PlanModuleAccessEntry, field: string, value: boolean) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    setSuccessMsg("");

    try {
      const updated = await updateModuleAccess(token, entry.id, { [field]: value });
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSuccessMsg("Permiso actualizado correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  function fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      enabled: "Habilitado",
      adminOnly: "Solo admin",
      beta: "Beta",
      consumesUsage: "Consume uso",
      allowSingleXml: "XML individual",
      allowZip: "ZIP",
    };
    return labels[field] ?? field;
  }

  const checkboxFields = [
    "enabled",
    "adminOnly",
    "beta",
    "consumesUsage",
    "allowSingleXml",
    "allowZip",
  ] as const;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Permisos de módulos</h1>
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
        <h1 className="text-2xl font-extrabold tracking-tight">Permisos de módulos</h1>

        {successMsg && (
          <p className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg px-4 py-3">
            {successMsg}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-left px-4 py-3 font-semibold">Módulo</th>
                {checkboxFields.map((field) => (
                  <th key={field} className="text-center px-2 py-3 font-semibold text-xs">
                    {fieldLabel(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{entry.plan.name}</td>
                  <td className="px-4 py-3">{entry.module.name}</td>
                  {checkboxFields.map((field) => (
                    <td key={field} className="text-center px-2 py-3">
                      <input
                        type="checkbox"
                        checked={entry[field] as boolean}
                        onChange={(e) => handleToggle(entry, field, e.target.checked)}
                        className="accent-primary cursor-pointer"
                      />
                    </td>
                  ))}
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
