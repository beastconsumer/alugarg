import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { LogOut, ShieldCheck, Star, Upload } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { supabase, uploadImageAndGetPublicUrl } from '../lib/supabase';
import {
  Booking,
  OwnerReview,
  Property,
  parseBooking,
  parseOwnerReview,
  parseProperty,
  statusLabel,
} from '../lib/types';

const reviewTags = ['Pontual', 'Comunicacao boa', 'Imovel limpo', 'Confiavel', 'Recomendo', 'Check-in facil'];

const bookingStatusLabel: Record<string, string> = {
  pending_payment: 'Pagamento pendente',
  pre_checking: 'Pre-checking',
  confirmed: 'Confirmada',
  checked_in: 'Check-in',
  checked_out: 'Check-out',
  cancelled: 'Cancelada',
};

const hostVerificationLabel: Record<string, string> = {
  not_started: 'Nao iniciado',
  pending: 'Em analise',
  verified: 'Verificado',
  rejected: 'Rejeitado',
};

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const displayName = (profile?.name || 'Perfil').trim();
  const displayNameShort = displayName.split(' ').slice(0, 2).join(' ');
  const isAdmin = profile?.role === 'admin';
  const isHost = profile?.host_verification_status === 'verified' || isAdmin;

  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [myProperties, setMyProperties] = useState<Property[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [reviewsGiven, setReviewsGiven] = useState<OwnerReview[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<OwnerReview[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTagsSelected, setReviewTagsSelected] = useState<string[]>([]);
  const [reviewBookingId, setReviewBookingId] = useState('');

  useEffect(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setCpf(profile?.cpf ?? '');
    setBirthDate(profile?.birth_date ?? '');
  }, [profile]);

  const loadData = async () => {
    if (!user) return;

    setLoadingData(true);
    setErrorMessage('');

    try {
      const [propertiesRes, bookingsRes, givenReviewsRes, receivedReviewsRes] = await Promise.all([
        supabase.from('properties').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').eq('renter_id', user.id).order('created_at', { ascending: false }),
        supabase.from('owner_reviews').select('*').eq('renter_id', user.id).order('created_at', { ascending: false }),
        supabase.from('owner_reviews').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (propertiesRes.error) throw propertiesRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (givenReviewsRes.error) throw givenReviewsRes.error;
      if (receivedReviewsRes.error) throw receivedReviewsRes.error;

      setMyProperties((propertiesRes.data ?? []).map((row) => parseProperty(row)));
      setMyBookings((bookingsRes.data ?? []).map((row) => parseBooking(row)));
      setReviewsGiven((givenReviewsRes.data ?? []).map((row) => parseOwnerReview(row)));
      setReceivedReviews((receivedReviewsRes.data ?? []).map((row) => parseOwnerReview(row)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar perfil');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const pendingReviewBookings = useMemo(() => {
    const reviewedBookingIds = new Set(reviewsGiven.map((review) => review.booking_id));
    return myBookings.filter((booking) => booking.status === 'checked_out' && !reviewedBookingIds.has(booking.id));
  }, [myBookings, reviewsGiven]);

  const profileStats = useMemo(() => {
    const avgRating =
      receivedReviews.length > 0
        ? receivedReviews.reduce((acc, item) => acc + item.rating, 0) / receivedReviews.length
        : 0;

    return {
      avgRating,
      activeProperties: myProperties.filter((item) => item.status === 'approved').length,
      totalBookings: myBookings.length,
      totalReviews: receivedReviews.length,
      totalGivenReviews: reviewsGiven.length,
    };
  }, [myBookings.length, myProperties, receivedReviews, reviewsGiven.length]);

  const hostCtaLabel =
    profile?.host_verification_status === 'verified'
      ? 'Anunciar meu imovel'
      : profile?.host_verification_status === 'pending'
        ? 'Validacao em andamento'
        : 'Quero ser anfitriao';

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          phone: phone.trim(),
          cpf: cpf.trim(),
          birth_date: birthDate || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao salvar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatarSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setErrorMessage('');

    try {
      const path = `${user.id}/avatar/${Date.now()}.jpg`;
      const url = await uploadImageAndGetPublicUrl(file, path);

      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;

      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao subir avatar');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const toggleTag = (tag: string) => {
    setReviewTagsSelected((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !reviewBookingId) return;

    const booking = myBookings.find((item) => item.id === reviewBookingId);
    if (!booking) {
      setErrorMessage('Reserva invalida para avaliacao.');
      return;
    }

    try {
      const { error } = await supabase.from('owner_reviews').insert({
        booking_id: booking.id,
        property_id: booking.property_id,
        renter_id: user.id,
        owner_id: booking.owner_id,
        rating: reviewRating,
        tags: reviewTagsSelected,
        comment: reviewComment.trim(),
      });

      if (error) throw error;

      setReviewBookingId('');
      setReviewComment('');
      setReviewTagsSelected([]);
      setReviewRating(5);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar avaliacao');
    }
  };

  return (
    <Stack gap="md" py="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Perfil</Title>
        <Button color="red" variant="light" leftSection={<LogOut size={16} />} onClick={() => void signOut()}>
          Sair
        </Button>
      </Group>

      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Card withBorder radius="xl" p="lg" className="profile-mobile-id-card">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="md" wrap="wrap" align="flex-start">
              <div className="profile-mobile-avatar-wrap">
                <Avatar src={profile?.avatar_url || '/logoapp.png'} size={92} radius="50%" />
                <span className="profile-mobile-verify-dot" aria-hidden />
              </div>
              <Stack gap={3}>
                <Title order={3} className="profile-mobile-name">
                  {displayNameShort || 'Perfil'}
                </Title>
                <Text size="sm" c="dimmed">
                  {profile?.email || '-'}
                </Text>
                <Badge variant="light">
                  Validacao anfitriao: {hostVerificationLabel[profile?.host_verification_status || 'not_started']}
                </Badge>
              </Stack>
            </Group>

            <label>
              <Button component="span" variant="light" leftSection={<Upload size={16} />} loading={avatarUploading}>
                Alterar foto
              </Button>
              <input type="file" accept="image/*" onChange={onAvatarSelected} hidden />
            </label>
          </Group>

          <Button component={Link} to="/app/announce" fullWidth>
            {hostCtaLabel}
          </Button>

          {isAdmin ? (
            <Button
              component="a"
              href="/admin.html"
              variant="default"
              fullWidth
              leftSection={<ShieldCheck size={16} />}
            >
              Painel admin
            </Button>
          ) : null}
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: isHost ? 4 : 3 }} spacing="md">
        {isHost ? (
          <Card withBorder radius="xl" p="md" className="profile-section-card">
            <Text size="sm" c="dimmed">
              Anuncios ativos
            </Text>
            <Title order={3}>{profileStats.activeProperties}</Title>
          </Card>
        ) : null}
        <Card withBorder radius="xl" p="md" className="profile-section-card">
          <Text size="sm" c="dimmed">
            Minhas reservas
          </Text>
          <Title order={3}>{profileStats.totalBookings}</Title>
        </Card>
        <Card withBorder radius="xl" p="md" className="profile-section-card">
          <Text size="sm" c="dimmed">
            Avaliacoes feitas
          </Text>
          <Title order={3}>{profileStats.totalGivenReviews}</Title>
        </Card>
        {isHost ? (
          <Card withBorder radius="xl" p="md" className="profile-section-card">
            <Text size="sm" c="dimmed">
              Nota media como anfitriao
            </Text>
            <Title order={3}>{profileStats.avgRating > 0 ? profileStats.avgRating.toFixed(1) : '-'}</Title>
          </Card>
        ) : null}
      </SimpleGrid>

      <Card withBorder radius="xl" p="lg" className="profile-section-card">
        <Stack gap="md">
          <Title order={4}>Dados da conta</Title>

          <form onSubmit={onSaveProfile}>
            <Stack gap="md">
              <TextInput label="Nome" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
              <TextInput label="Telefone" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} required />
              <TextInput label="CPF" value={cpf} onChange={(event) => setCpf(event.currentTarget.value)} />
              <TextInput
                label="Nascimento (YYYY-MM-DD)"
                value={birthDate}
                onChange={(event) => setBirthDate(event.currentTarget.value)}
              />
              <TextInput label="Email" value={profile?.email || ''} readOnly />

              <Button type="submit" loading={savingProfile}>
                Salvar dados
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: isHost ? 2 : 1 }} spacing="md">
        <Card withBorder radius="xl" p="lg" className="profile-section-card">
          <Stack gap="md">
            <Title order={4}>Minhas reservas</Title>
            {myBookings.length === 0 ? <Text c="dimmed">Nenhuma reserva ainda.</Text> : null}

            {myBookings.slice(0, 3).map((booking) => (
              <Card key={booking.id} withBorder radius="lg" p="md" className="profile-air-list-card">
                <Stack gap={4}>
                  <Text fw={700}>{booking.property_title}</Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
                  </Text>
                  <Group justify="space-between" align="center">
                    <Text size="sm">Total: {formatMoney(booking.total_paid_by_renter)}</Text>
                    <Badge variant="light">{bookingStatusLabel[booking.status] || booking.status}</Badge>
                  </Group>
                </Stack>
              </Card>
            ))}

            <Button component={Link} to="/app/bookings" variant="default">
              Abrir todas as reservas
            </Button>
          </Stack>
        </Card>

        {isHost ? (
          <Card withBorder radius="xl" p="lg" className="profile-section-card">
            <Stack gap="md">
              <Title order={4}>Meus anuncios</Title>
              {loadingData ? <Text c="dimmed">Carregando...</Text> : null}
              {myProperties.length === 0 ? <Text c="dimmed">Sem anuncios ainda.</Text> : null}

              {myProperties.slice(0, 3).map((property) => (
                <Card key={property.id} withBorder radius="lg" p="md" className="profile-air-list-card">
                  <Stack gap={4}>
                    <Text fw={700}>{property.title}</Text>
                    <Text size="sm" c="dimmed">
                      {property.location.addressText || 'Sem endereco'}
                    </Text>
                    <Text size="sm">
                      {formatMoney(property.price)} - {statusLabel[property.status]}
                    </Text>
                    <Group>
                      <Button component={Link} to={`/app/property/${property.id}`} variant="default" size="xs">
                        Ver
                      </Button>
                      <Button component={Link} to={`/app/edit-property/${property.id}`} size="xs">
                        Editar
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Card>
        ) : null}
      </SimpleGrid>

      <Card withBorder radius="xl" p="lg" className="profile-section-card">
        <Stack gap="md">
          <Title order={4}>Avaliacoes</Title>

          {pendingReviewBookings.length === 0 ? (
            <Text c="dimmed">Sem locacoes finalizadas pendentes de avaliacao.</Text>
          ) : (
            <form onSubmit={submitReview}>
              <Stack gap="md">
                <Select
                  label="Reserva"
                  data={pendingReviewBookings.map((booking) => ({
                    value: booking.id,
                    label: `${booking.property_title} - ${formatDate(booking.check_out_date)}`,
                  }))}
                  value={reviewBookingId}
                  onChange={(value) => setReviewBookingId(value || '')}
                  required
                />

                <Select
                  label="Nota"
                  data={[
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5', label: '5' },
                  ]}
                  value={String(reviewRating)}
                  onChange={(value) => setReviewRating(Number(value || 5))}
                  required
                />

                <Group gap="xs" wrap="wrap">
                  {reviewTags.map((tag) => (
                    <Badge
                      key={tag}
                      size="lg"
                      className="clickable-badge"
                      variant={reviewTagsSelected.includes(tag) ? 'filled' : 'light'}
                      color={reviewTagsSelected.includes(tag) ? 'ocean' : 'gray'}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </Group>

                <Textarea
                  label="Comentario"
                  minRows={3}
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.currentTarget.value)}
                />

                <Button type="submit">Enviar avaliacao</Button>
              </Stack>
            </form>
          )}

          <Divider />

          {isHost ? (
            <>
              <Title order={5}>Ultimas recebidas ({receivedReviews.length})</Title>
              {receivedReviews.length === 0 ? <Text c="dimmed">Voce ainda nao recebeu avaliacoes.</Text> : null}
              {receivedReviews.slice(0, 3).map((review) => (
                <Card key={review.id} withBorder radius="lg" p="md" className="profile-air-list-card">
                  <Stack gap={6}>
                    <Text fw={700}>
                      <Star size={14} style={{ verticalAlign: 'middle' }} /> Nota: {review.rating}/5
                    </Text>
                    <Text size="sm" c="dimmed">
                      {review.comment || 'Sem comentario'}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Title order={5}>Ultimas avaliacoes enviadas ({reviewsGiven.length})</Title>
              {reviewsGiven.length === 0 ? <Text c="dimmed">Voce ainda nao avaliou nenhuma estadia.</Text> : null}
              {reviewsGiven.slice(0, 3).map((review) => (
                <Card key={review.id} withBorder radius="lg" p="md" className="profile-air-list-card">
                  <Stack gap={6}>
                    <Text fw={700}>
                      <Star size={14} style={{ verticalAlign: 'middle' }} /> Nota enviada: {review.rating}/5
                    </Text>
                    <Text size="sm" c="dimmed">
                      {review.comment || 'Sem comentario'}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
