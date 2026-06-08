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
  status: string;
  bannedAt: string | null;
  bannedReason: string | null;
  deletedAt: string | null;
  deletedReason: string | null;
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

export async function updateUserStatus(
  token: string,
  userId: string,
  data: { status: "ACTIVE" | "BANNED"; reason?: string },
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/admin/users/${userId}/status`, {
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

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al cambiar estado del usuario");
  }

  return res.json();
}

export async function updateUser(
  token: string,
  userId: string,
  data: { name?: string; email?: string; organizationName?: string },
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/admin/users/${userId}`, {
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

  if (res.status === 409) {
    throw new Error("El email ya está registrado.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al actualizar usuario");
  }

  return res.json();
}

export async function deleteUser(
  token: string,
  userId: string,
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "No puedes eliminarte a ti mismo.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al eliminar usuario");
  }

  return res.json();
}

export interface AdminPlanEntry {
  key: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  currency: string;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  features: string[] | null;
  maxUsers: number;
  maxRfcProfiles: number;
  monthlyUsageLimit: number | null;
  isPublic: boolean;
}

export async function getAdminPlans(token: string): Promise<{ plans: AdminPlanEntry[] }> {
  const res = await fetch("/api/admin/plans", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al cargar planes");
  }

  return res.json();
}

export interface XmlAnalysisListItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  userId: string;
  userEmail: string;
  organizationId: string | null;
  organizationName: string | null;
  uuid: string | null;
  tipoComprobante: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  rfcReceptor: string | null;
  nombreReceptor: string | null;
  fecha: string | null;
  total: string | null;
  subtotal: string | null;
  moneda: string | null;
  version: string | null;
  serie: string | null;
  folio: string | null;
  riskLevel: string | null;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  hasBom: boolean;
  hasTechnicalNormalization: boolean;
  hasNormalizedXml: boolean;
  normalizedFilename: string | null;
  originalSha256: string | null;
  normalizedSha256: string | null;
  sourceType: string | null;
  sourceFilename: string | null;
  batchId: string | null;
  zipFilename: string | null;
  zipEntryName: string | null;
  zipEntryIndex: number | null;
}

export interface XmlAnalysisListResponse {
  items: XmlAnalysisListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface XmlAnalysisDetailResponse extends XmlAnalysisListItem {
  analysisJson: Record<string, unknown>;
}

export interface XmlAnalysesQuery {
  page?: number;
  pageSize?: number;
  riskLevel?: string;
  rfcEmisor?: string;
  rfcReceptor?: string;
  uuid?: string;
  tipoComprobante?: string;
  from?: string;
  to?: string;
}

export async function getXmlAnalyses(
  token: string,
  query: XmlAnalysesQuery = {},
): Promise<XmlAnalysisListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.riskLevel) params.set("riskLevel", query.riskLevel);
  if (query.rfcEmisor) params.set("rfcEmisor", query.rfcEmisor);
  if (query.rfcReceptor) params.set("rfcReceptor", query.rfcReceptor);
  if (query.uuid) params.set("uuid", query.uuid);
  if (query.tipoComprobante) params.set("tipoComprobante", query.tipoComprobante);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();

  const res = await fetch(`/api/admin/xml-analyses${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al consultar análisis XML");
  }

  return res.json();
}

export async function getXmlAnalysisDetail(token: string, id: string): Promise<XmlAnalysisDetailResponse> {
  const res = await fetch(`/api/admin/xml-analyses/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (res.status === 404) {
    throw new Error("Registro no encontrado.");
  }

  if (!res.ok) {
    throw new Error("Error al consultar detalle del análisis");
  }

  return res.json();
}

export async function exportXmlAnalyses(token: string, query: XmlAnalysesQuery = {}): Promise<Blob> {
  const params = new URLSearchParams();
  if (query.riskLevel) params.set("riskLevel", query.riskLevel);
  if (query.rfcEmisor) params.set("rfcEmisor", query.rfcEmisor);
  if (query.rfcReceptor) params.set("rfcReceptor", query.rfcReceptor);
  if (query.uuid) params.set("uuid", query.uuid);
  if (query.tipoComprobante) params.set("tipoComprobante", query.tipoComprobante);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();

  const res = await fetch(`/api/admin/xml-analyses/export${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al exportar análisis XML");
  }

  return res.blob();
}

export async function updateAdminPlan(
  token: string,
  planKey: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/admin/plans/${planKey}`, {
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

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al actualizar plan");
  }

  return res.json();
}
