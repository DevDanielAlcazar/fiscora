import { useNavigate } from "react-router-dom";

export default function BillingCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Pago cancelado</h1>
        <p className="text-sm text-muted-foreground">
          No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
