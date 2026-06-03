export interface AnalysisResult {
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
  usoCfdi: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  fechaTimbrado: string | null;
  totalImpuestosTrasladados: string | null;
  totalImpuestosRetenidos: string | null;
  issues: string[];
  warnings: string[];
}

export interface AnalyzeResponse {
  ok: boolean;
  analysis: AnalysisResult;
}

export async function analyzeXml(token: string, file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/modules/xml-audit/analyze", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      FILE_REQUIRED: "Selecciona un archivo XML.",
      INVALID_FILE_TYPE: "Solo se permiten archivos XML.",
      FILE_TOO_LARGE: "El archivo supera el límite de 5 MB.",
      XML_INVALID: "El XML no es válido o no pudo leerse.",
    };
    throw new Error(messages[code] ?? "No fue posible analizar el XML.");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      MODULE_NOT_ALLOWED: "Tu plan no tiene acceso a este módulo.",
      USAGE_LIMIT_EXCEEDED: "Has alcanzado el límite mensual de usos de tu plan.",
    };
    throw new Error(messages[code] ?? "No tienes permiso para usar este módulo.");
  }

  if (!res.ok) {
    throw new Error("No fue posible analizar el XML.");
  }

  const data: AnalyzeResponse = await res.json();
  return data.analysis;
}
