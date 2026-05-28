import { z } from "zod";
export declare const rfcSchema: z.ZodString;
export declare const xmlUploadMetadataSchema: z.ZodObject<{
    organizationId: z.ZodString;
    rfc: z.ZodString;
    period: z.ZodString;
    fileCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    rfc: string;
    period: string;
    fileCount: number;
}, {
    organizationId: string;
    rfc: string;
    period: string;
    fileCount: number;
}>;
export type XmlUploadMetadataInput = z.infer<typeof xmlUploadMetadataSchema>;
//# sourceMappingURL=tax.d.ts.map