import { useState, useMemo } from "react";
import type { AnalysisResult, ZipFullAnalysisResult } from "../../api/xml-audit";
import {
  buildIndividualExecutiveSummary,
  buildZipExecutiveSummary,
  buildSupportMessage,
  formatIndividualExecutiveText,
  formatZipExecutiveText,
  downloadTextFile,
  sanitizeSummaryText,
} from "./executiveSummaryExport.helpers";
import { copyTextToClipboard } from "./shareSummary.helpers";

interface ExecutiveSummaryActionsProps {
  mode: "individual" | "zip" | "history-detail" | "dashboard" | "admin";
  result?: AnalysisResult;
  zipResult?: ZipFullAnalysisResult;
  filenamePrefix?: string;
  compact?: boolean;
}

export default function ExecutiveSummaryActions({
  mode,
  result,
  zipResult,
  filenamePrefix = "fiscora",
  compact,
}: ExecutiveSummaryActionsProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const isIndividual = mode === "individual" && result;
  const isZip = mode === "zip" && zipResult;

  const summary = useMemo(() => {
    if (isIndividual) {
      return buildIndividualExecutiveSummary(result!);
    }
    if (isZip) {
      return buildZipExecutiveSummary(zipResult!);
    }
    return null;
  }, [isIndividual, isZip, result, zipResult]);

  const supportMessage = useMemo(() => {
    if (isIndividual) {
      const s = buildIndividualExecutiveSummary(result!);
      return buildSupportMessage(result!, s);
    }
    return null;
  }, [isIndividual, result]);

  async function handleCopyExecutive(): Promise<void> {
    if (!summary) return;
    let text: string;
    if (isIndividual) {
      text = formatIndividualExecutiveText(summary as any);
    } else {
      text = formatZipExecutiveText(summary as any);
    }
    try {
      await copyTextToClipboard(sanitizeSummaryText(text));
      setCopyStatus("Resumen copiado");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Error al copiar");
    }
  }

  async function handleCopySupport(): Promise<void> {
    if (!supportMessage) return;
    try {
      await copyTextToClipboard(sanitizeSummaryText(supportMessage, 3000));
      setCopyStatus("Mensaje copiado");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Error al copiar");
    }
  }

  function handleDownloadTxt(): void {
    if (!summary) return;
    let text: string;
    if (isIndividual) {
      text = formatIndividualExecutiveText(summary as any);
    } else {
      text = formatZipExecutiveText(summary as any);
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${filenamePrefix}-resumen-ejecutivo-${ts}.txt`;
    downloadTextFile(filename, sanitizeSummaryText(text));
  }

  function handleDownloadMd(): void {
    if (!summary) return;
    let text: string;
    if (isIndividual) {
      text = formatIndividualExecutiveText(summary as any);
    } else {
      text = formatZipExecutiveText(summary as any);
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${filenamePrefix}-resumen-ejecutivo-${ts}.md`;
    downloadTextFile(filename, sanitizeSummaryText(text), "text/markdown");
  }

  if (!summary) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={handleCopyExecutive}
          className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
        >
          Copiar resumen
        </button>
        {supportMessage && (
          <button
            onClick={handleCopySupport}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
          >
            Copiar mensaje soporte
          </button>
        )}
        {copyStatus && (
          <span className="text-[10px] text-green-500 font-bold">{copyStatus}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        onClick={handleCopyExecutive}
        className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
      >
        Copiar resumen ejecutivo
      </button>
      {supportMessage && (
        <button
          onClick={handleCopySupport}
          className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
        >
          Copiar mensaje de soporte
        </button>
      )}
      <button
        onClick={handleDownloadTxt}
        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
      >
        Descargar TXT
      </button>
      <button
        onClick={handleDownloadMd}
        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
      >
        Descargar MD
      </button>
      {copyStatus && (
        <span className="text-[10px] text-green-500 font-bold">{copyStatus}</span>
      )}
    </div>
  );
}