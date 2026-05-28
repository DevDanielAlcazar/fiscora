import { z } from "zod";
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const accountTypeSchema: z.ZodEnum<["INDIVIDUAL", "ORGANIZATION"]>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    accountType: z.ZodOptional<z.ZodEnum<["INDIVIDUAL", "ORGANIZATION"]>>;
    organizationName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    accountType?: "INDIVIDUAL" | "ORGANIZATION" | undefined;
    organizationName?: string | undefined;
}, {
    email: string;
    password: string;
    name: string;
    accountType?: "INDIVIDUAL" | "ORGANIZATION" | undefined;
    organizationName?: string | undefined;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
//# sourceMappingURL=auth.d.ts.map