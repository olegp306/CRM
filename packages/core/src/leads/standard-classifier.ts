import { lookupPriceTableRow, type PriceTableRow } from "../pricing/price-table";

export type LeadStandardnessInput = {
  requestType?: string | null;
  bgfM2?: number | null;
  priceTableRows?: readonly PriceTableRow[];
};

export type LeadStandardness =
  | {
      isStandard: true;
      reason: "standard_price_table_match";
    }
  | {
      isStandard: false;
      reason: "missing_bgf" | "bgf_out_of_standard_range" | "unsupported_request_type";
    };

const defaultStandardPriceRows: PriceTableRow[] = [
  { bgfFromM2: 100, bgfToM2: 149, netEur: 12500, grossEur: 14875 },
  { bgfFromM2: 150, bgfToM2: 199, netEur: 16500, grossEur: 19635 },
  { bgfFromM2: 200, bgfToM2: 254, netEur: 21500, grossEur: 25585 }
];

export function classifyLeadStandardness({
  requestType,
  bgfM2,
  priceTableRows = defaultStandardPriceRows
}: LeadStandardnessInput): LeadStandardness {
  if (requestType !== "new_build") {
    return {
      isStandard: false,
      reason: "unsupported_request_type"
    };
  }

  if (typeof bgfM2 !== "number") {
    return {
      isStandard: false,
      reason: "missing_bgf"
    };
  }

  if (!lookupPriceTableRow(priceTableRows, bgfM2)) {
    return {
      isStandard: false,
      reason: "bgf_out_of_standard_range"
    };
  }

  return {
    isStandard: true,
    reason: "standard_price_table_match"
  };
}
