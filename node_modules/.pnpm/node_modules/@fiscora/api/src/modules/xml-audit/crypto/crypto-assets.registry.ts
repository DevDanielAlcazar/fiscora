import type {
  CryptoAssetDefinition,
  CryptoValidationAssetType,
} from "./crypto-validation.types.js";

export const CRYPTO_ASSET_REGISTRY: CryptoAssetDefinition[] = [
  {
    key: "xslt-cfdi-40",
    type: "CFDI_CADENA_ORIGINAL_XSLT",
    displayName: "XSLT Cadena Original CFDI 4.0",
    localPath: "xsd/assets/xslt/cfdi/4.0/cadenaoriginal_4_0.xslt",
    configured: false,
    requiredFor: ["CFDI_ORIGINAL_CHAIN", "CFDI_SELLO"],
    notes: ["XSLT oficial SAT pendiente ser cargado localmente."],
  },
  {
    key: "xslt-tfd-11",
    type: "TFD_CADENA_ORIGINAL_XSLT",
    displayName: "XSLT Cadena Original TFD 1.1",
    localPath: "xsd/assets/xslt/tfd/1.1/cadenaoriginal_TFD_1_1.xslt",
    configured: false,
    requiredFor: ["TFD_ORIGINAL_CHAIN", "TFD_SELLO_SAT"],
    notes: ["XSLT oficial SAT pendiente ser cargado localmente."],
  },
  {
    key: "trust-sat",
    type: "TRUSTED_SAT_CERTIFICATE",
    displayName: "Trust Store Certificados SAT",
    localPath: "xsd/assets/trust/sat/",
    configured: false,
    requiredFor: ["TFD_CERTIFICATE_SAT"],
    notes: ["Trust store SAT pendiente ser cargado localmente."],
  },
  {
    key: "trust-pac",
    type: "TRUSTED_PAC_CERTIFICATE",
    displayName: "Trust Store Certificados PAC",
    localPath: "xsd/assets/trust/pac/",
    configured: false,
    requiredFor: ["PAC_RFC_PROVIDER"],
    notes: ["Trust store PAC pendiente ser cargado localmente."],
  },
];

export function getCryptoAsset(key: string): CryptoAssetDefinition | undefined {
  return CRYPTO_ASSET_REGISTRY.find((a) => a.key === key);
}

export function getConfiguredAssetCount(): number {
  return CRYPTO_ASSET_REGISTRY.filter((a) => a.configured).length;
}