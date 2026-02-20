import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  BedDouble,
  Cigarette,
  BellRing,
  Dog,
  Building2,
  CarFront,
  ExternalLink,
  Heart,
  type LucideIcon,
  MapPin,
  Navigation,
  PartyPopper,
  ShieldBan,
  Share2,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { findSeedOwnerById, findSeedPropertyById } from '../lib/seedProperties';
import { useAuth } from '../state/AuthContext';
import { calculateUnits, formatMoney } from '../lib/format';
import { getAmenityLabel } from '../lib/propertyCatalog';
import { supabase } from '../lib/supabase';
import { parseProfile, parseProperty, Property, UserProfile } from '../lib/types';

const calculateNights = (checkInDate: string, checkOutDate: string): number => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return 0;
  }

  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
};

const amenityIconPool: LucideIcon[] = [
  ShieldCheck,
  BedDouble,
  CarFront,
  MapPin,
  Navigation,
  Users,
  Building2,
  PartyPopper,
  BellRing,
  ShieldCheck,
];

const getAmenityIcon = (amenity: string): LucideIcon => {
  const seed = amenity.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return amenityIconPool[seed % amenityIconPool.length];
};

const getRating = (seed: string): string => {
  const total = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rating = 4.6 + (total % 5) * 0.1;
  return rating.toFixed(2).replace('.', ',');
};

const getReviewCount = (seed: string): number => {
  const total = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 10 + (total % 90);
};

const rentPeriodLabel = (rentType: Property['rent_type']): string => {
  if (rentType === 'diaria') return 'por noite';
  if (rentType === 'temporada') return 'por temporada';
  return 'por mes';
};

export function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [bookingError, setBookingError] = useState('');
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isDateRangeAvailable, setIsDateRangeAvailable] = useState(true);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showAllPhotosModal, setShowAllPhotosModal] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      setLoading(true);
      setErrorMessage('');
      setShowAllAmenities(false);
      setShowAllPhotosModal(false);

      try {
        const seedProperty = findSeedPropertyById(id);
        if (seedProperty) {
          setProperty(seedProperty);
          setOwner(findSeedOwnerById(seedProperty.owner_id) ?? null);
          return;
        }

        const { data, error } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Imovel nao encontrado.');

        const parsedProperty = parseProperty(data);
        setProperty(parsedProperty);

        const { data: ownerData } = await supabase
          .from('users')
          .select('*')
          .eq('id', parsedProperty.owner_id)
          .maybeSingle();

        if (ownerData) setOwner(parseProfile(ownerData));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar detalhe');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [id]);

  const nights = useMemo(() => calculateNights(checkInDate, checkOutDate), [checkInDate, checkOutDate]);

  const units = useMemo(() => {
    if (!property) return 0;
    return calculateUnits(property.rent_type, checkInDate, checkOutDate);
  }, [checkInDate, checkOutDate, property]);

  const amounts = useMemo(() => {
    if (!property || units <= 0) {
      return {
        rentalBase: 0,
        cleaningFee: 0,
        clientFee: 0,
        ownerFee: 0,
        totalPaid: 0,
        ownerPayout: 0,
      };
    }

    const rentalBase = property.price * units;
    const cleaningFee = property.cleaning_fee;
    const clientFee = Math.round(rentalBase * 0.1);
    const ownerFee = Math.round(rentalBase * 0.04);

    return {
      rentalBase,
      cleaningFee,
      clientFee,
      ownerFee,
      totalPaid: rentalBase + cleaningFee + clientFee,
      ownerPayout: rentalBase + cleaningFee - ownerFee,
    };
  }, [property, units]);

  useEffect(() => {
    let cancelled = false;

    const validateAvailability = async () => {
      if (!property || !checkInDate || !checkOutDate) {
        setAvailabilityNotice('');
        setIsDateRangeAvailable(true);
        setCheckingAvailability(false);
        return;
      }

      if (units <= 0) {
        setAvailabilityNotice('');
        setIsDateRangeAvailable(true);
        setCheckingAvailability(false);
        return;
      }

      setCheckingAvailability(true);
      setAvailabilityNotice('');

      try {
        const checkInIso = new Date(`${checkInDate}T12:00:00`).toISOString();
        const checkOutIso = new Date(`${checkOutDate}T12:00:00`).toISOString();

        const { data, error } = await supabase
          .from('bookings')
          .select('id, check_in_date, check_out_date, status')
          .eq('property_id', property.id)
          .in('status', ['pending_payment', 'pre_checking', 'confirmed', 'checked_in']);

        if (error) throw error;

        const hasConflict = (data ?? []).some((row) => {
          const existingStart = new Date(String(row.check_in_date));
          const existingEnd = new Date(String(row.check_out_date));
          return existingStart < new Date(checkOutIso) && existingEnd > new Date(checkInIso);
        });

        if (cancelled) return;

        if (hasConflict) {
          setIsDateRangeAvailable(false);
          setAvailabilityNotice('Periodo indisponivel: este imovel ja foi reservado nessas datas.');
          return;
        }

        setIsDateRangeAvailable(true);
        setAvailabilityNotice('Datas disponiveis para reserva.');
      } catch {
        if (cancelled) return;
        setIsDateRangeAvailable(false);
        setAvailabilityNotice('Nao foi possivel validar disponibilidade agora. Tente novamente.');
      } finally {
        if (!cancelled) {
          setCheckingAvailability(false);
        }
      }
    };

    void validateAvailability();

    return () => {
      cancelled = true;
    };
  }, [checkInDate, checkOutDate, property, units]);

  const onCreateBooking = (event: FormEvent) => {
    event.preventDefault();

    if (!property || !user) {
      setBookingError('Faca login para reservar.');
      return;
    }

    if (units <= 0) {
      setBookingError('Escolha um periodo valido.');
      return;
    }

    if (nights < property.minimum_nights) {
      setBookingError(`Este imovel exige minimo de ${property.minimum_nights} noite(s).`);
      return;
    }

    if (guestCount > property.guests_capacity) {
      setBookingError(`Este imovel suporta no maximo ${property.guests_capacity} hospede(s).`);
      return;
    }

    if (checkingAvailability) {
      setBookingError('Validando disponibilidade das datas. Aguarde alguns segundos.');
      return;
    }

    if (!isDateRangeAvailable) {
      setBookingError('Periodo indisponivel. Escolha outras datas para continuar.');
      return;
    }

    setBookingError('');

    const params = new URLSearchParams({
      propertyId: property.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: String(guestCount),
    });

    navigate(`/app/checkout?${params.toString()}`);
  };

  if (loading) {
    return (
      <Stack py="md">
        <Text c="dimmed">Carregando imovel...</Text>
      </Stack>
    );
  }

  if (!property) {
    return (
      <Stack py="md">
        <Alert color="red" icon={<AlertCircle size={16} />}>
          {errorMessage || 'Imovel nao encontrado.'}
        </Alert>
      </Stack>
    );
  }

  const rating = getRating(property.id);
  const reviewCount = getReviewCount(property.id);
  const photosRaw = property.photos.length > 0 ? property.photos : ['/background.png'];
  const photos = photosRaw.length >= 5 ? photosRaw : [...photosRaw, ...Array(5 - photosRaw.length).fill(photosRaw[0])];
  const stayRules = [
    { icon: Clock3, text: `Minimo de ${property.minimum_nights} noite(s)` },
    { icon: Clock3, text: `Check-in: ${property.check_in_time}` },
    { icon: Clock3, text: `Check-out: ${property.check_out_time}` },
    { icon: PartyPopper, text: `Festas: ${property.events_allowed ? 'permitidas' : 'nao permitidas'}` },
    { icon: Cigarette, text: `Fumantes: ${property.smoking_allowed ? 'permitido' : 'nao permitido'}` },
    { icon: property.pet_friendly ? Dog : ShieldBan, text: property.pet_friendly ? 'Aceita pets' : 'Nao aceita pets' },
  ];

  return (
    <Stack gap="lg" py="md">
      <Modal opened={showAllPhotosModal} onClose={() => setShowAllPhotosModal(false)} size="xl" title="Todas as fotos">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {photosRaw.map((photo, index) => (
            <Box key={`${photo}-${index}`} className="detail-modal-photo-wrap">
              <img src={photo} alt={`${property.title} ${index + 1}`} className="detail-modal-photo" />
            </Box>
          ))}
        </SimpleGrid>
      </Modal>

      <Group justify="space-between" align="center">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Voltar
        </Button>

        <Group gap={4}>
          <ActionIcon radius="xl" variant="subtle" color="dark" aria-label="Compartilhar">
            <Share2 size={16} />
          </ActionIcon>
          <ActionIcon radius="xl" variant="subtle" color="dark" aria-label="Salvar">
            <Heart size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <Title order={1} className="detail-headline">
        {property.title}
      </Title>

      <div className="detail-gallery-grid">
        <div className="detail-gallery-main">
          <img src={photos[0]} alt={`${property.title} principal`} className="detail-gallery-image" />
        </div>

        <div className="detail-gallery-side">
          {photos.slice(1, 5).map((photo, index) => (
            <div key={`${photo}-${index}`} className="detail-gallery-thumb">
              <img src={photo} alt={`${property.title} ${index + 2}`} className="detail-gallery-image" />

              {index === 3 ? (
                <Button
                  className="detail-gallery-show-all"
                  size="xs"
                  variant="white"
                  leftSection={<ExternalLink size={14} />}
                  onClick={() => setShowAllPhotosModal(true)}
                >
                  Mostrar todas as fotos
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="detail-page-grid">
        <div className="detail-main-column">
          <section id="fotos" className="detail-section">
            <Title order={2} className="detail-section-title">
              Espaco inteiro em {property.location.addressText || 'Balneario Cassino'}
            </Title>
            <Text c="dimmed" size="lg">
              {property.guests_capacity} hospedes · {property.bedrooms} quarto(s) · {property.bathrooms} banheiro(s)
            </Text>
          </section>

          <Card withBorder radius="xl" p="md" className="detail-preference-card">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={10}>
                <Badge radius="xl" color="yellow" variant="light">
                  Preferido dos hospedes
                </Badge>
                <Text size="sm" c="dimmed">
                  Um dos imoveis mais reservados na plataforma
                </Text>
              </Group>

              <div className="detail-rating-block">
                <Group gap={4} justify="flex-end">
                  <Star size={14} fill="currentColor" />
                  <Text fw={700}>{rating}</Text>
                </Group>
                <Text size="xs" c="dimmed" ta="right">
                  {reviewCount} avaliacoes
                </Text>
              </div>
            </Group>
          </Card>

          <Group justify="space-between" className="detail-host-row">
            <Group gap="sm">
              <div className="detail-host-avatar">{(owner?.name || 'A').charAt(0).toUpperCase()}</div>
              <div>
                <Text fw={700}>Anfitriao(a): {owner?.name || 'Equipe AlugaSul'}</Text>
                <Text c="dimmed" size="sm">
                  Perfil verificado
                </Text>
              </div>
            </Group>

            {property.verified ? (
              <Badge color="teal" leftSection={<ShieldCheck size={13} />}>
                Verificado
              </Badge>
            ) : null}
          </Group>

          <Divider my="lg" />

          <section id="comodidades" className="detail-section">
            <Title order={3} className="detail-section-title">
              O que esse lugar oferece
            </Title>

            {property.amenities.length > 0 ? (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" className="amenities-grid">
                  {(showAllAmenities ? property.amenities : property.amenities.slice(0, 10)).map((item) => {
                    const AmenityIcon = getAmenityIcon(item);
                    return (
                      <motion.div key={item} className="amenity-item" whileHover={{ y: -1 }}>
                        <motion.span
                          className="amenity-item-icon"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.7, ease: 'easeInOut' }}
                        >
                          <AmenityIcon size={18} />
                        </motion.span>
                        <Text size="md">{getAmenityLabel(item)}</Text>
                      </motion.div>
                    );
                  })}
                </SimpleGrid>

                {property.amenities.length > 10 ? (
                  <Button variant="default" className="amenities-toggle-btn" onClick={() => setShowAllAmenities((current) => !current)}>
                    {showAllAmenities
                      ? 'Mostrar menos comodidades'
                      : `Mostrar todas as ${property.amenities.length} comodidades`}
                  </Button>
                ) : null}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">
                Proprietario ainda nao cadastrou comodidades.
              </Text>
            )}
          </section>

          <Divider my="lg" />

          <section id="avaliacoes" className="detail-section">
            <Title order={3} className="detail-section-title">
              Regras e politicas
            </Title>
            <Group gap="xs" wrap="wrap" className="rule-pills">
              {stayRules.map((rule) => {
                const RuleIcon = rule.icon;
                return (
                  <Badge key={rule.text} variant="light" className="rule-pill">
                    <span className="rule-pill-content">
                      <RuleIcon size={14} />
                      <span>{rule.text}</span>
                    </span>
                  </Badge>
                );
              })}
            </Group>

            {property.house_rules ? (
              <Card withBorder radius="lg" p="sm" mt="sm">
                <Text size="sm" fw={700}>
                  Regras da casa
                </Text>
                <Text size="sm" c="dimmed">
                  {property.house_rules}
                </Text>
              </Card>
            ) : null}
          </section>

          <Divider my="lg" />

          <section id="localizacao" className="detail-section">
            <Title order={3} className="detail-section-title">
              Localizacao
            </Title>
            <Text c="dimmed">{property.location.addressText || 'Balneario Cassino, Rio Grande - RS'}</Text>

            <Stack mt="sm" gap="xs">
              <Alert color="blue" variant="light">
                Chat com o locador so e liberado apos pagamento confirmado e status pre-checking.
              </Alert>

              <Button
                component="a"
                variant="default"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  property.location.addressText || property.title,
                )}`}
                target="_blank"
                rel="noreferrer"
                leftSection={<Navigation size={16} />}
              >
                Ver no mapa
              </Button>
            </Stack>
          </section>
        </div>

        <aside className="detail-side-column">
          <Card withBorder radius="xl" p="md" className="detail-reserve-sticky">
            <Stack gap="md">
              <Text className="detail-price-line">
                <Text span fw={800}>
                  {formatMoney(property.price)}
                </Text>{' '}
                {rentPeriodLabel(property.rent_type)}
              </Text>

              <form onSubmit={onCreateBooking}>
                <Stack gap="sm">
                  <Group grow>
                    <TextInput
                      label="Check-in"
                      type="date"
                      value={checkInDate}
                      onChange={(event) => setCheckInDate(event.currentTarget.value)}
                      required
                    />
                    <TextInput
                      label="Checkout"
                      type="date"
                      value={checkOutDate}
                      onChange={(event) => setCheckOutDate(event.currentTarget.value)}
                      required
                    />
                  </Group>

                  <NumberInput
                    label="Hospedes"
                    min={1}
                    max={property.guests_capacity || 16}
                    value={guestCount}
                    onChange={(value) => setGuestCount(Number(value) || 1)}
                    hideControls={false}
                  />

                  <Card withBorder radius="lg" className="detail-free-cancel-note" p="xs">
                    <Text size="xs" c="dimmed" ta="center">
                      Cancelamento gratuito antes do check-in
                    </Text>
                  </Card>

                  {availabilityNotice ? (
                    <Alert color={isDateRangeAvailable ? 'teal' : 'red'}>{availabilityNotice}</Alert>
                  ) : null}

                  {bookingError ? <Alert color="red">{bookingError}</Alert> : null}

                  <Button type="submit" className="detail-reserve-btn" disabled={checkingAvailability || !isDateRangeAvailable}>
                    Reservar e pagar
                  </Button>

                  <Text size="xs" c="dimmed" ta="center">
                    Voce ainda nao sera cobrado
                  </Text>
                </Stack>
              </form>

              <Divider />

              <Stack gap={4}>
                <Text size="sm">Noites selecionadas: {nights}</Text>
                <Text size="sm">Unidades cobradas: {units}</Text>
                <Text size="sm">Base da locacao: {formatMoney(amounts.rentalBase)}</Text>
                <Text size="sm">Taxa limpeza: {formatMoney(amounts.cleaningFee)}</Text>
                <Text size="sm">Taxa cliente (10%): {formatMoney(amounts.clientFee)}</Text>
                <Text fw={700}>Total: {formatMoney(amounts.totalPaid)}</Text>
              </Stack>
            </Stack>
          </Card>
        </aside>
      </div>
    </Stack>
  );
}
