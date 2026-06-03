export interface CurrentPlan {
  subscription: {
    status: string;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean | null;
    canceledAt: string | null;
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

export async function createPortalSession(token: string): Promise<string> {
  const res = await fetch("/api/billing/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 400) {
    throw new Error("No hay cliente Stripe asociado a esta organización.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al abrir el portal de pago");
  }

  const data = await res.json();
  return data.url as string;
}
