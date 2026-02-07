import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useAuth } from '../state/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Booking, parseBooking } from '../lib/types';

export function BookingsPage() {
  const { user } = useAuth();

  const [renterBookings, setRenterBookings] = useState<Booking[]>([]);
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([]);
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

      setRenterBookings((renterRes.data ?? []).map((row) => parseBooking(row)));
      setOwnerBookings((ownerRes.data ?? []).map((row) => parseBooking(row)));
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

  return (
    <Stack gap="md" py="md" pb={96}>
      <Card withBorder radius="xl" p="lg">
        <Stack gap="xs">
          <Title order={2}>Reservas</Title>
          <Text c="dimmed">Acompanhe pagamentos, check-in e finalizacao das locacoes.</Text>
        </Stack>
      </Card>

      {loading ? <Text c="dimmed">Carregando reservas...</Text> : null}
      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Card withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Title order={3}>Minhas reservas (inquilino)</Title>

          {renterBookings.length === 0 ? <Text c="dimmed">Sem reservas no momento.</Text> : null}

          {renterBookings.map((booking) => (
            <Card key={booking.id} withBorder radius="lg" p="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text fw={700}>{booking.property_title}</Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
                  </Text>
                  <Text size="sm">Total pago: {formatMoney(booking.total_paid_by_renter)}</Text>
                  <Badge variant="light">Status: {booking.status}</Badge>
                </Stack>

                {booking.status === 'pending_payment' ? (
                  <Button size="xs" onClick={() => void updateStatus(booking.id, 'confirmed')}>
                    Marcar pagamento
                  </Button>
                ) : null}
              </Group>
            </Card>
          ))}
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Title order={3}>Reservas dos meus imoveis (proprietario)</Title>

          {ownerBookings.length === 0 ? <Text c="dimmed">Sem reservas nos seus imoveis.</Text> : null}

          {ownerBookings.map((booking) => (
            <Card key={booking.id} withBorder radius="lg" p="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text fw={700}>{booking.property_title}</Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
                  </Text>
                  <Text size="sm">Repasse previsto: {formatMoney(booking.owner_payout_amount)}</Text>
                  <Badge variant="light">Status: {booking.status}</Badge>
                </Stack>

                <Group>
                  {booking.status === 'confirmed' ? (
                    <Button size="xs" variant="default" onClick={() => void updateStatus(booking.id, 'checked_in')}>
                      Check-in
                    </Button>
                  ) : null}
                  {booking.status === 'checked_in' ? (
                    <Button size="xs" onClick={() => void updateStatus(booking.id, 'checked_out')}>
                      Finalizar
                    </Button>
                  ) : null}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
