import { ESSENTIAL, PROFESSIONAL, CORPORATION, FORENSIC_AUDITOR, AUDITORIA_XML, LABORAL } from "./constants.js";
export type UserRole = "SUPER_ADMIN" | "ORG_ADMIN" | "ORG_USER" | "EXTERNAL_AUDITOR";
export type PlanKey = typeof ESSENTIAL | typeof PROFESSIONAL | typeof CORPORATION | typeof FORENSIC_AUDITOR;
export type ModuleKey = typeof AUDITORIA_XML | typeof LABORAL;
export type AccountType = "PHYSICAL_PERSON" | "MORAL_PERSON";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired";
//# sourceMappingURL=types.d.ts.map