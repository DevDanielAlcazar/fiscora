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

export interface PlanModuleAccessEntry {
  id: string;
  plan: { id: string; key: string; name: string };
  module: { id: string; key: string; name: string; description: string | null };
  enabled: boolean;
  adminOnly: boolean;
  beta: boolean;
  consumesUsage: boolean;
  allowSingleXml: boolean;
  allowZip: boolean;
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

export async function getModuleAccessMatrix(token: string): Promise<PlanModuleAccessEntry[]> {
  const res = await fetch("/api/admin/modules/access", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al consultar matriz de acceso");
  }

  return res.json();
}

export async function updateModuleAccess(
  token: string,
  id: string,
  data: Partial<{
    enabled: boolean;
    adminOnly: boolean;
    beta: boolean;
    consumesUsage: boolean;
    allowSingleXml: boolean;
    allowZip: boolean;
  }>,
): Promise<PlanModuleAccessEntry> {
  const res = await fetch(`/api/admin/modules/access/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (res.status === 404) {
    throw new Error("El registro de acceso no existe.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al actualizar acceso");
  }

  return res.json();
}

export interface UserEntry {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    accountType: string | null;
    stripeCustomerId: string | null;
    subscription: {
      id: string;
      status: string;
      stripeSubscriptionId: string | null;
      plan: { key: string; name: string };
    } | null;
  } | null;
}

export async function getUsers(token: string): Promise<UserEntry[]> {
  const res = await fetch("/api/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al consultar usuarios");
  }

  return res.json();
}

export async function updateUserPlan(
  token: string,
  userId: string,
  planKey: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/admin/users/${userId}/plan`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planKey }),
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al cambiar plan");
  }

  return res.json();
}
