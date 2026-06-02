export interface CurrentUsage {
  period: {
    from: string;
    to: string;
  };
  usage: {
    used: number;
    limit: number | null;
    remaining: number | null;
    unlimited: boolean;
  };
  plan: {
    key: string;
    name: string;
  };
}

export async function getCurrentUsage(token: string): Promise<CurrentUsage> {
  const res = await fetch("/api/usage/current", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al consultar uso mensual");
  }

  return res.json();
}
