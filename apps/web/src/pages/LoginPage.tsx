import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/auth";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email, password);
      localStorage.setItem("accessToken", data.accessToken);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">FISCORA</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              placeholder="tu@correo.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
