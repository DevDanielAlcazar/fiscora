import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { getCurrentPlan, createPortalSession, type CurrentPlan } from "../api/billing";
import { getAvailableModules, type AvailableModule } from "../api/modules";
import { getCurrentUsage, type CurrentUsage } from "../api/usage";

interface UserInfo {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  unpaid: "Sin pago",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Incompleta expirada",
  paused: "Pausada",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const STATUS_ALERTS: Record<string, { class: string; message: string }> = {
  past_due: {
    class: "text-sm bg-yellow-500/10 text-yellow-600 rounded-lg px-4 py-3",
    message: "Tu pago está pendiente. Algunas funciones podrían limitarse.",
  },
  payment_failed: {
    class: "text-sm bg-red-500/10 text-red-600 rounded-lg px-4 py-3",
    message: "No pudimos procesar tu pago. Actualiza tu método de pago.",
  },
  canceled: {
    class: "text-sm bg-red-500/10 text-red-600 rounded-lg px-4 py-3",
    message: "Tu suscripción fue cancelada. Tu cuenta volvió al plan Essential.",
  },
  incomplete: {
    class: "text-sm bg-yellow-500/10 text-yellow-600 rounded-lg px-4 py-3",
    message: "Tu suscripción aún no está completa.",
  },
};

function statusAlertClass(status: string): string {
  return STATUS_ALERTS[status]?.class ?? "text-sm bg-muted rounded-lg px-4 py-3";
}

function statusAlertMessage(status: string): string {
  return STATUS_ALERTS[status]?.message ?? `Estado: ${status}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [modules, setModules] = useState<AvailableModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState("");
  const [usage, setUsage] = useState<CurrentUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [portalError, setPortalError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);

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

          setUsageLoading(true);
          getCurrentUsage(token)
            .then(setUsage)
            .catch((err) => {
              setUsageError(err instanceof Error ? err.message : "Error desconocido");
            })
            .finally(() => setUsageLoading(false));
        }

        setModulesLoading(true);
        getAvailableModules(token)
          .then(setModules)
          .catch((err) => {
            setModulesError(err instanceof Error ? err.message : "Error desconocido");
          })
          .finally(() => setModulesLoading(false));
      })
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handlePortal() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setPortalError("");
    setPortalLoading(true);
    try {
      const url = await createPortalSession(token);
      window.location.href = url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setPortalLoading(false);
    }
  }

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
                <span className="font-medium">{statusLabel(plan.subscription.status)}</span>
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
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Suscripción Stripe</span>
                  <span className="font-mono text-xs">{plan.subscription.stripeSubscriptionId}</span>
                </div>
              )}
              {plan.subscription.currentPeriodEnd && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Fin del periodo actual</span>
                  <span className="font-medium">
                    {new Date(plan.subscription.currentPeriodEnd).toLocaleDateString("es-MX")}
                  </span>
                </div>
              )}

              {plan.subscription.stripeSubscriptionId && (
                <div className="pt-2">
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {portalLoading ? "Abriendo portal..." : "Administrar suscripción"}
                  </button>
                  {portalError && (
                    <p className="text-xs text-red-500 mt-1">{portalError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {plan && !planLoading && plan.subscription.status !== "active" && (
            <div className={statusAlertClass(plan.subscription.status)}>
              {statusAlertMessage(plan.subscription.status)}
            </div>
          )}

          {plan && !planLoading && plan.subscription.cancelAtPeriodEnd && (
            <div className="text-sm bg-yellow-500/10 text-yellow-600 rounded-lg px-4 py-3 space-y-1">
              <p>Tu suscripción está programada para cancelarse al finalizar el periodo actual.</p>
              {plan.subscription.currentPeriodEnd && (
                <p className="text-xs">
                  Acceso disponible hasta:{" "}
                  {new Date(plan.subscription.currentPeriodEnd).toLocaleDateString("es-MX")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="font-semibold text-lg">Uso mensual</h2>

          {usageLoading && (
            <p className="text-sm text-muted-foreground">Cargando uso mensual...</p>
          )}

          {usageError && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">
              {usageError}
            </p>
          )}

          {!user.organizationId && !usageLoading && (
            <p className="text-sm text-muted-foreground">
              Sin organización asociada. No hay uso disponible.
            </p>
          )}

          {usage && !usageLoading && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Usos</span>
                <span className="font-medium">
                  {usage.usage.unlimited ? "Ilimitado" : usage.usage.used}
                </span>
              </div>
              {!usage.usage.unlimited && (
                <>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Límite mensual</span>
                    <span className="font-medium">{usage.usage.limit}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Restantes</span>
                    <span className="font-medium">{usage.usage.remaining}</span>
                  </div>
                </>
              )}
              <div className="pt-1 text-xs text-muted-foreground">
                Período: {new Date(usage.period.from).toLocaleDateString("es-MX")} —{" "}
                {new Date(usage.period.to).toLocaleDateString("es-MX")}
              </div>
            </div>
          )}

          {usage && !usageLoading && !usage.usage.unlimited && (usage.usage.remaining ?? 0) <= 3 && (
            <div
              className={`text-sm rounded-lg px-4 py-3 ${
                (usage.usage.remaining ?? 0) === 0
                  ? "bg-red-500/10 text-red-600"
                  : "bg-yellow-500/10 text-yellow-600"
              }`}
            >
              {(usage.usage.remaining ?? 0) === 0
                ? "Has alcanzado tu límite mensual."
                : "Estás cerca de alcanzar tu límite mensual."}
            </div>
          )}
        </div>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="font-semibold text-lg">Módulos disponibles</h2>

          {modulesLoading && (
            <p className="text-sm text-muted-foreground">Cargando módulos...</p>
          )}

          {modulesError && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">
              {modulesError}
            </p>
          )}

          {!modulesLoading && !modulesError && modules.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tienes módulos disponibles para tu plan actual.
            </p>
          )}

          {!modulesLoading && modules.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {modules.map((mod) => (
                <div
                  key={mod.key}
                  onClick={() => {
                    if (mod.key === "AUDITORIA_XML") navigate("/modules/xml-audit");
                    else if (mod.key === "LABORAL") navigate("/modules/labor");
                  }}
                  className={`p-4 rounded-lg border border-border/50 bg-muted/30 space-y-2 ${
                    mod.key === "AUDITORIA_XML" || mod.key === "LABORAL"
                      ? "cursor-pointer hover:bg-muted/50 transition-colors"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{mod.name}</span>
                    {mod.key.startsWith("ADMIN_") && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">
                        Admin
                      </span>
                    )}
                    {mod.beta && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
                        Beta
                      </span>
                    )}
                  </div>
                  {mod.description && (
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {mod.allowSingleXml && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                        XML individual
                      </span>
                    )}
                    {mod.allowZip && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                        ZIP
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {user.role === "SUPER_ADMIN" && (
          <>
            <button
              onClick={() => navigate("/admin/stripe-webhook")}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              Webhook Stripe
            </button>
            <button
              onClick={() => navigate("/admin/modules")}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              Permisos de módulos
            </button>
            <button
              onClick={() => navigate("/admin/users")}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              Usuarios
            </button>
            <button
              onClick={() => navigate("/admin/plans")}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              Costos y planes
            </button>
          </>
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
