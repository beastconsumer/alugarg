import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Group, Select, Stack, Text, Title } from '@mantine/core';
import { ExternalLink, MapPin, RotateCcw } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { seedProperties } from '../lib/seedProperties';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { parseProperty, Property } from '../lib/types';

type LocationKey = 'cassino' | 'riogrande';

interface MapPoint {
  property: Property;
  lat: number;
  lng: number;
}

interface GeocodeValue {
  lat: number;
  lng: number;
}

interface NominatimRow {
  lat: string;
  lon: string;
  display_name: string;
}

type GeocodeCache = Record<string, GeocodeValue>;

const GEOCODE_CACHE_KEY = 'aluga_geocode_cache_v2';

// Region around Rio Grande + Cassino to avoid wrong matches from other states/cities.
const REGION_BOUNDS = {
  north: -31.85,
  south: -32.40,
  west: -52.42,
  east: -51.88,
};

const locationOptions: Record<LocationKey, { label: string; lat: number; lng: number; zoom: number }> = {
  cassino: {
    label: 'Cassino (Rio Grande - RS)',
    lat: -32.1877,
    lng: -52.1632,
    zoom: 13,
  },
  riogrande: {
    label: 'Centro de Rio Grande - RS',
    lat: -32.035,
    lng: -52.0986,
    zoom: 12,
  },
};

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41],
});

const homeIcon = L.divIcon({
  html: '<div class="home-pin"></div>',
  className: 'home-pin-wrap',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const normalizeAddressKey = (address: string): string => address.trim().toLowerCase();

const loadCache = (): GeocodeCache => {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GeocodeCache;
  } catch {
    return {};
  }
};

const saveCache = (cache: GeocodeCache) => {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore localStorage write errors
  }
};

const isWithinRegion = (lat: number, lng: number): boolean => {
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

const geocodeAddress = async (address: string): Promise<GeocodeValue | null> => {
  const viewbox = `${REGION_BOUNDS.west},${REGION_BOUNDS.north},${REGION_BOUNDS.east},${REGION_BOUNDS.south}`;
  const queries = [
    `${address}, Balneario Cassino, Rio Grande, RS, Brasil`,
    `${address}, Rio Grande, RS, Brasil`,
  ];

  let best: { score: number; lat: number; lng: number } | null = null;

  for (const q of queries) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'br',
      bounded: '1',
      viewbox,
      q,
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

    // Small delay to respect Nominatim rate limits in sequence calls.
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  if (!best) return null;
  return { lat: best.lat, lng: best.lng };
};

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);

  return null;
}

export function MapPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingPoints, setResolvingPoints] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationKey>('cassino');
  const [geocodeVersion, setGeocodeVersion] = useState(0);

  const reloadWithFreshGeocode = () => {
    localStorage.removeItem(GEOCODE_CACHE_KEY);
    setGeocodeVersion((value) => value + 1);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const dbProperties = (data ?? []).map((row) => parseProperty(row));
        const merged = [...seedProperties, ...dbProperties];
        const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values());
        setProperties(deduped);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar mapa');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setResolvingPoints(true);
      const cache = loadCache();
      let cacheChanged = false;
      const points: MapPoint[] = [];

      for (const property of properties) {
        const address = property.location.addressText.trim();
        if (!address) continue;

        const key = normalizeAddressKey(address);
        const cached = cache[key];
        if (cached && isWithinRegion(cached.lat, cached.lng)) {
          points.push({ property, lat: cached.lat, lng: cached.lng });
          continue;
        }

        const geocoded = await geocodeAddress(address);
        if (!geocoded) continue;

        cache[key] = geocoded;
        cacheChanged = true;
        points.push({ property, lat: geocoded.lat, lng: geocoded.lng });
      }

      if (cacheChanged) saveCache(cache);
      if (!mounted) return;

      setMapPoints(points);
      setResolvingPoints(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [properties, geocodeVersion]);

  const activeLocation = locationOptions[selectedLocation];

  const center = useMemo<[number, number]>(
    () => [activeLocation.lat, activeLocation.lng],
    [activeLocation.lat, activeLocation.lng],
  );

  const locationSelectData = useMemo(
    () => [
      { value: 'cassino', label: locationOptions.cassino.label },
      { value: 'riogrande', label: locationOptions.riogrande.label },
    ],
    [],
  );

  return (
    <Stack gap="md" py="md" pb={96}>
      <Card withBorder radius="xl" p="lg">
        <Stack gap="xs">
          <Title order={2}>Mapa</Title>
          <Text c="dimmed">Casas posicionadas automaticamente pelo endereco em Rio Grande/Cassino.</Text>
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg">
        <Group align="end" grow>
          <Select
            label="Minha localizacao"
            leftSection={<MapPin size={16} />}
            data={locationSelectData}
            value={selectedLocation}
            onChange={(value) => setSelectedLocation((value as LocationKey) || 'cassino')}
          />

          <Button
            variant="default"
            leftSection={<RotateCcw size={16} />}
            onClick={reloadWithFreshGeocode}
          >
            Recalibrar pins
          </Button>
        </Group>
      </Card>

      {loading ? <Text c="dimmed">Carregando casas...</Text> : null}
      {resolvingPoints && !loading ? <Text c="dimmed">Posicionando casas pelo endereco...</Text> : null}
      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Card withBorder radius="xl" p="xs" className="map-card">
        <MapContainer center={center} zoom={activeLocation.zoom} scrollWheelZoom className="leaflet-map">
          <RecenterMap center={center} zoom={activeLocation.zoom} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker position={center} icon={homeIcon}>
            <Popup>Sua localizacao base: {activeLocation.label}</Popup>
          </Marker>

          {mapPoints.map(({ property, lat, lng }) => (
            <Marker key={property.id} position={[lat, lng]} icon={defaultIcon}>
              <Popup>
                <Stack gap={6} miw={190}>
                  <Text fw={700} size="sm">
                    {property.title}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {property.location.addressText || 'Rio Grande - RS'}
                  </Text>
                  <Text size="sm">
                    {formatMoney(property.price)} - {property.rent_type}
                  </Text>
                  <Button
                    component="a"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      property.location.addressText || property.title,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    size="xs"
                    variant="light"
                    leftSection={<ExternalLink size={14} />}
                  >
                    Abrir
                  </Button>
                </Stack>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Card>

      {!loading && mapPoints.length === 0 ? (
        <Alert color="yellow">
          Nenhuma casa com endereco mapeavel no momento. Use enderecos completos para melhor precisao.
        </Alert>
      ) : null}
    </Stack>
  );
}
