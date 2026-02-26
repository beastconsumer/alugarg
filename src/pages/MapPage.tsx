import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Group, Select, Stack, Text, Title } from '@mantine/core';
import { MapPin, Star } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { resolveLocationFromCepAddress, isWithinRegion } from '../lib/location';
import { seedProperties } from '../lib/seedProperties';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { parseProperty, Property, rentTypeLabel } from '../lib/types';

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

// Keep default icon for cases where price is 0
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const homeIcon = L.divIcon({
  html: '<div class="home-pin"></div>',
  className: 'home-pin-wrap',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const getRating = (seed: string): string => {
  const total = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (4.6 + (total % 5) * 0.1).toFixed(1);
};

const getReviewCount = (seed: string): number => {
  const total = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 10 + (total % 90);
};

const createPriceMarker = (price: number): L.DivIcon =>
  L.divIcon({
    html: `<div class="map-price-pill">${formatMoney(price)}</div>`,
    className: 'map-price-marker-wrap',
    iconSize: [96, 28],
    iconAnchor: [48, 28],
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
      <Card withBorder radius="xl" p="lg" className="bookings-header-card">
        <Stack gap={4}>
          <Title order={2}>Mapa de Imoveis</Title>
          <Text c="dimmed" size="sm">Explore as acomodacoes no mapa e toque para ver detalhes e reservar.</Text>
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

      {loading || resolvingPoints ? (
        <div>
          <div className="map-loading-bar" />
          <Text size="xs" c="dimmed" mt={6}>
            {loading ? 'Carregando imoveis...' : 'Posicionando no mapa...'}
          </Text>
        </div>
      ) : null}
      {errorMessage ? <Alert color="red" radius="xl">{errorMessage}</Alert> : null}

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
            <Marker key={property.id} position={[lat, lng]} icon={createPriceMarker(property.price)}>
              <Popup className="map-popup-leaflet">
                <div className="map-popup-card">
                  <img
                    src={property.photos[0] || '/background.png'}
                    alt={property.title}
                    className="map-popup-image"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/background.png'; }}
                  />
                  <div className="map-popup-body">
                    <p className="map-popup-title">{property.title}</p>
                    <p className="map-popup-address">{property.location.addressText || 'Rio Grande - RS'}</p>

                    <div className="map-popup-rating-row">
                      <Star size={11} fill="#f59e0b" color="#f59e0b" />
                      <span className="map-popup-rating-val">{getRating(property.id)}</span>
                      <span className="map-popup-rating-count">({getReviewCount(property.id)} av.)</span>
                    </div>

                    <div className="map-popup-specs">
                      <span>{property.bedrooms} qto{property.bedrooms !== 1 ? 's' : ''}</span>
                      <span className="map-popup-dot">-</span>
                      <span>{property.bathrooms} ban.</span>
                      <span className="map-popup-dot">-</span>
                      <span>{property.guests_capacity} hosp.</span>
                      {property.pet_friendly ? (
                        <>
                          <span className="map-popup-dot">-</span>
                          <span>pets ok</span>
                        </>
                      ) : null}
                    </div>

                    <div className="map-popup-footer">
                      <div>
                        <span className="map-popup-price">{formatMoney(property.price)}</span>
                        <span className="map-popup-period"> {rentTypeLabel[property.rent_type]}</span>
                      </div>
                      <Button
                        component={Link}
                        to={`/app/property/${property.id}`}
                        size="xs"
                        radius="xl"
                        className="map-popup-open-btn"
                      >
                        Ver imovel
                      </Button>
                    </div>
                  </div>
                </div>
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
