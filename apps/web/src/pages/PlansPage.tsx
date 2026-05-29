import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { createCheckoutSession } from "../api/billing";

interface PlanInfo {
  key: string;
  name: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: string[];
}

const PLANS: PlanInfo[] = [
  {
    key: "PROFESSIONAL",
    name: "Profesional",
    description: "Para contadores y despachos pequeños",
    monthlyPrice: "$399",
    yearlyPrice: "$3,591",
    features: [
      "Auditoría XML individual y ZIP",
      "Hasta 20 RFCs",
      "Módulos profesionales",
      "Soporte estándar",
    ],
  },
  {
    key: "CORPORATION",
    name: "Corporativo",
    description: "Para empresas y despachos medianos",
    monthlyPrice: "$1,400",
    yearlyPrice: "$12,600",
    features: [
      "Acceso a todos los módulos principales",
      "Hasta 100 RFCs",
      "Auditoría XML individual y ZIP",
      "Soporte prioritario",
    ],
  },
  {
    key: "FORENSIC_AUDITOR",
    name: "Auditor Forense",
    description: "Para auditorías masivas y peritos",
    monthlyPrice: "$4,189",
    yearlyPrice: "$37,701",
    features: [
      "RFCs ilimitados",
      "Auditoría fiscal avanzada",
      "Acceso temprano a módulos beta",
      "Soporte prioritario premium",
    ],
  },
];

export default function PlansPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loading, setLoading] = useState(true);
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
      .finally(() => setLoading(false));
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

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3 text-center max-w-md mx-auto">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className="p-6 rounded-xl border border-border bg-card flex flex-col"
            >
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

              <p className="text-3xl font-extrabold mt-4">
                {billingCycle === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice}
                <span className="text-sm font-normal text-muted-foreground">
                  /{billingCycle === "MONTHLY" ? "mes" : "año"}
                </span>
              </p>

              <ul className="mt-6 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.key)}
                disabled={submitting === plan.key}
                className="mt-6 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {submitting === plan.key ? "Redirigiendo..." : "Suscribirse"}
              </button>
            </div>
          ))}
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
