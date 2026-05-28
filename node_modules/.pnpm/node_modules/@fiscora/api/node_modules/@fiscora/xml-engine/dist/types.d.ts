export type XmlDocumentType = "INGRESO" | "EGRESO" | "TRASLADO" | "NOMINA" | "PAGO";
export type XmlFindingSeverity = "INFO" | "WARNING" | "ERROR";
export interface XmlFinding {
    code: string;
    message: string;
    severity: XmlFindingSeverity;
    element?: string;
    value?: string;
}
export interface XmlAuditResult {
    uuid: string;
    isValid: boolean;
    documentType: XmlDocumentType;
    rfcEmisor: string;
    rfcReceptor: string;
    fecha: string;
    subTotal: number;
    total: number;
    findings: XmlFinding[];
    rawMetadata?: Record<string, any>;
}
//# sourceMappingURL=types.d.ts.map