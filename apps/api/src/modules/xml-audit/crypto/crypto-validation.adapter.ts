import type {
  CryptoValidationSummary,
  CryptoValidationStatus,
  CryptoValidationCheckKey,
} from "./crypto-validation.types.js";
import { CRYPTO_ASSET_REGISTRY } from "./crypto-assets.registry.js";

export interface CryptoValidationAdapter {
  name: string;
  available(): boolean;
  canGenerateOriginalChain(): boolean;
  canVerifySignature(): boolean;
  validate(_params: unknown): CryptoValidationSummary | Promise<CryptoValidationSummary>;
}

export const UnavailableCryptoValidationAdapter: CryptoValidationAdapter = {
  name: "UnavailableCryptoValidationAdapter",

  available(): boolean {
    return false;
  },

  canGenerateOriginalChain(): boolean {
    return false;
  },

  canVerifySignature(): boolean {
    return false;
  },

  validate(): CryptoValidationSummary {
    const configuredAssets = CRYPTO_ASSET_REGISTRY.filter((a) => a.configured).length;
    const requiredAssets = CRYPTO_ASSET_REGISTRY.map((a) => a.key);

    return {
      enabled: false,
      status: "NOT_CONFIGURED",
      adapterName: this.name,
      configuredAssets,
      requiredAssets,
      checks: [],
      notes: ["Validación criptográfica no configurada: requiere XSLT oficiales locales y trust store."],
    };
  },
};

export const CRYPTO_ADAPTER: CryptoValidationAdapter = UnavailableCryptoValidationAdapter;