import type {
  XsdSchemaDefinition,
  XsdValidationResult,
  XsdValidationStatus,
} from "./xsd-validation.types.js";

export interface XsdValidationAdapter {
  name: string;
  available(): boolean;
  validate(
    _xml: string,
    _schema: XsdSchemaDefinition,
  ): XsdValidationResult | Promise<XsdValidationResult>;
}

export const UnavailableXsdValidationAdapter: XsdValidationAdapter = {
  name: "UnavailableXsdValidationAdapter",

  available(): boolean {
    return false;
  },

  validate(_xml: string, schema: XsdSchemaDefinition): XsdValidationResult {
    return {
      status: "NOT_CONFIGURED",
      schemaKey: schema.key,
      schemaName: schema.displayName,
      configured: schema.configured,
      validated: false,
      issues: [],
      notes: ["Validación XSD no configurada: requiere esquemas XSD oficiales locales y adaptador de validación."],
    };
  },
};

export const XSD_ADAPTER: XsdValidationAdapter = UnavailableXsdValidationAdapter;