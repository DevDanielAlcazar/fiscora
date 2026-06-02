import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { getCurrentPlan, type CurrentPlan } from "../api/billing";

interface UserInfo {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      navigate("/login");
      return;
    }

    getMe(token)
      .then((userData) => {
        setUser(userData);

        if (userData.organizationId) {
          setPlanLoading(true);
          getCurrentPlan(token)
            .then(setPlan)
            .catch((err) => {
              setPlanError(err instanceof Error ? err.message : "Error desconocido");
            })
            .finally(() => setPlanLoading(false));
        }
      })
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="font-semibold text-lg">Información del usuario</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Rol</span>
              <span className="font-medium">{user.role}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{user.userId}</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="font-semibold text-lg">Plan actual</h2>

          {planLoading && (
            <p className="text-sm text-muted-foreground">Cargando plan...</p>
          )}

          {planError && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">
              {planError}
            </p>
          )}

          {!user.organizationId && !planLoading && (
            <p className="text-sm text-muted-foreground">
              Sin organización asociada. No hay plan disponible.
            </p>
          )}

          {plan && !planLoading && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{plan.subscription.plan.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Estado</span>
                <span className="font-medium capitalize">{plan.subscription.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">RFCs permitidos</span>
                <span className="font-medium">
                  {plan.subscription.plan.key === "FORENSIC_AUDITOR"
                    ? "Ilimitados"
                    : plan.subscription.plan.maxRfcProfiles}
                </span>
              </div>
              {plan.subscription.stripeSubscriptionId && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Suscripción Stripe</span>
                  <span className="font-mono text-xs">{plan.subscription.stripeSubscriptionId}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {user.role === "SUPER_ADMIN" && (
          <button
            onClick={() => navigate("/admin/stripe-webhook")}
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
          >
            Webhook Stripe
          </button>
        )}

        <button
          onClick={() => navigate("/plans")}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
        >
          Ver planes
        </button>

        <button
          onClick={() => {
            localStorage.removeItem("accessToken");
            navigate("/login");
          }}
          className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
