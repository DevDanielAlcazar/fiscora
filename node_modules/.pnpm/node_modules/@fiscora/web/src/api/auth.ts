interface RegisterParams {
  name: string;
  email: string;
  password: string;
  accountType: "INDIVIDUAL" | "ORGANIZATION";
  organizationName?: string;
}

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface MeResponse {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

const API_BASE = "";

export async function register(params: RegisterParams): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? body?.message ?? "Error al registrar");
  }

  return res.json();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? body?.message ?? "Error al iniciar sesión");
  }

  return res.json();
}

export async function getMe(token: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("No autorizado");
  }

  return res.json();
}
