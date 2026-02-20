import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, Popover, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { DatePicker, type DatesRangeValue } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2,
  CalendarDays,
  Compass,
  LocateFixed,
  MapPinned,
  Minus,
  Plus,
  Search,
  Star,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PropertyCard } from '../components/PropertyCard';
import { seedProperties } from '../lib/seedProperties';
import { supabase } from '../lib/supabase';
import { parseProperty, Property } from '../lib/types';

type GuestState = {
  adults: number;
  children: number;
  babies: number;
  pets: number;
};

type NearbyOption = {
  key: string;
  label: string;
  hint: string;
  value: string;
  icon: LucideIcon;
};

const nearbyOptions: NearbyOption[] = [
  {
    key: 'nearby',
    label: 'Perto de voce',
    hint: 'Busca por localizacao atual',
    value: 'Perto de voce',
    icon: LocateFixed,
  },
  {
    key: 'cassino',
    label: 'Cassino',
    hint: 'Rio Grande - RS',
    value: 'Cassino, Rio Grande do Sul',
    icon: MapPinned,
  },
  {
    key: 'riogrande',
    label: 'Rio Grande',
    hint: 'Centro e bairros proximos',
    value: 'Rio Grande, Rio Grande do Sul',
    icon: Building2,
  },
  {
    key: 'pelotas',
    label: 'Pelotas',
    hint: 'Opcao proxima ao Cassino',
    value: 'Pelotas, Rio Grande do Sul',
    icon: Compass,
  },
];

const formatDateRange = (value: DatesRangeValue): string => {
  if (!value[0] && !value[1]) {
    return 'Escolha as datas';
  }

  if (value[0] && !value[1]) {
    return format(value[0], 'dd MMM', { locale: ptBR });
  }

  if (value[0] && value[1]) {
    return `${format(value[0], 'dd MMM', { locale: ptBR })} - ${format(value[1], 'dd MMM', { locale: ptBR })}`;
  }

  return 'Escolha as datas';
};

const distanceInKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const p =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return radius * (2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p)));
};

export function HomePage() {
  const isMobile = useMediaQuery('(max-width: 900px)');

  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [dateRange, setDateRange] = useState<DatesRangeValue>([null, null]);
  const [guests, setGuests] = useState<GuestState>({
    adults: 0,
    children: 0,
    babies: 0,
    pets: 0,
  });

  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [useNearbyMode, setUseNearbyMode] = useState(false);
  const [locating, setLocating] = useState(false);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadApprovedProperties = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(120);

      if (error) throw error;
      const dbProperties = (data ?? []).map((row) => parseProperty(row));
      const merged = [...seedProperties, ...dbProperties];
      const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values());
      setAllProperties(deduped);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApprovedProperties();

    const channel = supabase
      .channel('home-approved-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          void loadApprovedProperties();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const totalGuests = guests.adults + guests.children;

  const whoLabel = useMemo(() => {
    if (totalGuests <= 0 && guests.pets <= 0) return 'Quem vai?';
    if (totalGuests > 0 && guests.pets > 0) return `${totalGuests} hospedes + ${guests.pets} pet`;
    if (totalGuests > 0) return `${totalGuests} hospedes`;
    return `${guests.pets} pet`;
  }, [guests.pets, totalGuests]);

  const whereLabel = useMemo(() => {
    if (useNearbyMode) return 'Perto de voce';
    return search || 'Para onde voce quer ir?';
  }, [search, useNearbyMode]);

  const updateGuest = (key: keyof GuestState, delta: number) => {
    setGuests((current) => {
      const nextValue = Math.max(0, current[key] + delta);
      return { ...current, [key]: nextValue };
    });
  };

  const selectNearby = async (option: NearbyOption) => {
    if (option.key !== 'nearby') {
      setUseNearbyMode(false);
      setMyCoords(null);
      setDestinationInput(option.value);
      setSearch(option.value);
      return;
    }

    setUseNearbyMode(true);
    setDestinationInput(option.value);
    setSearch('');

    if (!navigator.geolocation) {
      setMyCoords(null);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMyCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setMyCoords(null);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 7000 },
    );
  };

  const applySearch = () => {
    if (useNearbyMode) {
      setSearchMenuOpen(false);
      return;
    }

    const value = destinationInput.trim();
    setSearch(value);
    setSearchMenuOpen(false);
  };

  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return allProperties.filter((property) => {
      if (totalGuests > 0 && property.guests_capacity < totalGuests) return false;
      if (guests.pets > 0 && !property.pet_friendly) return false;

      if (useNearbyMode) return true;
      if (!normalizedSearch) return true;

      const searchable = [property.title, property.description, property.location.addressText].join(' ').toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [allProperties, guests.pets, search, totalGuests, useNearbyMode]);

  const sortedProperties = useMemo(() => {
    if (!useNearbyMode || !myCoords) return filteredProperties;

    const withDistance = filteredProperties
      .filter((property) => typeof property.location.lat === 'number' && typeof property.location.lng === 'number')
      .map((property) => ({
        property,
        distance: distanceInKm(myCoords.lat, myCoords.lng, property.location.lat as number, property.location.lng as number),
      }))
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.property);

    if (withDistance.length === 0) return filteredProperties;

    const withDistanceIds = new Set(withDistance.map((property) => property.id));
    const withoutDistance = filteredProperties.filter((property) => !withDistanceIds.has(property.id));
    return [...withDistance, ...withoutDistance];
  }, [filteredProperties, myCoords, useNearbyMode]);

  const rowOneProperties = useMemo(() => {
    const filtered = sortedProperties.filter((property) => property.location.addressText.toLowerCase().includes('cassino'));
    return (filtered.length > 0 ? filtered : sortedProperties).slice(0, 14);
  }, [sortedProperties]);

  const rowTwoProperties = useMemo(() => {
    const rowOneIds = new Set(rowOneProperties.map((property) => property.id));
    const remaining = sortedProperties.filter((property) => !rowOneIds.has(property.id));
    const ranked = (remaining.length > 0 ? remaining : sortedProperties).slice().sort((a, b) => {
      if (b.views_count !== a.views_count) return b.views_count - a.views_count;
      return b.price - a.price;
    });
    return ranked.slice(0, 14);
  }, [rowOneProperties, sortedProperties]);

  return (
    <Stack gap="lg" py="md">
      <Card radius="xl" withBorder p={isMobile ? 'sm' : 'lg'} className="home-discovery-shell">
        <Popover
          opened={searchMenuOpen}
          onChange={setSearchMenuOpen}
          width={isMobile ? 'min(96vw, 620px)' : 760}
          position="bottom"
          shadow="md"
          offset={10}
          zIndex={1200}
          withinPortal
        >
          <Popover.Target>
            <UnstyledButton
              className="home-discovery-trigger"
              onClick={() => {
                setDestinationInput((current) => current || search);
                setSearchMenuOpen(true);
              }}
            >
              <div className="home-discovery-trigger-main">
                <Text fw={700}>Pesquisar</Text>
                <Text className="home-discovery-trigger-sub">{whereLabel}</Text>
              </div>

              <div className="home-discovery-trigger-meta">
                <span>
                  <CalendarDays size={13} /> {formatDateRange(dateRange)}
                </span>
                <span>
                  <Users size={13} /> {whoLabel}
                </span>
              </div>

              <span className="home-discovery-trigger-search" aria-hidden>
                <Search size={16} />
              </span>
            </UnstyledButton>
          </Popover.Target>

          <Popover.Dropdown className="home-discovery-panel">
            <Stack gap="md">
              <Stack gap={8}>
                <Text fw={700}>Onde</Text>
                <TextInput
                  placeholder="Pesquise cidade, bairro ou regiao"
                  value={destinationInput}
                  onChange={(event) => {
                    setUseNearbyMode(false);
                    setDestinationInput(event.currentTarget.value);
                  }}
                  leftSection={<Search size={14} />}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applySearch();
                    }
                  }}
                />

                <Group gap="xs" wrap="wrap" className="home-nearby-grid">
                  {nearbyOptions.map((option) => {
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`home-nearby-btn ${useNearbyMode && option.key === 'nearby' ? 'active' : ''}`}
                        onClick={() => {
                          void selectNearby(option);
                        }}
                      >
                        <span className="home-nearby-btn-icon">
                          <Icon size={16} />
                        </span>
                        <span className="home-nearby-btn-copy">
                          <strong>{option.label}</strong>
                          <small>{option.hint}</small>
                        </span>
                      </button>
                    );
                  })}
                </Group>

                {locating ? (
                  <Text size="xs" c="dimmed">
                    Capturando sua localizacao para ordenar resultados...
                  </Text>
                ) : null}

                {useNearbyMode ? (
                  <Group gap={6} className="home-nearby-mode-pill">
                    <LocateFixed size={13} />
                    <Text size="xs" fw={600}>
                      Modo perto de voce ativado
                    </Text>
                  </Group>
                ) : null}
              </Stack>

              <Stack gap={8}>
                <Text fw={700}>Quando</Text>
                <DatePicker
                  type="range"
                  numberOfColumns={isMobile ? 1 : 2}
                  locale="pt-BR"
                  value={dateRange}
                  onChange={setDateRange}
                  minDate={new Date()}
                />
              </Stack>

              <Stack gap={8}>
                <Text fw={700}>Quem</Text>

                <div className="home-guest-row">
                  <div>
                    <Text fw={700}>Adultos</Text>
                    <Text size="sm" c="dimmed">
                      13 anos ou mais
                    </Text>
                  </div>
                  <Group gap={8}>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('adults', -1)}>
                      <Minus size={14} />
                    </button>
                    <Text fw={700}>{guests.adults}</Text>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('adults', 1)}>
                      <Plus size={14} />
                    </button>
                  </Group>
                </div>

                <div className="home-guest-row">
                  <div>
                    <Text fw={700}>Criancas</Text>
                    <Text size="sm" c="dimmed">
                      De 2 a 12 anos
                    </Text>
                  </div>
                  <Group gap={8}>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('children', -1)}>
                      <Minus size={14} />
                    </button>
                    <Text fw={700}>{guests.children}</Text>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('children', 1)}>
                      <Plus size={14} />
                    </button>
                  </Group>
                </div>

                <div className="home-guest-row">
                  <div>
                    <Text fw={700}>Bebes</Text>
                    <Text size="sm" c="dimmed">
                      Menor de 2 anos
                    </Text>
                  </div>
                  <Group gap={8}>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('babies', -1)}>
                      <Minus size={14} />
                    </button>
                    <Text fw={700}>{guests.babies}</Text>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('babies', 1)}>
                      <Plus size={14} />
                    </button>
                  </Group>
                </div>

                <div className="home-guest-row">
                  <div>
                    <Text fw={700}>Pets</Text>
                    <Text size="sm" c="dimmed">
                      Vai levar animal?
                    </Text>
                  </div>
                  <Group gap={8}>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('pets', -1)}>
                      <Minus size={14} />
                    </button>
                    <Text fw={700}>{guests.pets}</Text>
                    <button type="button" className="home-guest-btn" onClick={() => updateGuest('pets', 1)}>
                      <Plus size={14} />
                    </button>
                  </Group>
                </div>
              </Stack>

              <Button radius="xl" leftSection={<Search size={16} />} className="home-discovery-submit" onClick={applySearch}>
                Buscar
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Card>

      {loading ? <Text c="dimmed">Carregando propriedades...</Text> : null}
      {errorMessage ? <Text c="red">{errorMessage}</Text> : null}

      {!loading && !errorMessage ? (
        sortedProperties.length > 0 ? (
          <Stack gap="lg">
            <section className="home-carousel-section">
              <Group gap={8} align="center" className="home-section-title-row">
                <span className="home-section-icon" aria-hidden>
                  <Star size={16} />
                </span>
                <Title order={3}>Acomodacoes em Balneario Cassino</Title>
              </Group>
              <Text size="sm" c="dimmed" className="home-section-subtitle">
                Opcoes selecionadas para seu perfil de busca.
              </Text>
              <div className="home-horizontal-scroll">
                {rowOneProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            </section>

            <section className="home-carousel-section">
              <Group gap={8} align="center" className="home-section-title-row">
                <span className="home-section-icon" aria-hidden>
                  <Building2 size={16} />
                </span>
                <Title order={3}>Acomodacoes muito procuradas em Rio Grande</Title>
              </Group>
              <Text size="sm" c="dimmed" className="home-section-subtitle">
                Casas e apartamentos com maior procura na regiao.
              </Text>
              <div className="home-horizontal-scroll">
                {rowTwoProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            </section>
          </Stack>
        ) : (
          <Card withBorder radius="xl" p="lg">
            <Text c="dimmed">Nenhum imovel encontrado com os filtros atuais.</Text>
          </Card>
        )
      ) : null}
    </Stack>
  );
}
