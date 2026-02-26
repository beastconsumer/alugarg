import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { AlertCircle, CalendarDays, House, MapPin, MessageCircleMore, Star } from 'lucide-react';
import { findSeedPropertyById } from '../lib/seedProperties';
import { useAuth } from '../state/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Booking, parseBooking, parseProperty } from '../lib/types';

const statusMeta: Record<Booking['status'], { label: string; color: 'yellow' | 'teal' | 'blue' | 'gray' | 'red' | 'orange' }> = {
  pending_payment: { label: 'Pagar agora', color: 'orange' },
  pre_checking: { label: 'Check-in pendente', color: 'teal' },
  confirmed: { label: 'Confirmada', color: 'teal' },
  checked_in: { label: 'Em andamento', color: 'blue' },
  checked_out: { label: 'Concluida', color: 'gray' },
  cancelled: { label: 'Cancelada', color: 'red' },
};

const statusPriority: Record<string, number> = {
  pending_payment: 0,
  checked_in: 1,
  pre_checking: 2,
  confirmed: 2,
  checked_out: 3,
  cancelled: 4,
};

const parseTagList = (input: string): string[] => {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 6);
};

export function BookingsPage() {
  const { user, profile } = useAuth();
  const isHost = profile?.host_verification_status === 'verified' || profile?.role === 'admin';

  const [renterBookings, setRenterBookings] = useState<Booking[]>([]);
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([]);
  const [coversByPropertyId, setCoversByPropertyId] = useState<Record<string, string>>({});
  const [reviewedBookings, setReviewedBookings] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeReviewBooking, setActiveReviewBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTagsInput, setReviewTagsInput] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const closeReviewModal = () => {
    setActiveReviewBooking(null);
    setReviewRating(5);
    setReviewComment('');
    setReviewTagsInput('');
    setReviewSubmitting(false);
  };

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
      const uniqueIds = Array.from(new Set(allBookings.map((b) => b.property_id).filter(Boolean)));
      const nextCovers: Record<string, string> = {};
      const toFetch: string[] = [];

      uniqueIds.forEach((id) => {
        const seed = findSeedPropertyById(id);
        if (seed?.photos?.[0]) {
          nextCovers[id] = seed.photos[0];
          return;
        }
        toFetch.push(id);
      });

      if (toFetch.length > 0) {
        const { data, error } = await supabase.from('properties').select('*').in('id', toFetch);
        if (error) throw error;
        (data ?? []).forEach((row) => {
          const property = parseProperty(row);
          nextCovers[property.id] = property.photos[0] || '/background.png';
        });
      }

      setCoversByPropertyId(nextCovers);

      const checkedOutIds = parsedRenter.filter((booking) => booking.status === 'checked_out').map((booking) => booking.id);
      if (checkedOutIds.length > 0) {
        const { data: reviewRows, error: reviewError } = await supabase
          .from('owner_reviews')
          .select('booking_id')
          .eq('renter_id', user.id)
          .in('booking_id', checkedOutIds);

        if (reviewError) throw reviewError;

        const map: Record<string, true> = {};
        (reviewRows ?? []).forEach((row) => {
          const bookingId = String(row.booking_id ?? '');
          if (bookingId) {
            map[bookingId] = true;
          }
        });

        setReviewedBookings(map);
      } else {
        setReviewedBookings({});
      }
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

  const submitOwnerReview = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !activeReviewBooking) return;

    const comment = reviewComment.trim();
    if (reviewRating < 1 || reviewRating > 5) {
      setErrorMessage('A nota deve ser entre 1 e 5.');
      return;
    }

    setReviewSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        booking_id: activeReviewBooking.id,
        property_id: activeReviewBooking.property_id,
        renter_id: user.id,
        owner_id: activeReviewBooking.owner_id,
        rating: reviewRating,
        tags: parseTagList(reviewTagsInput),
        comment,
      };

      const { error } = await supabase.from('owner_reviews').insert(payload);
      if (error) throw error;

      setReviewedBookings((current) => ({
        ...current,
        [activeReviewBooking.id]: true,
      }));
      closeReviewModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel enviar avaliacao.';
      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
        setReviewedBookings((current) => ({
          ...current,
          [activeReviewBooking.id]: true,
        }));
        closeReviewModal();
        return;
      }
      setErrorMessage(message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const sortedRenter = useMemo(
    () => [...renterBookings].sort((a, b) => (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9)),
    [renterBookings],
  );

  const pendingCount = renterBookings.filter((booking) => booking.status === 'pending_payment').length;
  const ownerActiveCount = ownerBookings.filter((booking) =>
    ['pre_checking', 'confirmed', 'checked_in'].includes(booking.status),
  ).length;

  const sortedOwner = useMemo(
    () => [...ownerBookings].sort((a, b) => (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9)),
    [ownerBookings],
  );

  return (
    <Stack gap="lg" py="md">
      <Modal
        opened={Boolean(activeReviewBooking)}
        onClose={closeReviewModal}
        title="Avaliar estadia"
        centered
        radius="lg"
      >
        {activeReviewBooking ? (
          <form onSubmit={submitOwnerReview}>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {activeReviewBooking.property_title}
              </Text>
              <Text size="xs" c="dimmed">
                {formatDate(activeReviewBooking.check_in_date)} - {formatDate(activeReviewBooking.check_out_date)}
              </Text>

              <Stack gap={6}>
                <Text size="sm" fw={600}>Como foi sua experiencia?</Text>
                <Group gap={6}>
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = reviewRating >= value;
                    return (
                      <ActionIcon
                        key={value}
                        size={36}
                        radius="xl"
                        variant={active ? 'filled' : 'light'}
                        color={active ? 'yellow' : 'gray'}
                        onClick={() => setReviewRating(value)}
                        aria-label={`Nota ${value}`}
                      >
                        <Star size={18} fill={active ? 'currentColor' : 'none'} />
                      </ActionIcon>
                    );
                  })}
                </Group>
              </Stack>

              <TextInput
                label="Tags (separe por virgula)"
                placeholder="Limpeza, comunicacao, check-in"
                value={reviewTagsInput}
                onChange={(event) => setReviewTagsInput(event.currentTarget.value)}
              />

              <Textarea
                label="Comentario"
                placeholder="Conte como foi a estadia"
                minRows={3}
                maxRows={6}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.currentTarget.value)}
              />

              <Group justify="flex-end">
                <Button variant="default" onClick={closeReviewModal} disabled={reviewSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" loading={reviewSubmitting}>
                  Enviar avaliacao
                </Button>
              </Group>
            </Stack>
          </form>
        ) : null}
      </Modal>

      <Card withBorder radius="xl" p="lg" className="bookings-header-card">
        <Stack gap={4}>
          <Title order={2}>Viagens</Title>
          <Text c="dimmed" size="sm">Suas reservas e hospedagens.</Text>
        </Stack>
      </Card>

      {errorMessage ? (
        <Alert color="red" icon={<AlertCircle size={16} />} radius="xl">
          {errorMessage}
        </Alert>
      ) : null}

      {pendingCount > 0 && !loading ? (
        <Alert color="orange" radius="xl" icon={<AlertCircle size={16} />}>
          {pendingCount === 1
            ? 'Voce tem 1 reserva aguardando pagamento.'
            : `Voce tem ${pendingCount} reservas aguardando pagamento.`}
        </Alert>
      ) : null}

      <Card withBorder radius="xl" p={0} className="booking-list-card">
        <div className="booking-list-head">
          <Text fw={700} size="sm">Minhas viagens</Text>
          {!loading && renterBookings.length > 0 ? (
            <Text size="xs" c="dimmed">{renterBookings.length} reserva{renterBookings.length > 1 ? 's' : ''}</Text>
          ) : null}
        </div>

        {loading ? (
          <Stack gap={0}>
            {[1, 2, 3].map((item) => (
              <div key={item} className="booking-list-item">
                <Skeleton width={72} height={72} radius={12} />
                <Stack gap={6} style={{ flex: 1 }}>
                  <Skeleton height={14} width="60%" radius="md" />
                  <Skeleton height={12} width="40%" radius="md" />
                  <Skeleton height={20} width={90} radius="xl" />
                </Stack>
                <Skeleton height={30} width={70} radius="xl" />
              </div>
            ))}
          </Stack>
        ) : sortedRenter.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MapPin size={30} /></div>
            <Text fw={700}>Sem viagens ainda</Text>
            <Text c="dimmed" size="sm">Reserve um imovel para comecar sua proxima aventura.</Text>
            <Button component={Link} to="/app/home" radius="xl" variant="light" size="sm">
              Explorar imoveis
            </Button>
          </div>
        ) : (
          <Stack gap={0}>
            {sortedRenter.map((booking) => {
              const norm: Booking['status'] = booking.status === 'confirmed' ? 'pre_checking' : booking.status;
              const meta = statusMeta[norm];
              const cover = coversByPropertyId[booking.property_id] || '/background.png';
              const alreadyReviewed = Boolean(reviewedBookings[booking.id]);

              return (
                <div key={booking.id} className="booking-list-item">
                  <img
                    src={cover}
                    alt={booking.property_title}
                    className="booking-list-thumb"
                    onError={(event) => {
                      (event.target as HTMLImageElement).src = '/background.png';
                    }}
                  />

                  <Stack gap={4} className="booking-list-body">
                    <Text fw={700} size="sm" lineClamp={1}>{booking.property_title}</Text>
                    <Group gap={4} align="center">
                      <CalendarDays size={12} style={{ color: '#7a8baa', flexShrink: 0 }} />
                      <Text size="xs" c="dimmed">
                        {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
                      </Text>
                    </Group>
                    <Group gap={8} align="center">
                      <Badge size="xs" variant="light" color={meta.color} radius="xl">{meta.label}</Badge>
                      <Text size="xs" c="dimmed">{formatMoney(booking.total_paid_by_renter)}</Text>
                    </Group>
                  </Stack>

                  <div className="booking-list-action">
                    {norm === 'pending_payment' ? (
                      <Button component={Link} to={`/app/checkout/${booking.id}`} size="xs" color="orange" radius="xl">
                        Pagar
                      </Button>
                    ) : null}
                    {['pre_checking', 'checked_in', 'checked_out'].includes(norm) ? (
                      <Button
                        component={Link}
                        to={`/app/chat?bookingId=${booking.id}`}
                        size="xs"
                        variant="default"
                        radius="xl"
                        leftSection={<MessageCircleMore size={13} />}
                      >
                        Chat
                      </Button>
                    ) : null}
                    {norm === 'checked_out' ? (
                      alreadyReviewed ? (
                        <Button size="xs" radius="xl" variant="light" color="teal" disabled>
                          Avaliado
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          radius="xl"
                          color="yellow"
                          leftSection={<Star size={13} />}
                          onClick={() => setActiveReviewBooking(booking)}
                        >
                          Avaliar
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Stack>
        )}
      </Card>

      {isHost ? (
        <Card withBorder radius="xl" p={0} className="booking-list-card">
          <div className="booking-list-head">
            <Text fw={700} size="sm">Anfitriao</Text>
            {!loading && ownerActiveCount > 0 ? (
              <Badge size="xs" color="teal" variant="light" radius="xl">
                {ownerActiveCount} ativa{ownerActiveCount > 1 ? 's' : ''}
              </Badge>
            ) : null}
          </div>

          {loading ? (
            <Stack gap={0}>
              {[1, 2].map((item) => (
                <div key={item} className="booking-list-item">
                  <Skeleton width={72} height={72} radius={12} />
                  <Stack gap={6} style={{ flex: 1 }}>
                    <Skeleton height={14} width="60%" radius="md" />
                    <Skeleton height={12} width="40%" radius="md" />
                    <Skeleton height={20} width={90} radius="xl" />
                  </Stack>
                  <Skeleton height={30} width={70} radius="xl" />
                </div>
              ))}
            </Stack>
          ) : ownerBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><House size={30} /></div>
              <Text fw={700}>Nenhuma reserva recebida</Text>
              <Text c="dimmed" size="sm">Quando um hospede reservar seu imovel, aparecera aqui.</Text>
            </div>
          ) : (
            <Stack gap={0}>
              {sortedOwner.map((booking) => {
                const norm: Booking['status'] = booking.status === 'confirmed' ? 'pre_checking' : booking.status;
                const meta = statusMeta[norm];
                const cover = coversByPropertyId[booking.property_id] || '/background.png';

                return (
                  <div key={booking.id} className="booking-list-item">
                    <img
                      src={cover}
                      alt={booking.property_title}
                      className="booking-list-thumb"
                      onError={(event) => {
                        (event.target as HTMLImageElement).src = '/background.png';
                      }}
                    />

                    <Stack gap={4} className="booking-list-body">
                      <Text fw={700} size="sm" lineClamp={1}>{booking.property_title}</Text>
                      <Group gap={4} align="center">
                        <CalendarDays size={12} style={{ color: '#7a8baa', flexShrink: 0 }} />
                        <Text size="xs" c="dimmed">
                          {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
                        </Text>
                      </Group>
                      <Group gap={8} align="center">
                        <Badge size="xs" variant="light" color={meta.color} radius="xl">{meta.label}</Badge>
                        <Text size="xs" c="dimmed">Repasse: {formatMoney(booking.owner_payout_amount)}</Text>
                      </Group>
                    </Stack>

                    <div className="booking-list-action">
                      {norm === 'pre_checking' ? (
                        <Stack gap={5} align="flex-end">
                          <Button size="xs" radius="xl" onClick={() => void updateStatus(booking.id, 'checked_in')}>
                            Check-in
                          </Button>
                          <Button
                            component={Link}
                            to={`/app/chat?bookingId=${booking.id}`}
                            size="xs"
                            variant="default"
                            radius="xl"
                          >
                            Chat
                          </Button>
                        </Stack>
                      ) : null}
                      {norm === 'checked_in' ? (
                        <Stack gap={5} align="flex-end">
                          <Button size="xs" radius="xl" onClick={() => void updateStatus(booking.id, 'checked_out')}>
                            Finalizar
                          </Button>
                          <Button
                            component={Link}
                            to={`/app/chat?bookingId=${booking.id}`}
                            size="xs"
                            variant="default"
                            radius="xl"
                          >
                            Chat
                          </Button>
                        </Stack>
                      ) : null}
                      {norm === 'checked_out' ? (
                        <Button component={Link} to={`/app/chat?bookingId=${booking.id}`} size="xs" variant="subtle" radius="xl">
                          Chat
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </Stack>
          )}
        </Card>
      ) : null}
    </Stack>
  );
}
