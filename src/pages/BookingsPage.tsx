import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { CalendarCheck2, CircleDollarSign, Clock3, House } from 'lucide-react';
import { findSeedPropertyById } from '../lib/seedProperties';
import { useAuth } from '../state/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Booking, parseBooking, parseProperty } from '../lib/types';

const bookingStatusMeta: Record<
  Booking['status'],
  { label: string; color: 'yellow' | 'teal' | 'blue' | 'gray' | 'red' }
> = {
  pending_payment: { label: 'Pagamento pendente', color: 'yellow' },
  pre_checking: { label: 'Pre-checking', color: 'teal' },
  confirmed: { label: 'Check-in pendente', color: 'teal' },
  checked_in: { label: 'Check-in realizado', color: 'blue' },
  checked_out: { label: 'Finalizada', color: 'gray' },
  cancelled: { label: 'Cancelada', color: 'red' },
};

export function BookingsPage() {
  const { user, profile } = useAuth();
  const isHost = profile?.host_verification_status === 'verified' || profile?.role === 'admin';

  const [renterBookings, setRenterBookings] = useState<Booking[]>([]);
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([]);
  const [bookingCoversByPropertyId, setBookingCoversByPropertyId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const [renterRes, ownerRes] = await Promise.all([
        supabase.from('bookings').select('*').eq('renter_id', user.id).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (renterRes.error) throw renterRes.error;
      if (ownerRes.error) throw ownerRes.error;

      const parsedRenter = (renterRes.data ?? []).map((row) => parseBooking(row));
      const parsedOwner = (ownerRes.data ?? []).map((row) => parseBooking(row));

      setRenterBookings(parsedRenter);
      setOwnerBookings(parsedOwner);

      const allBookings = [...parsedRenter, ...parsedOwner];
      const uniquePropertyIds = Array.from(new Set(allBookings.map((item) => item.property_id).filter(Boolean)));

      const nextCovers: Record<string, string> = {};
      const idsToFetchFromDb: string[] = [];

      uniquePropertyIds.forEach((propertyId) => {
        const seedProperty = findSeedPropertyById(propertyId);
        if (seedProperty?.photos?.[0]) {
          nextCovers[propertyId] = seedProperty.photos[0];
          return;
        }
        idsToFetchFromDb.push(propertyId);
      });

      if (idsToFetchFromDb.length > 0) {
        const { data: propertiesRaw, error: propertiesError } = await supabase
          .from('properties')
          .select('*')
          .in('id', idsToFetchFromDb);

        if (propertiesError) throw propertiesError;

        (propertiesRaw ?? []).forEach((row) => {
          const property = parseProperty(row);
          nextCovers[property.id] = property.photos[0] || '/background.png';
        });
      }

      setBookingCoversByPropertyId(nextCovers);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const updateStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar status');
    }
  };

  const renterStats = useMemo(() => {
    const pendingPayment = renterBookings.filter((item) => item.status === 'pending_payment').length;
    const active = renterBookings.filter(
      (item) => item.status === 'pre_checking' || item.status === 'confirmed' || item.status === 'checked_in',
    ).length;
    const completed = renterBookings.filter((item) => item.status === 'checked_out').length;

    return { pendingPayment, active, completed };
  }, [renterBookings]);

  const ownerStats = useMemo(() => {
    const upcoming = ownerBookings.filter((item) => item.status === 'pre_checking' || item.status === 'confirmed').length;
    const inStay = ownerBookings.filter((item) => item.status === 'checked_in').length;
    const totalPayout = ownerBookings
      .filter(
        (item) =>
          item.status === 'pre_checking' ||
          item.status === 'confirmed' ||
          item.status === 'checked_in' ||
          item.status === 'checked_out',
      )
      .reduce((acc, item) => acc + item.owner_payout_amount, 0);

    return { upcoming, inStay, totalPayout };
  }, [ownerBookings]);

  return (
    <Stack gap="md" py="md">
      <Card withBorder radius="xl" p="lg">
        <Stack gap="xs">
          <Title order={2}>Reservas</Title>
          <Text c="dimmed">Acompanhe suas viagens, pagamentos e status da hospedagem.</Text>
        </Stack>
      </Card>

      {loading ? <Text c="dimmed">Carregando reservas...</Text> : null}
      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Tabs defaultValue="renter" radius="md" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="renter">Minhas viagens</Tabs.Tab>
          {isHost ? <Tabs.Tab value="owner">Hospedagens como anfitriao</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="renter" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Card withBorder radius="lg" p="md" className="bookings-kpi-card">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">
                      Pagamento pendente
                    </Text>
                    <Title order={3}>{renterStats.pendingPayment}</Title>
                  </Stack>
                  <Clock3 size={20} />
                </Group>
              </Card>

              <Card withBorder radius="lg" p="md" className="bookings-kpi-card">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">
                      Viagens ativas
                    </Text>
                    <Title order={3}>{renterStats.active}</Title>
                  </Stack>
                  <CalendarCheck2 size={20} />
                </Group>
              </Card>

              <Card withBorder radius="lg" p="md" className="bookings-kpi-card">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">
                      Concluidas
                    </Text>
                    <Title order={3}>{renterStats.completed}</Title>
                  </Stack>
                  <House size={20} />
                </Group>
              </Card>
            </SimpleGrid>

            <Card withBorder radius="xl" p="lg">
              <Stack gap="md">
                <Title order={4}>Minhas reservas</Title>
                {renterBookings.length === 0 ? <Text c="dimmed">Sem reservas no momento.</Text> : null}

                {renterBookings.map((booking) => {
                  const normalizedStatus: Booking['status'] =
                    booking.status === 'confirmed' ? 'pre_checking' : booking.status;
                  const meta = bookingStatusMeta[normalizedStatus];

                  return (
                    <Card key={booking.id} withBorder radius="lg" p="md" className="booking-card">
                      <Group wrap="wrap" className="booking-card-row">
                        <div className="booking-card-cover-wrap">
                          <img
                            src={bookingCoversByPropertyId[booking.property_id] || '/background.png'}
                            alt={booking.property_title}
                            className="booking-card-cover"
                          />
                        </div>

                        <Stack gap="sm" className="booking-card-main">
                          <Stack gap={5}>
                            <Text fw={700}>{booking.property_title}</Text>
                            <Text size="sm" c="dimmed">
                              {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
                            </Text>
                            <Text size="sm">Total pago: {formatMoney(booking.total_paid_by_renter)}</Text>
                            <Badge variant="light" color={meta.color}>
                              {meta.label}
                            </Badge>
                          </Stack>

                          <Group wrap="wrap" gap="xs">
                            {normalizedStatus === 'pending_payment' ? (
                              <Button component={Link} to={`/app/checkout/${booking.id}`} size="xs">
                                Pagar agora
                              </Button>
                            ) : null}
                            {normalizedStatus === 'pre_checking' ? (
                              <Button size="xs" variant="light" color="teal" disabled>
                                Check-in pendente
                              </Button>
                            ) : null}
                            {['pre_checking', 'checked_in', 'checked_out'].includes(normalizedStatus) ? (
                              <Button component={Link} to={`/app/chat?bookingId=${booking.id}`} size="xs" variant="default">
                                Chat com anfitriao
                              </Button>
                            ) : null}

                            {normalizedStatus === 'checked_out' ? (
                              <Button component={Link} to="/app/profile" size="xs" variant="default">
                                Avaliar anfitriao
                              </Button>
                            ) : null}
                          </Group>
                        </Stack>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>

        {isHost ? <Tabs.Panel value="owner" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Card withBorder radius="lg" p="md" className="bookings-kpi-card">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">
                      Check-ins pendentes
                    </Text>
                    <Title order={3}>{ownerStats.upcoming}</Title>
                  </Stack>
                  <CalendarCheck2 size={20} />
                </Group>
              </Card>

              <Card withBorder radius="lg" p="md" className="bookings-kpi-card">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">
                      Hospedagens em curso
                    </Text>
                    <Title order={3}>{ownerStats.inStay}</Title>
                  </Stack>
                  <House size={20} />
                </Group>
              </Card>

              <Card withBorder radius="lg" p="md" className="bookings-kpi-card">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed">
                      Repasse acumulado
                    </Text>
                    <Title order={4}>{formatMoney(ownerStats.totalPayout)}</Title>
                  </Stack>
                  <CircleDollarSign size={20} />
                </Group>
              </Card>
            </SimpleGrid>

            <Card withBorder radius="xl" p="lg">
              <Stack gap="md">
                <Title order={4}>Reservas dos meus anuncios</Title>
                {ownerBookings.length === 0 ? <Text c="dimmed">Sem reservas nos seus imoveis.</Text> : null}

                {ownerBookings.map((booking) => {
                  const normalizedStatus: Booking['status'] =
                    booking.status === 'confirmed' ? 'pre_checking' : booking.status;
                  const meta = bookingStatusMeta[normalizedStatus];
                  return (
                    <Card key={booking.id} withBorder radius="lg" p="md" className="booking-card">
                      <Group wrap="wrap" className="booking-card-row">
                        <div className="booking-card-cover-wrap">
                          <img
                            src={bookingCoversByPropertyId[booking.property_id] || '/background.png'}
                            alt={booking.property_title}
                            className="booking-card-cover"
                          />
                        </div>

                        <Stack gap="sm" className="booking-card-main">
                          <Stack gap={5}>
                            <Text fw={700}>{booking.property_title}</Text>
                            <Text size="sm" c="dimmed">
                              {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
                            </Text>
                            <Text size="sm">Repasse previsto: {formatMoney(booking.owner_payout_amount)}</Text>
                            <Badge variant="light" color={meta.color}>
                              {meta.label}
                            </Badge>
                          </Stack>

                          <Group wrap="wrap" gap="xs">
                            {['pre_checking', 'checked_in', 'checked_out'].includes(normalizedStatus) ? (
                              <Button component={Link} to={`/app/chat?bookingId=${booking.id}`} size="xs" variant="default">
                                Abrir chat
                              </Button>
                            ) : null}
                            {normalizedStatus === 'pre_checking' ? (
                              <Button size="xs" variant="default" onClick={() => void updateStatus(booking.id, 'checked_in')}>
                                Confirmar check-in
                              </Button>
                            ) : null}
                            {normalizedStatus === 'checked_in' ? (
                              <Button size="xs" onClick={() => void updateStatus(booking.id, 'checked_out')}>
                                Finalizar estadia
                              </Button>
                            ) : null}
                          </Group>
                        </Stack>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel> : null}
      </Tabs>
    </Stack>
  );
}
