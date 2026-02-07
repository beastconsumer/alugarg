import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  BellRing,
  Building2,
  CarFront,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Navigation,
  PartyPopper,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
  MessageCircle,
];

const getAmenityIcon = (amenity: string): LucideIcon => {
  const seed = amenity.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return amenityIconPool[seed % amenityIconPool.length];
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
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      setLoading(true);
      setErrorMessage('');

      try {
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

  const onCreateBooking = async (event: FormEvent) => {
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

    setBookingLoading(true);
    setBookingError('');
    setBookingMessage('');

    try {
      const { error } = await supabase.from('bookings').insert({
        property_id: property.id,
        property_title: property.title,
        renter_id: user.id,
        owner_id: property.owner_id,
        check_in_date: new Date(`${checkInDate}T12:00:00`).toISOString(),
        check_out_date: new Date(`${checkOutDate}T12:00:00`).toISOString(),
        units,
        base_amount: amounts.rentalBase + amounts.cleaningFee,
        client_fee_amount: amounts.clientFee,
        owner_fee_amount: amounts.ownerFee,
        total_paid_by_renter: amounts.totalPaid,
        owner_payout_amount: amounts.ownerPayout,
        status: 'pending_payment',
      });

      if (error) throw error;

      setBookingMessage('Reserva criada com sucesso. Veja em Reservas para acompanhar.');
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Falha ao reservar');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <Stack py="md" pb={96}>
        <Text c="dimmed">Carregando imovel...</Text>
      </Stack>
    );
  }

  if (!property) {
    return (
      <Stack py="md" pb={96}>
        <Alert color="red" icon={<AlertCircle size={16} />}>
          {errorMessage || 'Imovel nao encontrado.'}
        </Alert>
      </Stack>
    );
  }

  const whatsappText = encodeURIComponent(
    `Ola! Vi seu anuncio no Aluga Aluga: ${property.title}. Ainda esta disponivel?`,
  );
  const ownerPhone = owner?.phone ?? '';
  const whatsappUrl = ownerPhone ? `https://wa.me/${ownerPhone.replace(/\D/g, '')}?text=${whatsappText}` : '';

  return (
    <Stack gap="md" py="md" pb={96}>
      <Group justify="space-between">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </Group>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {(property.photos.length > 0 ? property.photos : ['/background.png']).map((photo, index) => (
              <Box key={`${photo}-${index}`} className="detail-photo-wrap">
                <img src={photo} alt={`${property.title} ${index + 1}`} className="detail-photo" />
              </Box>
            ))}
          </SimpleGrid>

          <Stack gap={6}>
            <Title order={2}>{property.title}</Title>
            <Text c="dimmed">{property.location.addressText || 'Balneario Cassino'}</Text>
            <Title order={3} c="ocean.7">
              {formatMoney(property.price)}
            </Title>
          </Stack>

          <Group gap="xs" wrap="wrap">
            <Badge size="lg" color="ocean">
              {property.rent_type}
            </Badge>
            {property.pet_friendly ? <Badge size="lg" color="teal">Pet friendly</Badge> : null}
            {property.furnished ? <Badge size="lg" color="blue">Mobiliado</Badge> : null}
            {property.verified ? (
              <Badge size="lg" color="teal" leftSection={<ShieldCheck size={14} />}>
                Verificado
              </Badge>
            ) : null}
          </Group>

          <Text>{property.description}</Text>

          <Title order={4}>Estrutura</Title>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light">{property.guests_capacity} hospedes</Badge>
            <Badge variant="light">{property.bedrooms} quartos</Badge>
            <Badge variant="light">{property.suites} suites</Badge>
            <Badge variant="light">{property.bathrooms} banheiros</Badge>
            <Badge variant="light">{property.garage_spots} vagas</Badge>
            <Badge variant="light">{property.area_m2} m2</Badge>
          </Group>

          <Title order={4}>O que esse lugar oferece</Title>
          {property.amenities.length > 0 ? (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" className="amenities-grid">
                {(showAllAmenities ? property.amenities : property.amenities.slice(0, 10)).map((item) => {
                  const AmenityIcon = getAmenityIcon(item);
                  return (
                    <div key={item} className="amenity-item">
                      <AmenityIcon size={18} />
                      <Text size="md">{getAmenityLabel(item)}</Text>
                    </div>
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

          <Title order={4}>Politicas da estadia</Title>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light">Minimo: {property.minimum_nights} noite(s)</Badge>
            <Badge variant="light">Check-in: {property.check_in_time}</Badge>
            <Badge variant="light">Check-out: {property.check_out_time}</Badge>
            <Badge variant="light">Festas: {property.events_allowed ? 'permitido' : 'nao permitido'}</Badge>
            <Badge variant="light">Fumantes: {property.smoking_allowed ? 'permitido' : 'nao permitido'}</Badge>
          </Group>

          {property.house_rules ? (
            <Card withBorder radius="lg" p="sm">
              <Text size="sm" fw={700}>
                Regras da casa
              </Text>
              <Text size="sm" c="dimmed">
                {property.house_rules}
              </Text>
            </Card>
          ) : null}

          <Group grow>
            {whatsappUrl ? (
              <Button component="a" href={whatsappUrl} target="_blank" rel="noreferrer" leftSection={<MessageCircle size={16} />}>
                Chamar no WhatsApp
              </Button>
            ) : (
              <Button variant="default" disabled>
                WhatsApp indisponivel
              </Button>
            )}

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
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Title order={3}>Reservar / Alugar</Title>
          <Text c="dimmed" size="sm">
            Taxas: cliente 10% sobre base, proprietario 4% no repasse. Taxa de limpeza incluida no total.
          </Text>

          <form onSubmit={onCreateBooking}>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Check-in"
                  type="date"
                  value={checkInDate}
                  onChange={(event) => setCheckInDate(event.currentTarget.value)}
                  required
                />
                <TextInput
                  label="Check-out"
                  type="date"
                  value={checkOutDate}
                  onChange={(event) => setCheckOutDate(event.currentTarget.value)}
                  required
                />
              </SimpleGrid>

              <Card radius="lg" withBorder className="cost-box" p="md">
                <Stack gap={4}>
                  <Text size="sm">Noites selecionadas: {nights}</Text>
                  <Text size="sm">Unidades cobradas ({property.rent_type}): {units}</Text>
                  <Text size="sm">Base de locacao: {formatMoney(amounts.rentalBase)}</Text>
                  <Text size="sm">Taxa de limpeza: {formatMoney(amounts.cleaningFee)}</Text>
                  <Text size="sm">Taxa cliente (10%): {formatMoney(amounts.clientFee)}</Text>
                  <Text fw={700}>Total cliente: {formatMoney(amounts.totalPaid)}</Text>
                  <Text size="sm">Repasse proprietario: {formatMoney(amounts.ownerPayout)}</Text>
                  <Text size="sm" c="dimmed">
                    Caucao informada: {formatMoney(property.security_deposit)} (tratada a parte da reserva).
                  </Text>
                </Stack>
              </Card>

              {bookingError ? <Alert color="red">{bookingError}</Alert> : null}
              {bookingMessage ? <Alert color="green">{bookingMessage}</Alert> : null}

              <Button type="submit" loading={bookingLoading}>
                Confirmar reserva
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Stack>
  );
}
