import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";

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

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      navigate("/login");
      return;
    }

    getMe(token)
      .then(setUser)
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
      </div>
    </div>
  );
}
