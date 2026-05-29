import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { getStripeWebhookStatus, type StripeWebhookStatus } from "../api/admin";

export default function AdminWebhookPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [status, setStatus] = useState<StripeWebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      navigate("/login");
      return;
    }

    getMe(token)
      .then((u) => {
        setUser(u);
        return getStripeWebhookStatus(token);
      })
      .then(setStatus)
      .catch((err) => {
        if (err.message === "No tienes permisos de administrador") {
          setError(err.message);
        } else {
          localStorage.removeItem("accessToken");
          navigate("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleCopyUrl() {
    if (!status?.fullWebhookUrl) return;
    try {
      await navigator.clipboard.writeText(status.fullWebhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = status.fullWebhookUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="p-6 rounded-xl border border-border bg-card max-w-md w-full text-center space-y-3">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-primary hover:underline"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Webhook Stripe</h1>

        {user && (
          <p className="text-sm text-muted-foreground">
            {user.email} — <span className="font-medium">{user.role}</span>
          </p>
        )}

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="font-semibold text-lg">Endpoint</h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">URL interna</span>
              <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {status.webhookUrl}
              </code>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">URL completa</span>
              <code className="font-mono text-xs bg-muted px-2 py-1 rounded break-all max-w-[300px] text-right">
                {status.fullWebhookUrl}
              </code>
            </div>
          </div>

          <button
            onClick={handleCopyUrl}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            {copied ? "¡Copiado!" : "Copiar URL"}
          </button>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="font-semibold text-lg">Estadísticas (últimas 24h)</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50 text-center">
              <p className="text-2xl font-bold">{status.totalEventsLast24h}</p>
              <p className="text-xs text-muted-foreground mt-1">Total eventos</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50 text-center">
              <p className="text-2xl font-bold text-red-500">{status.failedEventsLast24h}</p>
              <p className="text-xs text-muted-foreground mt-1">Fallidos</p>
            </div>
          </div>
        </div>

        {status.lastEvent && (
          <div className="p-6 rounded-xl border border-border bg-card space-y-4">
            <h2 className="font-semibold text-lg">Último evento</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">{status.lastEvent.stripeEventId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">{status.lastEvent.type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Estado</span>
                <span className="font-medium">{status.lastEvent.status}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Recibido</span>
                <span className="text-xs">
                  {new Date(status.lastEvent.receivedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {!status.lastEvent && (
          <div className="p-6 rounded-xl border border-border bg-card">
            <p className="text-sm text-muted-foreground text-center">
              No se han recibido eventos aún.
            </p>
          </div>
        )}

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
