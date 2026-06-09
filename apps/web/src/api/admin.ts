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
  analysisStatus: string;
  errorCode: string | null;
  errorMessage: string | null;
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
  analysisStatus?: string;
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
  if (query.analysisStatus) params.set("analysisStatus", query.analysisStatus);
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
  if (query.analysisStatus) params.set("analysisStatus", query.analysisStatus);
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

export interface XmlAnalysisBatchListItem {
  batchId: string;
  zipFilename: string;
  createdAtFirst: string;
  createdAtLast: string;
  expiresAt: string;
  userId: string;
  userEmail: string;
  organizationId: string | null;
  organizationName: string | null;
  totalRecords: number;
  analyzedCount: number;
  failedCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  okCount: number;
  recordsWithBom: number;
  recordsWithNormalization: number;
  recordsWithNormalizedXml: number;
  tiposComprobante: Record<string, number>;
}

export interface XmlAnalysisBatchListResponse {
  items: XmlAnalysisBatchListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface XmlAnalysisBatchDetailRecord {
  id: string;
  createdAt: string;
  expiresAt: string;
  analysisStatus: string;
  errorCode: string | null;
  errorMessage: string | null;
  zipEntryName: string | null;
  zipEntryIndex: number | null;
  uuid: string | null;
  tipoComprobante: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  rfcReceptor: string | null;
  nombreReceptor: string | null;
  fecha: string | null;
  subtotal: string | null;
  total: string | null;
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
}

export interface XmlAnalysisBatchDetailResponse {
  batch: XmlAnalysisBatchListItem;
  records: XmlAnalysisBatchDetailRecord[];
}

export interface XmlAnalysisBatchQuery {
  page?: number;
  pageSize?: number;
  batchId?: string;
  zipFilename?: string;
  userEmail?: string;
  organizationName?: string;
  from?: string;
  to?: string;
  hasFailed?: string;
  hasCritical?: string;
}

export async function getXmlAnalysisBatches(
  token: string,
  query: XmlAnalysisBatchQuery = {},
): Promise<XmlAnalysisBatchListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.batchId) params.set("batchId", query.batchId);
  if (query.zipFilename) params.set("zipFilename", query.zipFilename);
  if (query.userEmail) params.set("userEmail", query.userEmail);
  if (query.organizationName) params.set("organizationName", query.organizationName);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.hasFailed) params.set("hasFailed", query.hasFailed);
  if (query.hasCritical) params.set("hasCritical", query.hasCritical);
  const qs = params.toString();

  const res = await fetch(`/api/admin/xml-analysis-batches${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al consultar lotes ZIP");
  }

  return res.json();
}

export async function exportXmlAnalysisBatches(
  token: string,
  query: XmlAnalysisBatchQuery = {},
): Promise<Blob> {
  const params = new URLSearchParams();
  if (query.batchId) params.set("batchId", query.batchId);
  if (query.zipFilename) params.set("zipFilename", query.zipFilename);
  if (query.userEmail) params.set("userEmail", query.userEmail);
  if (query.organizationName) params.set("organizationName", query.organizationName);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.hasFailed) params.set("hasFailed", query.hasFailed);
  if (query.hasCritical) params.set("hasCritical", query.hasCritical);
  const qs = params.toString();

  const res = await fetch(`/api/admin/xml-analysis-batches/export${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("No fue posible exportar los lotes. Intenta nuevamente.");
  }

  return res.blob();
}

export async function exportXmlAnalysisBatchDetail(token: string, batchId: string): Promise<Blob> {
  const res = await fetch(`/api/admin/xml-analysis-batches/${encodeURIComponent(batchId)}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (res.status === 404) {
    throw new Error("El lote seleccionado ya no existe o expiró.");
  }

  if (!res.ok) {
    throw new Error("No fue posible exportar el lote. Intenta nuevamente.");
  }

  return res.blob();
}

export interface XmlAnalyticsQuery {
  from?: string;
  to?: string;
  organizationId?: string;
  userId?: string;
  sourceType?: string;
  analysisStatus?: string;
}

export interface XmlAnalyticsSummary {
  range: { from: string | null; to: string | null };
  totals: {
    records: number;
    analyzed: number;
    failed: number;
    individual: number;
    zip: number;
    uniqueBatches: number;
    uniqueUsers: number;
    uniqueOrganizations: number;
  };
  risk: { critical: number; warning: number; ok: number; nullRisk: number };
  findings: { total: number; critical: number; warnings: number; info: number };
  technical: { withBom: number; withTechnicalNormalization: number; withNormalizedXml: number };
  byTipoComprobante: { tipoComprobante: string; count: number }[];
  bySourceType: { sourceType: string; count: number }[];
  byAnalysisStatus: { analysisStatus: string; count: number }[];
  topOrganizations: {
    organizationId: string;
    organizationName: string;
    records: number;
    failed: number;
    critical: number;
    withBom: number;
  }[];
  topUsers: {
    userId: string;
    userEmail: string;
    records: number;
    failed: number;
    critical: number;
    withBom: number;
  }[];
  recentBatches: {
    batchId: string;
    zipFilename: string;
    createdAt: string;
    organizationName: string | null;
    userEmail: string;
    totalRecords: number;
    failed: number;
    critical: number;
  }[];
}

export async function getXmlAnalyticsSummary(
  token: string,
  query: XmlAnalyticsQuery = {},
): Promise<XmlAnalyticsSummary> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.organizationId) params.set("organizationId", query.organizationId);
  if (query.userId) params.set("userId", query.userId);
  if (query.sourceType) params.set("sourceType", query.sourceType);
  if (query.analysisStatus) params.set("analysisStatus", query.analysisStatus);
  const qs = params.toString();

  const res = await fetch(`/api/admin/xml-analytics/summary${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (!res.ok) {
    throw new Error("Error al consultar analítica XML");
  }

  return res.json();
}

export async function getXmlAnalysisBatchDetail(token: string, batchId: string): Promise<XmlAnalysisBatchDetailResponse> {
  const res = await fetch(`/api/admin/xml-analysis-batches/${encodeURIComponent(batchId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error("No tienes permisos de administrador");
  }

  if (res.status === 404) {
    throw new Error("Lote ZIP no encontrado.");
  }

  if (!res.ok) {
    throw new Error("Error al consultar detalle del lote ZIP");
  }

  return res.json();
}
