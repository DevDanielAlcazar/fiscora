import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(12, { message: "La contraseña debe tener al menos 12 caracteres" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  organizationName: z
    .string()
    .min(2, { message: "El nombre de la organización debe tener al menos 2 caracteres" })
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
