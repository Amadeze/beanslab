// Normalized RajaOngkir domain types.
// Provider response shapes are NEVER leaked outside this boundary.

export interface RajaOngkirDestination {
  providerId: string;
  label: string;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
}

export interface RajaOngkirRateService {
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName?: string;
  description?: string;
  cost: number;
  etd?: string;
}

export interface RajaOngkirWaybillSummary {
  awb: string;
  courier: string;
  status?: string;
  delivered?: boolean;
}

export interface RajaOngkirDestinationQueryOptions {
  limit?: number;
  offset?: number;
  fetchImpl?: typeof fetch;
}

export interface RajaOngkirCostInput {
  origin: string;
  destination: string;
  weight: number; // grams
  courier: string;
  price?: number;
}

export interface RajaOngkirTrackInput {
  awb: string;
  courier: string;
  lastPhoneNumber?: string;
}

export const RAJAONGKIR_DESTINATION_MIN_QUERY = 3;
export const RAJAONGKIR_DEFAULT_DESTINATION_LIMIT = 20;
export const RAJAONGKIR_MAX_DESTINATION_LIMIT = 100;
export const RAJAONGKIR_TARE_MAX_GRAMS = 50_000;
