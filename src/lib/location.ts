interface NominatimRow {
  lat: string;
  lon: string;
  display_name: string;
}

interface ViaCepRow {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

interface GeocodeValue {
  lat: number;
  lng: number;
}

export interface ResolvedLocation {
  lat: number | null;
  lng: number | null;
  addressText: string;
  cep: string;
}

export const REGION_BOUNDS = {
  north: -31.85,
  south: -32.4,
  west: -52.42,
  east: -51.88,
};

export const sanitizeCep = (value: string): string => value.replace(/\D/g, '').slice(0, 8);

export const formatCep = (value: string): string => {
  const digits = sanitizeCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const isValidCep = (value: string): boolean => /^\d{8}$/.test(sanitizeCep(value));

export const isWithinRegion = (lat: number, lng: number): boolean => {
  return (
    lat <= REGION_BOUNDS.north &&
    lat >= REGION_BOUNDS.south &&
    lng >= REGION_BOUNDS.west &&
    lng <= REGION_BOUNDS.east
  );
};

const scoreResult = (row: NominatimRow): number => {
  const name = row.display_name.toLowerCase();
  let score = 0;
  if (name.includes('rio grande')) score += 4;
  if (name.includes('cassino')) score += 3;
  if (name.includes('balneario')) score += 1;
  if (name.includes('rio grande do sul')) score += 1;
  return score;
};

const uniqueQueries = (queries: string[]): string[] => {
  const normalized = queries.map((query) => query.trim()).filter(Boolean);
  return Array.from(new Set(normalized));
};

const fetchViaCep = async (cep: string): Promise<ViaCepRow | null> => {
  if (!isValidCep(cep)) return null;

  const response = await fetch(`https://viacep.com.br/ws/${sanitizeCep(cep)}/json/`);
  if (!response.ok) return null;

  const json = (await response.json()) as ViaCepRow;
  if (json.erro) return null;

  return json;
};

const geocodeQueries = async (queries: string[]): Promise<GeocodeValue | null> => {
  const viewbox = `${REGION_BOUNDS.west},${REGION_BOUNDS.north},${REGION_BOUNDS.east},${REGION_BOUNDS.south}`;
  let best: { score: number; lat: number; lng: number } | null = null;

  for (const query of uniqueQueries(queries)) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'br',
      bounded: '1',
      viewbox,
      q: query,
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    if (!response.ok) continue;

    const rows = (await response.json()) as NominatimRow[];
    for (const row of rows) {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!isWithinRegion(lat, lng)) continue;

      const score = scoreResult(row);
      if (!best || score > best.score) {
        best = { score, lat, lng };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  if (!best) return null;
  return { lat: best.lat, lng: best.lng };
};

export const resolveLocationFromCepAddress = async (cepInput: string, addressInput: string): Promise<ResolvedLocation> => {
  const cep = sanitizeCep(cepInput);
  const address = addressInput.trim();
  const viaCep = await fetchViaCep(cep);

  const city = viaCep?.localidade || 'Rio Grande';
  const state = viaCep?.uf || 'RS';
  const bairro = viaCep?.bairro || '';
  const logradouro = viaCep?.logradouro || '';

  const fallbackAddress = [logradouro, bairro, `${city} - ${state}`].filter(Boolean).join(', ');
  const normalizedAddress = address || fallbackAddress;

  const geo = await geocodeQueries([
    `${address}, ${logradouro}, ${bairro}, ${city}, ${state}, Brasil`,
    `${logradouro}, ${bairro}, ${city}, ${state}, Brasil`,
    `${cep}, ${city}, ${state}, Brasil`,
    `${address}, ${city}, ${state}, Brasil`,
    `${address}, Balneario Cassino, Rio Grande, RS, Brasil`,
  ]);

  return {
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    addressText: normalizedAddress,
    cep,
  };
};
