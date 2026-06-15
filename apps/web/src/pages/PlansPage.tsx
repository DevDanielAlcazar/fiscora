import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { createCheckoutSession } from "../api/billing";
import { getPlans, type PlanFromApi } from "../api/plans";

function formatPrice(cents: number | null): string {
  if (cents === null || cents === 0) return "Gratuito";
  const pesos = cents / 100;
  return "$" + pesos.toLocaleString("es-MX", { minimumFractionDigits: 0 });
}

export default function PlansPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    getMe(token)
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => {
        getPlans()
          .then((data) => setPlans(data.plans))
          .catch((err) =>
            setFetchError(err instanceof Error ? err.message : "Error al cargar planes"),
          )
          .finally(() => setLoading(false));
      });
  }, [navigate]);

  async function handleSelectPlan(planKey: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setSubmitting(planKey);
    setError("");

    try {
      const url = await createCheckoutSession(token, planKey, billingCycle);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setSubmitting(null);
    }
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
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Planes</h1>
          <p className="text-muted-foreground">Elige el plan ideal para tu negocio</p>

          <div className="inline-flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setBillingCycle("MONTHLY")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                billingCycle === "MONTHLY"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle("YEARLY")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                billingCycle === "YEARLY"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        {(error || fetchError) && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3 text-center max-w-md mx-auto">
            {error || fetchError}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const price =
              billingCycle === "MONTHLY"
                ? formatPrice(plan.monthlyPriceCents)
                : formatPrice(plan.yearlyPriceCents);
            const isFree = plan.monthlyPriceCents === 0 && plan.yearlyPriceCents === 0;
            const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];

            return (
              <div
                key={plan.key}
                className="p-6 rounded-xl border border-border bg-card flex flex-col"
              >
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

                <p className="text-3xl font-extrabold mt-4">
                  {price}
                  {!isFree && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingCycle === "MONTHLY" ? "mes" : "año"}
                    </span>
                  )}
                </p>

                <ul className="mt-6 space-y-2 flex-1">
                  {features.map((f) => (
                    <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="text-emerald-500">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isFree ? (
                  <div className="mt-6 w-full py-2.5 rounded-lg bg-muted text-muted-foreground font-semibold text-sm text-center">
                    Plan gratuito
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan.key)}
                    disabled={submitting === plan.key}
                    className="mt-6 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {submitting === plan.key ? "Redirigiendo..." : "Suscribirse"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
