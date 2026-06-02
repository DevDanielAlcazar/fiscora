export interface CurrentPlan {
  subscription: {
    status: string;
    stripeSubscriptionId: string | null;
    plan: {
      key: string;
      name: string;
      maxRfcProfiles: number;
      maxUsers: number;
    };
  };
}

export async function getCurrentPlan(token: string): Promise<CurrentPlan> {
  const res = await fetch("/api/billing/current-plan", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al consultar el plan actual");
  }

  return res.json();
}

export async function createCheckoutSession(
  token: string,
  planKey: string,
  billingCycle: string,
): Promise<string> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planKey, billingCycle }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al crear la sesión de pago");
  }

  const data = await res.json();
  return data.url as string;
}
