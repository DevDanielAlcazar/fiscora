import { z } from "zod";
export const rfcSchema = z.string().regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i, {
    message: "Formato de RFC inválido (debe tener 12 o 13 caracteres alfanuméricos válidos)",
});
export const xmlUploadMetadataSchema = z.object({
    organizationId: z.string().uuid({ message: "ID de organización inválido" }),
    rfc: rfcSchema,
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
        message: "El periodo debe tener el formato AAAA-MM (ej. 2026-05)",
    }),
    fileCount: z
        .number()
        .int()
        .nonnegative({ message: "La cantidad de archivos debe ser un número entero no negativo" }),
});
//# sourceMappingURL=tax.js.map