import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { analyzeXml, type AnalysisResult } from "../api/xml-audit";

export default function XmlAuditPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    getMe(token)
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleAnalyze() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!selectedFile) {
      setError("Selecciona un archivo XML.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".xml")) {
      setError("Solo se permiten archivos XML.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("El archivo supera el límite de 5 MB.");
      return;
    }

    setError("");
    setResult(null);
    setAnalyzing(true);

    try {
      const analysis = await analyzeXml(token, selectedFile);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible analizar el XML.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult(null);
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Auditoría XML</h1>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <label className="block text-sm font-medium text-muted-foreground">
            Selecciona un archivo XML para analizar
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xml"
            onChange={handleFileChange}
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />

          <button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedFile}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {analyzing ? "Analizando XML..." : "Analizar XML"}
          </button>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
          )}
        </div>

        {result && (
          <div className="p-6 rounded-xl border border-border bg-card space-y-4">
            <h2 className="font-semibold text-lg">Resultado del análisis</h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50 col-span-2">
                <span className="text-muted-foreground">UUID</span>
                <span className="font-mono text-xs text-right max-w-[300px] break-all">{result.uuid ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Tipo de comprobante</span>
                <span className="font-medium">{result.tipoComprobante ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Versión CFDI</span>
                <span className="font-medium">{result.version ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">RFC emisor</span>
                <span className="font-medium">{result.rfcEmisor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Nombre emisor</span>
                <span className="font-medium">{result.nombreEmisor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">RFC receptor</span>
                <span className="font-medium">{result.rfcReceptor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Nombre receptor</span>
                <span className="font-medium">{result.nombreReceptor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-medium">{result.fecha ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{result.subtotal ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{result.total ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Moneda</span>
                <span className="font-medium">{result.moneda ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Serie</span>
                <span className="font-medium">{result.serie ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Folio</span>
                <span className="font-medium">{result.folio ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Uso CFDI</span>
                <span className="font-medium">{result.usoCfdi ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Método de pago</span>
                <span className="font-medium">{result.metodoPago ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Forma de pago</span>
                <span className="font-medium">{result.formaPago ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Fecha de timbrado</span>
                <span className="font-medium">{result.fechaTimbrado ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Total impuestos trasladados</span>
                <span className="font-medium">{result.totalImpuestosTrasladados ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Total impuestos retenidos</span>
                <span className="font-medium">{result.totalImpuestosRetenidos ?? "—"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Incidencias</h3>
              {result.issues.length > 0 ? (
                <ul className="space-y-1">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-red-500 flex items-center gap-2">
                      <span>⚠</span> {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-600">Sin incidencias detectadas</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Advertencias</h3>
              {result.warnings.length > 0 ? (
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-yellow-600 flex items-center gap-2">
                      <span>!</span> {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-600">Sin advertencias</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
