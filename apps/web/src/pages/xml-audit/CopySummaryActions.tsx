import { useState } from "react";
import { copyTextToClipboard } from "./shareSummary.helpers";

interface CopySummaryActionsProps {
  mode: "individual" | "history-detail" | "zip";
  generateSummaryText: () => string;
  generateSupportText: () => string;
  compact?: boolean;
}

export default function CopySummaryActions({
  mode,
  generateSummaryText,
  generateSupportText,
  compact,
}: CopySummaryActionsProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function handleCopy(text: string, type: string) {
    try {
      await copyTextToClipboard(text);
      setCopyStatus(`${type} copiado al portapapeles.`);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
      // Fallback: simple alert or prompt if clipboard fails
      alert("No se pudo copiar. Selecciona manualmente el texto:\n\n" + text);
    }
  }

  const labelSummary = mode === "zip" ? "Copiar resumen ZIP" : "Copiar resumen ejecutivo";
  const labelSupport =
    mode === "zip" ? "Copiar mensaje soporte ZIP" : "Copiar mensaje para soporte";

  return (
    <div className={`flex gap-2 ${compact ? "flex-col" : "items-center"}`}>
      <button
        onClick={() => handleCopy(generateSummaryText(), "Resumen")}
        className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
      >
        {labelSummary}
      </button>
      <button
        onClick={() => handleCopy(generateSupportText(), "Mensaje soporte")}
        className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
      >
        {labelSupport}
      </button>
      {copyStatus && (
        <span className="text-[10px] text-green-500 font-bold animate-pulse">{copyStatus}</span>
      )}
    </div>
  );
}
