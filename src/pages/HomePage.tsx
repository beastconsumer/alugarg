import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  Card,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { DatePicker, type DatesRangeValue } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Minus, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import UseAnimations from 'react-useanimations';
import homeAnimated from 'react-useanimations/lib/home';
import settingsAnimated from 'react-useanimations/lib/settings2';
import starAnimated from 'react-useanimations/lib/star';
import userPlusAnimated from 'react-useanimations/lib/userPlus';
import { PropertyCard } from '../components/PropertyCard';
import { seedProperties } from '../lib/seedProperties';
import { supabase } from '../lib/supabase';
import { parseProperty, Property, RentType } from '../lib/types';

type HomeCategory = 'acomodacoes' | 'experiencias' | 'servicos';

type GuestState = {
  adults: number;
  children: number;
  babies: number;
  pets: number;
};

const destinationSuggestions = [
  'Cassino, Rio Grande do Sul',
  'Rio Grande, Rio Grande do Sul',
  'Pelotas, Rio Grande do Sul',
  'Sao Lourenco do Sul, Rio Grande do Sul',
  'Porto Alegre, Rio Grande do Sul',
  'Gramado, Rio Grande do Sul',
];

const rentTypeToggleData: Array<{ value: '' | RentType; label: string }> = [
  { value: '', label: 'Datas' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'temporada', label: 'Temporada' },
  { value: 'diaria', label: 'Diaria' },
];

const formatDateRange = (value: DatesRangeValue): string => {
  if (!value[0] && !value[1]) {
    return 'Insira as datas';
  }

  if (value[0] && !value[1]) {
    return format(value[0], 'dd MMM', { locale: ptBR });
  }

  if (value[0] && value[1]) {
    return `${format(value[0], 'dd MMM', { locale: ptBR })} - ${format(value[1], 'dd MMM', { locale: ptBR })}`;
  }

  return 'Insira as datas';
};

export function HomePage() {
  const isMobile = useMediaQuery('(max-width: 900px)');

  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [category, setCategory] = useState<HomeCategory>('acomodacoes');

  const [search, setSearch] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [dateRange, setDateRange] = useState<DatesRangeValue>([null, null]);
  const [rentType, setRentType] = useState<'' | RentType>('');
  const [guests, setGuests] = useState<GuestState>({
    adults: 0,
    children: 0,
    babies: 0,
    pets: 0,
  });

  const [whereOpen, setWhereOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);

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
    if (totalGuests <= 0 && guests.pets <= 0) return 'Hospedes?';
    if (totalGuests > 0 && guests.pets > 0) return `${totalGuests} hospedes + ${guests.pets} pet`;
    if (totalGuests > 0) return `${totalGuests} hospedes`;
    return `${guests.pets} pet`;
  }, [guests.pets, totalGuests]);

  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return allProperties.filter((property) => {
      if (rentType && property.rent_type !== rentType) return false;
      if (totalGuests > 0 && property.guests_capacity < totalGuests) return false;
      if (guests.pets > 0 && !property.pet_friendly) return false;

      if (!normalizedSearch) return true;

      const searchable = [property.title, property.description, property.location.addressText]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [allProperties, guests.pets, rentType, search, totalGuests]);

  const rowOneProperties = useMemo(() => {
    const filtered = filteredProperties.filter((property) =>
      property.location.addressText.toLowerCase().includes('cassino'),
    );
    return (filtered.length > 0 ? filtered : filteredProperties).slice(0, 14);
  }, [filteredProperties]);

  const rowTwoProperties = useMemo(() => {
    const rowOneIds = new Set(rowOneProperties.map((property) => property.id));
    const remaining = filteredProperties.filter((property) => !rowOneIds.has(property.id));
    const ranked = (remaining.length > 0 ? remaining : filteredProperties).slice().sort((a, b) => {
      if (b.views_count !== a.views_count) return b.views_count - a.views_count;
      return b.price - a.price;
    });
    return ranked.slice(0, 14);
  }, [filteredProperties, rowOneProperties]);

  const showingProperties = category === 'acomodacoes';

  const closeAllPanels = () => {
    setWhereOpen(false);
    setWhenOpen(false);
    setWhoOpen(false);
  };

  const openPanel = (panel: 'where' | 'when' | 'who') => {
    setWhereOpen(panel === 'where');
    setWhenOpen(panel === 'when');
    setWhoOpen(panel === 'who');
  };

  const updateGuest = (key: keyof GuestState, delta: number) => {
    setGuests((current) => {
      const nextValue = Math.max(0, current[key] + delta);
      return { ...current, [key]: nextValue };
    });
  };

  const applyDestination = (value: string) => {
    setSearch(value);
    setDestinationInput(value);
    setWhereOpen(false);
  };

  return (
    <Stack gap="lg" py="md">
      <Card radius="xl" withBorder p={isMobile ? 'md' : 'lg'} className="home-air-shell">
        <Stack gap="lg">
          <Group justify="space-between" align="center" gap="sm" wrap="nowrap" className="home-air-tabs-row">
            <Group className="home-air-tabs" justify="center" gap="xl" wrap="nowrap">
              <button
                type="button"
                className={`home-air-tab ${category === 'acomodacoes' ? 'active' : ''}`}
                onClick={() => setCategory('acomodacoes')}
              >
                <span className="home-air-tab-icon">
                  <UseAnimations
                    animation={homeAnimated}
                    size={18}
                    strokeColor={category === 'acomodacoes' ? '#1f5ed6' : '#64748b'}
                    autoplay
                  />
                </span>
                <span>Acomodacoes</span>
              </button>

              <motion.button
                type="button"
                className={`home-air-tab ${category === 'experiencias' ? 'active' : ''}`}
                onClick={() => setCategory('experiencias')}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="home-air-tab-icon">
                  <UseAnimations
                    animation={starAnimated}
                    size={18}
                    strokeColor={category === 'experiencias' ? '#1f5ed6' : '#64748b'}
                    autoplay
                  />
                </span>
                <span>Experiencias</span>
                <Badge size="xs" color="dark" variant="light">
                  NOVO
                </Badge>
              </motion.button>

              <motion.button
                type="button"
                className={`home-air-tab ${category === 'servicos' ? 'active' : ''}`}
                onClick={() => setCategory('servicos')}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="home-air-tab-icon">
                  <UseAnimations
                    animation={settingsAnimated}
                    size={18}
                    strokeColor={category === 'servicos' ? '#1f5ed6' : '#64748b'}
                    autoplay
                  />
                </span>
                <span>Servicos</span>
                <Badge size="xs" color="dark" variant="light">
                  NOVO
                </Badge>
              </motion.button>
            </Group>

            <Button
              component={Link}
              to="/app/announce"
              variant="default"
              size={isMobile ? 'sm' : 'md'}
              radius="xl"
              className="home-air-host-btn"
              leftSection={<UseAnimations animation={userPlusAnimated} size={18} strokeColor="#334155" autoplay />}
            >
              Torne-se um anfitriao
            </Button>
          </Group>

          <div className="home-air-search-wrap">
            <div className="home-air-search home-air-search-airbnb">
              <Popover
                opened={whereOpen}
                onChange={setWhereOpen}
                width={isMobile ? 'min(94vw, 420px)' : 360}
                position={isMobile ? 'bottom' : 'bottom-start'}
                shadow="md"
                offset={10}
                zIndex={1100}
                withinPortal
              >
                <Popover.Target>
                  <UnstyledButton className="home-search-trigger" onClick={() => openPanel('where')}>
                    <Text size="xs" fw={700}>
                      Onde
                    </Text>
                    <Text className="home-search-trigger-value">{search || 'Buscar destinos'}</Text>
                  </UnstyledButton>
                </Popover.Target>
                <Popover.Dropdown className="home-air-panel">
                  <Stack gap="xs">
                    <TextInput
                      placeholder="Digite cidade, bairro ou ponto"
                      value={destinationInput}
                      onChange={(event) => setDestinationInput(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          applyDestination(destinationInput.trim() || search);
                        }
                      }}
                    />

                    <Text size="xs" c="dimmed" fw={600}>
                      Destinos sugeridos
                    </Text>

                    {destinationSuggestions.map((destination) => (
                      <button
                        key={destination}
                        type="button"
                        className="home-air-suggestion"
                        onClick={() => applyDestination(destination)}
                      >
                        <span>{destination}</span>
                      </button>
                    ))}
                  </Stack>
                </Popover.Dropdown>
              </Popover>

              <div className="home-air-divider" />

              <Popover
                opened={whenOpen}
                onChange={setWhenOpen}
                width={isMobile ? 'min(96vw, 760px)' : 760}
                position="bottom"
                shadow="md"
                offset={10}
                zIndex={1100}
                withinPortal
              >
                <Popover.Target>
                  <UnstyledButton className="home-search-trigger" onClick={() => openPanel('when')}>
                    <Text size="xs" fw={700}>
                      Quando
                    </Text>
                    <Text className="home-search-trigger-value">{formatDateRange(dateRange)}</Text>
                  </UnstyledButton>
                </Popover.Target>
                <Popover.Dropdown className="home-air-panel home-air-panel-calendar">
                  <Stack gap="sm">
                    <Group gap="xs">
                      {rentTypeToggleData.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className={`home-air-pill ${rentType === item.value ? 'active' : ''}`}
                          onClick={() => setRentType(item.value)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </Group>

                    <DatePicker
                      type="range"
                      numberOfColumns={isMobile ? 1 : 2}
                      locale="pt-BR"
                      value={dateRange}
                      onChange={setDateRange}
                      minDate={new Date()}
                    />
                  </Stack>
                </Popover.Dropdown>
              </Popover>

              <div className="home-air-divider" />

              <Popover
                opened={whoOpen}
                onChange={setWhoOpen}
                width={isMobile ? 'min(94vw, 420px)' : 360}
                position={isMobile ? 'bottom' : 'bottom-end'}
                shadow="md"
                offset={10}
                zIndex={1100}
                withinPortal
              >
                <Popover.Target>
                  <UnstyledButton className="home-search-trigger" onClick={() => openPanel('who')}>
                    <Text size="xs" fw={700}>
                      Quem
                    </Text>
                    <Text className="home-search-trigger-value">{whoLabel}</Text>
                  </UnstyledButton>
                </Popover.Target>
                <Popover.Dropdown className="home-air-panel">
                  <Stack gap="sm">
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
                          Menor de 2
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
                        <Text fw={700}>Animais de estimacao</Text>
                        <Text size="sm" c="dimmed">
                          Vai levar um animal?
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
                </Popover.Dropdown>
              </Popover>

              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                <Button
                className="home-air-search-submit"
                radius="xl"
                leftSection={<Search size={16} />}
                onClick={() => {
                  if (destinationInput.trim()) {
                    setSearch(destinationInput.trim());
                  }
                  closeAllPanels();
                }}
              >
                Buscar
              </Button>
              </motion.div>
            </div>
          </div>
        </Stack>
      </Card>

      {loading ? <Text c="dimmed">Carregando propriedades...</Text> : null}
      {errorMessage ? <Text c="red">{errorMessage}</Text> : null}

      {!loading && !errorMessage ? (
        showingProperties ? (
          filteredProperties.length > 0 ? (
            <Stack gap="xl">
              <section className="home-carousel-section">
                <Title order={3}>Acomodacoes em Balneario Cassino</Title>
                <div className="home-horizontal-scroll">
                  {rowOneProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              </section>

              <section className="home-carousel-section">
                <Title order={3}>Acomodacoes muito procuradas em Rio Grande</Title>
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
        ) : (
          <Card radius="xl" withBorder p="lg" className="home-filter-card">
            <Stack gap={6}>
              <Title order={5}>
                {category === 'experiencias' ? 'Experiencias em breve' : 'Servicos em breve'}
              </Title>
              <Text c="dimmed" size="sm">
                Estamos preparando esta secao. Enquanto isso, explore as acomodacoes.
              </Text>
            </Stack>
          </Card>
        )
      ) : null}
    </Stack>
  );
}
