import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminPlans, updateAdminPlan, type AdminPlanEntry } from "../api/admin";

export default function AdminPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<AdminPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function fetchPlans() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    getAdminPlans(token)
      .then((data) => setPlans(data.plans))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
        if (msg === "No tienes permisos de administrador") return;
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchPlans();
  }, []);

  async function handleSave(planKey: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    setSaving(planKey);
    setError("");
    setSuccessMsg("");

    const plan = plans.find((p) => p.key === planKey);
    if (!plan) return;

    const body: Record<string, unknown> = {};
    body.name = plan.name;
    body.description = plan.description;
    body.monthlyPriceCents = plan.monthlyPriceCents;
    body.yearlyPriceCents = plan.yearlyPriceCents;
    body.currency = plan.currency;
    body.stripeMonthlyPriceId = plan.stripeMonthlyPriceId;
    body.stripeYearlyPriceId = plan.stripeYearlyPriceId;
    body.maxUsers = plan.maxUsers;
    body.maxRfcProfiles = plan.maxRfcProfiles;
    body.monthlyUsageLimit = plan.monthlyUsageLimit;
    body.isPublic = plan.isPublic;
    body.features = plan.features;

    try {
      const result = await updateAdminPlan(token, planKey, body);
      setSuccessMsg(result.message);
      fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(null);
    }
  }

  function updateField(planKey: string, field: string, value: unknown) {
    setPlans((prev) =>
      prev.map((p) => (p.key === planKey ? { ...p, [field]: value } : p)),
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">Costos y Planes</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Volver al dashboard
          </button>
        </div>

        {successMsg && (
          <p className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg px-4 py-3">
            {successMsg}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="space-y-6">
          {plans.map((plan) => (
            <div key={plan.key} className="p-6 rounded-xl border border-border bg-card space-y-4">
              <h2 className="text-lg font-bold">{plan.key} — {plan.name}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre</label>
                  <input
                    type="text"
                    value={plan.name}
                    onChange={(e) => updateField(plan.key, "name", e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda</label>
                  <input
                    type="text"
                    value={plan.currency}
                    onChange={(e) => updateField(plan.key, "currency", e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción</label>
                  <input
                    type="text"
                    value={plan.description ?? ""}
                    onChange={(e) => updateField(plan.key, "description", e.target.value || null)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Precio mensual (cents)</label>
                  <input
                    type="number"
                    value={plan.monthlyPriceCents ?? ""}
                    onChange={(e) => updateField(plan.key, "monthlyPriceCents", e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Precio anual (cents)</label>
                  <input
                    type="number"
                    value={plan.yearlyPriceCents ?? ""}
                    onChange={(e) => updateField(plan.key, "yearlyPriceCents", e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Stripe Price ID (mensual)</label>
                  <input
                    type="text"
                    value={plan.stripeMonthlyPriceId ?? ""}
                    onChange={(e) => updateField(plan.key, "stripeMonthlyPriceId", e.target.value || null)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Stripe Price ID (anual)</label>
                  <input
                    type="text"
                    value={plan.stripeYearlyPriceId ?? ""}
                    onChange={(e) => updateField(plan.key, "stripeYearlyPriceId", e.target.value || null)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Máx. usuarios</label>
                  <input
                    type="number"
                    value={plan.maxUsers}
                    onChange={(e) => updateField(plan.key, "maxUsers", Number(e.target.value))}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Máx. RFCs</label>
                  <input
                    type="number"
                    value={plan.maxRfcProfiles}
                    onChange={(e) => updateField(plan.key, "maxRfcProfiles", Number(e.target.value))}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Límite usos mensuales</label>
                  <input
                    type="number"
                    value={plan.monthlyUsageLimit ?? ""}
                    onChange={(e) => updateField(plan.key, "monthlyUsageLimit", e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id={`public-${plan.key}`}
                    checked={plan.isPublic}
                    onChange={(e) => updateField(plan.key, "isPublic", e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor={`public-${plan.key}`} className="text-xs font-medium text-muted-foreground">
                    Público
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Características (una por línea)</label>
                <textarea
                  rows={4}
                  value={plan.features?.join("\n") ?? ""}
                  onChange={(e) => updateField(plan.key, "features", e.target.value.split("\n").filter(Boolean))}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSave(plan.key)}
                  disabled={saving === plan.key}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {saving === plan.key ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
