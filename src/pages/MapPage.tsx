import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Group, Image, Select, Stack, Text, Title } from '@mantine/core';
import { MapPin } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { resolveLocationFromCepAddress, isWithinRegion } from '../lib/location';
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
type GeocodeCache = Record<string, { lat: number; lng: number }>;

const GEOCODE_CACHE_KEY = 'aluga_geocode_cache_v2';

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

const locationCacheKey = (property: Property): string => {
  const cep = property.location.cep || '';
  const address = property.location.addressText.trim().toLowerCase();
  return `${cep}|${address}`;
};

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
        const existingLat = property.location.lat;
        const existingLng = property.location.lng;
        if (typeof existingLat === 'number' && typeof existingLng === 'number') {
          points.push({ property, lat: existingLat, lng: existingLng });
          continue;
        }

        if (!property.location.addressText.trim() && !(property.location.cep || '').trim()) continue;

        const key = locationCacheKey(property);
        const cached = cache[key];
        if (cached && isWithinRegion(cached.lat, cached.lng)) {
          points.push({ property, lat: cached.lat, lng: cached.lng });
          continue;
        }

        const resolved = await resolveLocationFromCepAddress(property.location.cep || '', property.location.addressText);
        if (resolved.lat === null || resolved.lng === null) continue;

        cache[key] = { lat: resolved.lat, lng: resolved.lng };
        cacheChanged = true;
        points.push({ property, lat: resolved.lat, lng: resolved.lng });
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
  }, [properties]);

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
    <Stack gap="md" py="md" className="map-page-stack">
      <Card withBorder radius="xl" p="lg">
        <Stack gap="xs">
          <Title order={2}>Mapa</Title>
          <Text c="dimmed">Encontre casas perto de voce e abra os detalhes para reservar.</Text>
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
        </Group>
      </Card>

      {loading ? <Text c="dimmed">Carregando casas...</Text> : null}
      {resolvingPoints && !loading ? <Text c="dimmed">Posicionando casas pelo endereco...</Text> : null}
      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Card withBorder radius="xl" p="xs" className="map-card map-page-map-card">
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
                <Stack gap={8} miw={220} className="map-popup-card">
                  <Image
                    src={property.photos[0] || '/background.png'}
                    alt={property.title}
                    className="map-popup-image"
                    radius="sm"
                  />
                  <Text fw={700} size="sm">
                    {property.title}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {property.location.addressText || 'Rio Grande - RS'}
                  </Text>
                  <Text size="sm">
                    {formatMoney(property.price)} - {property.rent_type}
                  </Text>
                  <Button component="a" href={`/app/property/${property.id}`} size="xs" radius="md">
                    Reservar
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
