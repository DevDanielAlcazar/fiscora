import { useSearchParams, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Pago recibido</h1>
        <p className="text-sm text-muted-foreground">
          Tu suscripción se está activando. En unos momentos podrás usar todas las funciones.
        </p>
        {sessionId && (
          <p className="text-xs text-muted-foreground font-mono bg-muted rounded-lg px-3 py-2">
            Session: {sessionId}
          </p>
        )}
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
        >
          Ir al dashboard
        </button>
      </div>
    </div>
  );
}
