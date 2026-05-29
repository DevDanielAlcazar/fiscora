export interface StripeWebhookStatus {
  webhookUrl: string;
  fullWebhookUrl: string;
  lastEvent: {
    id: string;
    stripeEventId: string;
    type: string;
    status: string;
    receivedAt: string;
  } | null;
  totalEventsLast24h: number;
  failedEventsLast24h: number;
}

export async function getStripeWebhookStatus(token: string): Promise<StripeWebhookStatus> {
  const res = await fetch("/api/admin/stripe-webhook/status", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al consultar estado del webhook");
  }

  return res.json();
}
