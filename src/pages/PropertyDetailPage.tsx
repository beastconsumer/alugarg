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
  Skeleton,
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
import { calculateUnits, formatDate, formatMoney } from '../lib/format';
import { getAmenityLabel } from '../lib/propertyCatalog';
import { supabase } from '../lib/supabase';
import { OwnerReview, parseOwnerReview, parseProfile, parseProperty, Property, rentTypeLabel, UserProfile } from '../lib/types';

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
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [reviewersById, setReviewersById] = useState<Record<string, UserProfile>>({});
  const [ownerAvatarError, setOwnerAvatarError] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      setLoading(true);
      setErrorMessage('');
      setShowAllAmenities(false);
      setShowAllPhotosModal(false);
      setReviews([]);
      setReviewersById({});
      setOwnerAvatarError(false);

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

        const { data: reviewsRows, error: reviewsError } = await supabase
          .from('owner_reviews')
          .select('*')
          .eq('property_id', parsedProperty.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (reviewsError) throw reviewsError;

        const parsedReviews = (reviewsRows ?? []).map((row) => parseOwnerReview(row));
        setReviews(parsedReviews);

        const reviewerIds = Array.from(new Set(parsedReviews.map((item) => item.renter_id).filter(Boolean)));
        if (reviewerIds.length > 0) {
          const { data: reviewerRows, error: reviewerError } = await supabase
            .from('users')
            .select('*')
            .in('id', reviewerIds);

          if (reviewerError) throw reviewerError;

          const mappedReviewers: Record<string, UserProfile> = {};
          (reviewerRows ?? []).forEach((row) => {
            const parsed = parseProfile(row);
            mappedReviewers[parsed.id] = parsed;
          });
          setReviewersById(mappedReviewers);
        }
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
      <Stack py="md" gap="lg" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <Group justify="space-between" align="center">
          <Skeleton height={36} width={90} radius="xl" />
          <Group gap={6}>
            <Skeleton height={32} width={32} radius="xl" />
            <Skeleton height={32} width={32} radius="xl" />
          </Group>
        </Group>

        <Skeleton height={38} radius="md" />
        <Skeleton height={18} width="55%" radius="sm" />

        <Skeleton height={260} radius="xl" />

        <Stack gap={6}>
          <Skeleton height={20} width="72%" radius="sm" />
          <Skeleton height={16} width="48%" radius="sm" />
        </Stack>

        <Group gap={8}>
          <Skeleton height={30} width={90} radius="xl" />
          <Skeleton height={30} width={80} radius="xl" />
          <Skeleton height={30} width={70} radius="xl" />
        </Group>

        <Skeleton height={72} radius="xl" />
        <Skeleton height={180} radius="xl" />
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

  const reviewCount = reviews.length;
  const reviewAverage = reviewCount > 0
    ? reviews.reduce((acc, item) => acc + item.rating, 0) / reviewCount
    : 0;
  const ratingLabel = reviewCount > 0 ? reviewAverage.toFixed(1).replace('.', ',') : 'Novo';
  const ownerAvatarUrl = owner?.avatar_url?.trim() ?? '';
  const showOwnerAvatar = Boolean(ownerAvatarUrl) && !ownerAvatarError;
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
    <Stack gap="lg" py="md" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <div className="detail-mobile-cta">
        <div>
          <Text fw={800} size="lg" style={{ lineHeight: 1.1 }}>{formatMoney(property.price)}</Text>
          <Text size="xs" c="dimmed">{rentPeriodLabel(property.rent_type)}</Text>
        </div>
        <Button
          radius="xl"
          className="detail-reserve-btn"
          style={{ minWidth: 140 }}
          onClick={() => document.getElementById('detail-reserve-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Reservar
        </Button>
      </div>

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

      {/* Title + meta row */}
      <div>
        <Title order={1} className="detail-headline">
          {property.title}
        </Title>

        <Group gap={6} align="center" className="detail-meta-row" mt={6} wrap="nowrap">
          <Group gap={3} style={{ flexShrink: 0 }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <Text size="sm" fw={700}>{ratingLabel}</Text>
            <Text size="sm" c="dimmed">({reviewCount > 0 ? reviewCount : 'sem avaliacoes'})</Text>
          </Group>
          <Text size="sm" c="dimmed">·</Text>
          <Text
            size="sm"
            c="dimmed"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
          >
            {property.location.addressText || 'Balneario Cassino, RS'}
          </Text>
          <Badge size="xs" radius="xl" variant="light" color="blue" style={{ flexShrink: 0 }}>
            {rentTypeLabel[property.rent_type]}
          </Badge>
        </Group>
      </div>

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

      {/* Host card – below gallery */}
      <Card withBorder radius="xl" p="md" className="detail-host-card">
        <Group gap="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <div className="detail-host-avatar">
              {showOwnerAvatar ? (
                <img
                  src={ownerAvatarUrl}
                  alt={`Foto de ${owner?.name || 'anfitriao'}`}
                  className="detail-host-avatar-image"
                  onError={() => setOwnerAvatarError(true)}
                />
              ) : (
                (owner?.name || 'A').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" fw={600} style={{ textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: 10, color: '#64748b' }}>
                Anfitrião
              </Text>
              <Text fw={700} size="sm">{owner?.name || 'Equipe AlugaSul'}</Text>
              <Group gap={4} mt={2}>
                <ShieldCheck size={12} color="#10b981" />
                <Text size="xs" style={{ color: '#10b981' }}>Perfil verificado</Text>
              </Group>
            </div>
          </Group>
          {property.verified ? (
            <Badge radius="xl" color="teal" variant="light" leftSection={<ShieldCheck size={12} />} style={{ flexShrink: 0 }}>
              Imóvel verificado
            </Badge>
          ) : null}
        </Group>
      </Card>

      <div className="detail-page-grid">
        <Stack gap={28} className="detail-main-column">

          {/* ── Specs ── */}
          <section id="fotos" className="detail-section">
            <Title order={2} className="detail-section-title">
              Espaco inteiro em {property.location.addressText || 'Balneario Cassino'}
            </Title>
            <Group gap={8} mt={8} className="detail-spec-row" wrap="wrap">
              <div className="detail-spec-pill">
                <BedDouble size={13} />
                <span>{property.bedrooms} quarto{property.bedrooms !== 1 ? 's' : ''}</span>
              </div>
              <div className="detail-spec-pill">
                <Users size={13} />
                <span>{property.guests_capacity} hospede{property.guests_capacity !== 1 ? 's' : ''}</span>
              </div>
              <div className="detail-spec-pill">
                <Building2 size={13} />
                <span>{property.bathrooms} banheiro{property.bathrooms !== 1 ? 's' : ''}</span>
              </div>
              {property.pet_friendly ? (
                <div className="detail-spec-pill detail-spec-pill-pet">
                  <Dog size={13} />
                  <span>Pets ok</span>
                </div>
              ) : null}
            </Group>
          </section>

          {/* ── Preferido dos hóspedes ── */}
          <Card withBorder radius="xl" p="md" className="detail-preference-card">
            <Group justify="space-between" wrap="wrap" className="detail-preference-row">
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
                  <Text fw={700}>{ratingLabel}</Text>
                </Group>
                <Text size="xs" c="dimmed" ta="right">
                  {reviewCount > 0 ? `${reviewCount} avaliacoes` : 'Sem avaliacoes ainda'}
                </Text>
              </div>
            </Group>
          </Card>

          {/* ── Descrição ── */}
          {property.description ? (
            <>
              <Divider />
              <section id="descricao" className="detail-section">
                <Title order={3} className="detail-section-title">
                  Sobre este imovel
                </Title>
                <Text className="detail-description">{property.description}</Text>
              </section>
            </>
          ) : null}

          {/* ── Comodidades ── */}
          <Divider />
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

          {/* Avaliacoes */}
          <Divider />
          <section id="avaliacoes" className="detail-section">
            <Title order={3} className="detail-section-title">
              Avaliacoes dos hospedes
            </Title>
            {reviews.length === 0 ? (
              <Text c="dimmed" size="sm">
                Ainda nao existem avaliacoes para este imovel.
              </Text>
            ) : (
              <Stack gap="sm">
                {reviews.slice(0, 8).map((review) => {
                  const reviewer = reviewersById[review.renter_id];
                  const reviewerName = reviewer?.name || 'Hospede';
                  const reviewerAvatar = reviewer?.avatar_url?.trim() || '';

                  return (
                    <Card key={review.id} withBorder radius="lg" p="sm" className="detail-review-card">
                      <Stack gap={8}>
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                            <div className="detail-review-avatar">
                              {reviewerAvatar ? (
                                <img
                                  src={reviewerAvatar}
                                  alt={`Foto de ${reviewerName}`}
                                  className="detail-review-avatar-image"
                                />
                              ) : (
                                reviewerName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Text fw={700} size="sm" lineClamp={1}>
                                {reviewerName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {formatDate(review.created_at)}
                              </Text>
                            </div>
                          </Group>
                          <Group gap={4} style={{ flexShrink: 0 }}>
                            <Star size={13} fill="#f59e0b" color="#f59e0b" />
                            <Text size="sm" fw={700}>{review.rating.toFixed(1).replace('.', ',')}</Text>
                          </Group>
                        </Group>

                        {review.comment ? (
                          <Text size="sm" c="dimmed" style={{ lineHeight: 1.55 }}>
                            {review.comment}
                          </Text>
                        ) : null}

                        {review.tags.length > 0 ? (
                          <Group gap={6} wrap="wrap">
                            {review.tags.map((tag) => (
                              <Badge key={`${review.id}-${tag}`} size="xs" radius="xl" variant="light" color="blue">
                                {tag}
                              </Badge>
                            ))}
                          </Group>
                        ) : null}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </section>

          {/* Regras */}
          <Divider />
          <section id="regras" className="detail-section">
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
                <Text size="sm" fw={700}>Regras da casa</Text>
                <Text size="sm" c="dimmed">{property.house_rules}</Text>
              </Card>
            ) : null}
          </section>

          {/* ── Localização ── */}
          <Divider />
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

        </Stack>

        <aside className="detail-side-column" id="detail-reserve-section">
          <Card withBorder radius="xl" p="lg" className="detail-reserve-sticky">
            <Stack gap="md">
              <div>
                <Text component="span" className="detail-price-big">{formatMoney(property.price)}</Text>
                <Text component="span" className="detail-price-period">{rentPeriodLabel(property.rent_type)}</Text>
              </div>

              <form onSubmit={onCreateBooking}>
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
                  </SimpleGrid>

                  <NumberInput
                    label="Hospedes"
                    min={1}
                    max={property.guests_capacity || 16}
                    value={guestCount}
                    onChange={(value) => setGuestCount(Number(value) || 1)}
                    hideControls={false}
                  />

                  {nights > 0 ? (
                    <div className="detail-nights-badge">
                      <Clock3 size={14} />
                      {nights} noite{nights !== 1 ? 's' : ''} selecionada{nights !== 1 ? 's' : ''}
                    </div>
                  ) : null}

                  {availabilityNotice ? (
                    <Alert color={isDateRangeAvailable ? 'teal' : 'red'} variant="light" radius="md">
                      {availabilityNotice}
                    </Alert>
                  ) : null}

                  {bookingError ? <Alert color="red" variant="light" radius="md">{bookingError}</Alert> : null}

                  <Button type="submit" className="detail-reserve-btn" fullWidth disabled={checkingAvailability || !isDateRangeAvailable}>
                    {checkingAvailability ? 'Verificando disponibilidade...' : 'Reservar e pagar'}
                  </Button>

                  <Text size="xs" c="dimmed" ta="center">
                    Cancelamento gratuito antes do check-in
                  </Text>
                </Stack>
              </form>

              {units > 0 ? (
                <>
                  <Divider />
                  <Stack gap={0} className="cost-box">
                    <div className="detail-cost-row">
                      <Text size="sm" c="dimmed">{formatMoney(property.price)} x {units} {property.rent_type === 'diaria' ? 'noite(s)' : 'unidade(s)'}</Text>
                      <Text size="sm" fw={600}>{formatMoney(amounts.rentalBase)}</Text>
                    </div>
                    {amounts.cleaningFee > 0 ? (
                      <div className="detail-cost-row">
                        <Text size="sm" c="dimmed">Taxa de limpeza</Text>
                        <Text size="sm" fw={600}>{formatMoney(amounts.cleaningFee)}</Text>
                      </div>
                    ) : null}
                    <div className="detail-cost-row">
                      <Text size="sm" c="dimmed">Taxa de servico (10%)</Text>
                      <Text size="sm" fw={600}>{formatMoney(amounts.clientFee)}</Text>
                    </div>
                    <div className="detail-cost-row total">
                      <Text fw={700}>Total</Text>
                      <Text fw={800}>{formatMoney(amounts.totalPaid)}</Text>
                    </div>
                  </Stack>
                </>
              ) : null}
            </Stack>
          </Card>
        </aside>
      </div>
    </Stack>
  );
}
