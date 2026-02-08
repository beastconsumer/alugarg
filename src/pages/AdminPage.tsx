import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  PasswordInput,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/phone';
import { formatDate, formatMoney } from '../lib/format';
import {
  Booking,
  ChatConversation,
  ChatMessage,
  parseBooking,
  parseChatConversation,
  parseChatMessage,
  parseProfile,
  parseProperty,
  Property,
  UserProfile,
} from '../lib/types';

const ADMIN_PHONE_LOCK = '5553999005952';

interface AdminPropertyItem {
  property: Property;
  owner: UserProfile | null;
}

export function AdminPage() {
  const [ready, setReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState('');
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessReason, setAccessReason] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [adminMessage, setAdminMessage] = useState('');

  const [usersById, setUsersById] = useState<Record<string, UserProfile>>({});

  const propertyById = useMemo(() => {
    const map: Record<string, Property> = {};
    properties.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [properties]);

  const bookingById = useMemo(() => {
    const map: Record<string, Booking> = {};
    bookings.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [bookings]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const selectedMessages = useMemo(
    () => messagesByConversation[selectedConversationId] ?? [],
    [messagesByConversation, selectedConversationId],
  );

  const propertyItems = useMemo<AdminPropertyItem[]>(() => {
    return properties.map((property) => ({
      property,
      owner: usersById[property.owner_id] ?? null,
    }));
  }, [properties, usersById]);

  const summary = useMemo(() => {
    const propertiesSummary = properties.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 },
    );

    const bookingsSummary = bookings.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<Booking['status'], number>,
    );

    const chatsSummary = conversations.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      { open: 0, closed: 0, blocked: 0 } as Record<ChatConversation['status'], number>,
    );

    return { propertiesSummary, bookingsSummary, chatsSummary };
  }, [bookings, conversations, properties]);

  const loadConversationMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: (data ?? []).map((row) => parseChatMessage(row)),
    }));
  };

  const loadAdminState = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id || '';
    setSessionUserId(userId);

    if (!userId) {
      setCurrentProfile(null);
      setIsAdmin(false);
      setAccessReason('');
      setReady(true);
      return;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      setCurrentProfile(null);
      setIsAdmin(false);
      setAccessReason(profileError.message);
      setReady(true);
      return;
    }

    const profile = profileRow ? parseProfile(profileRow) : null;
    setCurrentProfile(profile);

    if (!profile) {
      setIsAdmin(false);
      setAccessReason('Perfil nao encontrado para a sessao atual.');
      setReady(true);
      return;
    }

    if (profile.role !== 'admin') {
      setIsAdmin(false);
      setAccessReason('Role sem permissao de admin.');
      setReady(true);
      return;
    }

    const normalizedPhone = normalizePhone(profile.phone);
    if (normalizedPhone !== ADMIN_PHONE_LOCK) {
      setIsAdmin(false);
      setAccessReason('Acesso restrito ao numero +5553999005952.');
      setReady(true);
      return;
    }

    setAccessReason('');
    setIsAdmin(true);
    setReady(true);
  };

  const loadDashboardData = async () => {
    setLoadingData(true);
    setErrorMessage('');

    try {
      const [propertiesRes, bookingsRes, conversationsRes] = await Promise.all([
        supabase.from('properties').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('chat_conversations').select('*').order('last_message_at', { ascending: false }),
      ]);

      if (propertiesRes.error) throw propertiesRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (conversationsRes.error) throw conversationsRes.error;

      const parsedProperties = (propertiesRes.data ?? []).map((row) => parseProperty(row));
      const parsedBookings = (bookingsRes.data ?? []).map((row) => parseBooking(row));
      const parsedConversations = (conversationsRes.data ?? []).map((row) => parseChatConversation(row));

      setProperties(parsedProperties);
      setBookings(parsedBookings);
      setConversations(parsedConversations);

      const userIds = new Set<string>();
      parsedProperties.forEach((item) => userIds.add(item.owner_id));
      parsedBookings.forEach((item) => {
        userIds.add(item.renter_id);
        userIds.add(item.owner_id);
      });
      parsedConversations.forEach((item) => {
        userIds.add(item.renter_id);
        userIds.add(item.owner_id);
      });

      if (userIds.size > 0) {
        const { data: usersRows, error: usersError } = await supabase
          .from('users')
          .select('*')
          .in('id', Array.from(userIds));

        if (usersError) throw usersError;

        const mapped: Record<string, UserProfile> = {};
        (usersRows ?? []).forEach((row) => {
          const parsed = parseProfile(row);
          mapped[parsed.id] = parsed;
        });

        setUsersById(mapped);
      } else {
        setUsersById({});
      }

      const firstConversationId = parsedConversations[0]?.id ?? '';
      const activeConversationId = selectedConversationId || firstConversationId;
      setSelectedConversationId(activeConversationId);

      if (activeConversationId) {
        await loadConversationMessages(activeConversationId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar painel admin');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void loadAdminState();
  }, []);

  useEffect(() => {
    if (!ready || !isAdmin) return;

    void loadDashboardData();

    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        void loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, () => {
        void loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        if (selectedConversationId) {
          void loadConversationMessages(selectedConversationId);
        }
        void loadDashboardData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAdmin, selectedConversationId]);

  useEffect(() => {
    if (!isAdmin || !selectedConversationId) return;
    void loadConversationMessages(selectedConversationId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedConversationId]);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();

    setLoginLoading(true);
    setErrorMessage('');

    try {
      let email = identifier.trim().toLowerCase();
      if (!email.includes('@')) {
        const normalized = normalizePhone(identifier);
        if (normalized !== ADMIN_PHONE_LOCK) {
          throw new Error('Acesso permitido somente ao numero +5553999005952.');
        }

        const { data, error } = await supabase.rpc('get_login_email_by_phone', {
          p_phone: normalized,
        });

        if (error) throw error;
        if (!data) throw new Error('Telefone admin nao encontrado.');

        email = String(data);
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      await loadAdminState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha no login admin');
    } finally {
      setLoginLoading(false);
    }
  };

  const updatePropertyStatus = async (
    propertyId: string,
    status: 'pending' | 'approved' | 'rejected',
    verified?: boolean,
  ) => {
    try {
      const payload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (typeof verified === 'boolean') payload.verified = verified;

      const { error } = await supabase.from('properties').update(payload).eq('id', propertyId);
      if (error) throw error;

      await loadDashboardData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao atualizar anuncio');
    }
  };

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (error) throw error;

      await loadDashboardData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao atualizar reserva');
    }
  };

  const updateConversationStatus = async (conversationId: string, status: ChatConversation['status']) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;

      await loadDashboardData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao atualizar chat');
    }
  };

  const sendAdminSystemMessage = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedConversationId || !sessionUserId) return;

    const text = adminMessage.trim();
    if (!text) {
      setErrorMessage('Digite uma mensagem antes de enviar.');
      return;
    }

    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: selectedConversationId,
        sender_id: sessionUserId,
        message_text: text,
        is_system: true,
      });

      if (error) throw error;

      setAdminMessage('');
      await loadConversationMessages(selectedConversationId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar mensagem administrativa');
    }
  };

  if (!ready) {
    return (
      <Stack py="xl" align="center" className="admin-bg">
        <Text c="dimmed" className="admin-muted">Inicializando painel...</Text>
      </Stack>
    );
  }

  if (!sessionUserId) {
    return (
      <Stack className="admin-bg" justify="center" align="center" mih="100dvh" p="md">
        <Paper withBorder radius="xl" shadow="lg" p="xl" maw={560} w="100%" className="admin-glass">
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={2} className="admin-title">Aluga Aluga Admin</Title>
              <Text c="dimmed" className="admin-muted">Painel interno de moderacao, reservas e chat.</Text>
            </Stack>

            <Alert color="blue" variant="light" className="!bg-blue-500/10 !text-blue-100 !border !border-blue-400/30">
              Acesso exclusivo para o numero admin: +5553999005952
            </Alert>

            <form onSubmit={onLogin}>
              <Stack gap="md">
                <TextInput
                  label="Email ou telefone admin"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.currentTarget.value)}
                  placeholder="+5553999005952"
                  required
                />
                <PasswordInput
                  label="Senha"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                />

                {errorMessage ? <Alert color="red" className="!bg-red-500/10 !text-red-100 !border !border-red-400/30">{errorMessage}</Alert> : null}

                <Button type="submit" loading={loginLoading} className="!bg-ocean hover:!bg-blue-600">
                  Entrar no painel
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  if (!isAdmin) {
    return (
      <Stack className="admin-bg" justify="center" align="center" mih="100dvh" p="md">
        <Paper withBorder radius="xl" shadow="lg" p="xl" maw={560} w="100%" className="admin-glass">
          <Stack gap="md">
            <Title order={2} className="admin-title">Acesso negado</Title>
            <Alert color="red" className="!bg-red-500/10 !text-red-100 !border !border-red-400/30">
              {accessReason || 'Usuario sem permissao para o painel admin.'}
            </Alert>
            <Button
              variant="default"
              className="!border-slate-700 !text-slate-100"
              onClick={() =>
                void supabase.auth.signOut().then(() => {
                  setSessionUserId('');
                  setIsAdmin(false);
                  setCurrentProfile(null);
                  setAccessReason('');
                })
              }
            >
              Limpar sessao atual
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md" maw={1280} mx="auto" className="admin-bg">
      <Card withBorder radius="xl" p="lg" className="admin-glass">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} className="admin-title">Admin Aluga Aluga</Title>
            <Text c="dimmed" className="admin-muted">Moderacao, reservas e monitoramento de chat em tempo real.</Text>
            <Text size="sm" c="dimmed" className="admin-muted">
              Conta ativa: {currentProfile?.name || 'Admin'} ({currentProfile?.phone || '-'})
            </Text>
          </div>
          <Button
            variant="default"
            className="!border-slate-700 !text-slate-100"
            onClick={() =>
              void supabase.auth.signOut().then(() => {
                setSessionUserId('');
                setIsAdmin(false);
                setCurrentProfile(null);
              })
            }
          >
            Sair
          </Button>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card withBorder radius="xl" p="md" className="admin-kpi">
          <Text c="dimmed" size="sm" className="admin-muted">Anuncios pendentes</Text>
          <Title order={3} className="admin-title">{summary.propertiesSummary.pending}</Title>
        </Card>
        <Card withBorder radius="xl" p="md" className="admin-kpi">
          <Text c="dimmed" size="sm" className="admin-muted">Reservas pre-checking</Text>
          <Title order={3} className="admin-title">{summary.bookingsSummary.pre_checking ?? 0}</Title>
        </Card>
        <Card withBorder radius="xl" p="md" className="admin-kpi">
          <Text c="dimmed" size="sm" className="admin-muted">Chats abertos</Text>
          <Title order={3} className="admin-title">{summary.chatsSummary.open}</Title>
        </Card>
        <Card withBorder radius="xl" p="md" className="admin-kpi">
          <Text c="dimmed" size="sm" className="admin-muted">Chats bloqueados</Text>
          <Title order={3} className="admin-title">{summary.chatsSummary.blocked}</Title>
        </Card>
      </SimpleGrid>

      {loadingData ? <Text c="dimmed" className="admin-muted">Carregando dados do painel...</Text> : null}
      {errorMessage ? <Alert color="red" className="!bg-red-500/10 !text-red-100 !border !border-red-400/30">{errorMessage}</Alert> : null}

      <Tabs
        defaultValue="properties"
        keepMounted={false}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-2 shadow-admin"
        styles={{
          list: { borderColor: '#1e293b' },
          tab: {
            color: '#cbd5e1',
            borderRadius: 12,
            fontWeight: 600,
          },
          tabLabel: { color: 'inherit' },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="properties">Anuncios</Tabs.Tab>
          <Tabs.Tab value="bookings">Reservas</Tabs.Tab>
          <Tabs.Tab value="chats">Chats</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="properties" pt="md">
          <Stack gap="sm">
            {propertyItems.map(({ property, owner }) => (
              <Card key={property.id} withBorder radius="xl" p="lg" className="admin-glass">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={700} size="lg" className="admin-title">{property.title}</Text>
                      <Text c="dimmed" size="sm" className="admin-muted">{property.location.addressText || 'Sem endereco'}</Text>
                      <Text size="sm" className="text-slate-100">{formatMoney(property.price)} - {property.rent_type}</Text>
                      <Text c="dimmed" size="sm" className="admin-muted">
                        Status: {property.status} • Criado em {formatDate(property.created_at)}
                      </Text>
                      <Text c="dimmed" size="sm" className="admin-muted">
                        Proprietario: {owner?.name || 'Sem nome'} ({owner?.phone || '-'})
                      </Text>
                    </div>

                    <Group gap="xs" wrap="wrap">
                      {property.verified ? (
                        <Badge color="teal" leftSection={<ShieldCheck size={14} />}>Verificado</Badge>
                      ) : (
                        <Badge variant="light">Nao verificado</Badge>
                      )}
                    </Group>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                    {(property.photos.length > 0 ? property.photos.slice(0, 3) : ['/background.png']).map((photo) => (
                      <img key={`${property.id}-${photo}`} src={photo} alt={property.title} className="admin-photo" />
                    ))}
                  </SimpleGrid>

                  <Group wrap="wrap">
                    <Button size="xs" className="!bg-pine hover:!bg-teal-700" onClick={() => void updatePropertyStatus(property.id, 'approved')}>Aprovar</Button>
                    <Button size="xs" color="red" onClick={() => void updatePropertyStatus(property.id, 'rejected')}>Rejeitar</Button>
                    <Button
                      size="xs"
                      variant="default"
                      className="!border-slate-700 !text-slate-100"
                      onClick={() => void updatePropertyStatus(property.id, property.status, !property.verified)}
                    >
                      {property.verified ? 'Remover selo' : 'Marcar verificado'}
                    </Button>
                    <Button size="xs" variant="default" className="!border-slate-700 !text-slate-100" onClick={() => void updatePropertyStatus(property.id, 'pending')}>
                      Voltar para pendente
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}

            {propertyItems.length === 0 ? <Text c="dimmed" className="admin-muted">Nenhum anuncio encontrado.</Text> : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="bookings" pt="md">
          <Stack gap="sm">
            {bookings.map((booking) => {
              const renter = usersById[booking.renter_id];
              const owner = usersById[booking.owner_id];

              return (
                <Card key={booking.id} withBorder radius="xl" p="lg" className="admin-glass">
                  <Group justify="space-between" align="flex-start" gap="md">
                    <Stack gap={4}>
                      <Text fw={700} className="admin-title">{booking.property_title}</Text>
                      <Text size="sm" c="dimmed" className="admin-muted">
                        {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
                      </Text>
                      <Text size="sm" className="text-slate-100">Total pago: {formatMoney(booking.total_paid_by_renter)}</Text>
                      <Text size="sm" c="dimmed" className="admin-muted">
                        Inquilino: {renter?.name || booking.renter_id} • Proprietario: {owner?.name || booking.owner_id}
                      </Text>
                      <Badge variant="light">{booking.status}</Badge>
                    </Stack>

                    <Group gap="xs" wrap="wrap">
                      {booking.status !== 'cancelled' ? (
                        <Button size="xs" variant="default" className="!border-slate-700 !text-slate-100" onClick={() => void updateBookingStatus(booking.id, 'pre_checking')}>
                          Pre-checking
                        </Button>
                      ) : null}
                      {booking.status === 'pre_checking' ? (
                        <Button size="xs" onClick={() => void updateBookingStatus(booking.id, 'checked_in')}>
                          Confirmar check-in
                        </Button>
                      ) : null}
                      {booking.status === 'checked_in' ? (
                        <Button size="xs" onClick={() => void updateBookingStatus(booking.id, 'checked_out')}>
                          Finalizar estadia
                        </Button>
                      ) : null}
                      {booking.status !== 'checked_out' ? (
                        <Button size="xs" color="red" variant="light" onClick={() => void updateBookingStatus(booking.id, 'cancelled')}>
                          Cancelar
                        </Button>
                      ) : null}
                    </Group>
                  </Group>
                </Card>
              );
            })}

            {bookings.length === 0 ? <Text c="dimmed" className="admin-muted">Nenhuma reserva encontrada.</Text> : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="chats" pt="md">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card withBorder radius="xl" p="md" className="admin-glass">
              <Stack gap="sm">
                <Title order={4} className="admin-title">Conversas</Title>
                <ScrollArea h={520}>
                  <Stack gap="xs">
                    {conversations.map((conversation) => {
                      const booking = bookingById[conversation.booking_id];
                      const property = propertyById[conversation.property_id];
                      const renter = usersById[conversation.renter_id];
                      const owner = usersById[conversation.owner_id];

                      return (
                        <Card
                          key={conversation.id}
                          withBorder
                          radius="lg"
                          p="sm"
                          className={selectedConversationId === conversation.id ? 'admin-chat-conversation active' : 'admin-chat-conversation'}
                        >
                          <Stack gap={4}>
                            <Group justify="space-between" align="center">
                              <Text fw={700} size="sm" className="admin-title">{property?.title || booking?.property_title || 'Imovel'}</Text>
                              <Badge variant="light">{conversation.status}</Badge>
                            </Group>
                            <Text size="xs" c="dimmed" className="admin-muted">
                              Inquilino: {renter?.name || conversation.renter_id}
                            </Text>
                            <Text size="xs" c="dimmed" className="admin-muted">
                              Proprietario: {owner?.name || conversation.owner_id}
                            </Text>
                            <Text size="xs" c="dimmed" className="admin-muted">Atualizado: {formatDate(conversation.last_message_at)}</Text>
                            <Button size="xs" variant="default" className="!border-slate-700 !text-slate-100" onClick={() => setSelectedConversationId(conversation.id)}>
                              Visualizar
                            </Button>
                          </Stack>
                        </Card>
                      );
                    })}
                    {conversations.length === 0 ? <Text c="dimmed" className="admin-muted">Nenhum chat criado.</Text> : null}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Card>

            <Card withBorder radius="xl" p="md" className="admin-glass">
              <Stack gap="sm">
                <Title order={4} className="admin-title">Mensagens da conversa</Title>

                {selectedConversation ? (
                  <Group gap="xs" wrap="wrap">
                    <Button size="xs" variant="default" className="!border-slate-700 !text-slate-100" onClick={() => void updateConversationStatus(selectedConversation.id, 'open')}>
                      Abrir
                    </Button>
                    <Button size="xs" variant="default" color="yellow" className="!border-yellow-500/50 !text-yellow-200" onClick={() => void updateConversationStatus(selectedConversation.id, 'closed')}>
                      Encerrar
                    </Button>
                    <Button size="xs" color="red" onClick={() => void updateConversationStatus(selectedConversation.id, 'blocked')}>
                      Bloquear
                    </Button>
                  </Group>
                ) : null}

                <ScrollArea h={420}>
                  <Stack gap="xs">
                    {selectedMessages.map((message) => {
                      const sender = usersById[message.sender_id];
                      const senderName = message.is_system ? 'Sistema/Admin' : sender?.name || 'Usuario';

                      return (
                        <Card
                          key={message.id}
                          withBorder
                          radius="md"
                          p="sm"
                          className={message.is_system ? 'admin-chat-message system' : 'admin-chat-message'}
                        >
                          <Stack gap={2}>
                            <Text size="xs" c="dimmed" className="admin-muted">{senderName} • {formatDate(message.created_at)}</Text>
                            <Text size="sm" className="text-slate-100">{message.message_text}</Text>
                          </Stack>
                        </Card>
                      );
                    })}
                    {selectedConversation && selectedMessages.length === 0 ? (
                      <Text c="dimmed" className="admin-muted">Sem mensagens nesta conversa.</Text>
                    ) : null}
                    {!selectedConversation ? <Text c="dimmed" className="admin-muted">Selecione uma conversa para visualizar.</Text> : null}
                  </Stack>
                </ScrollArea>

                {selectedConversation ? (
                  <form onSubmit={sendAdminSystemMessage}>
                    <Stack gap="xs">
                      <TextInput
                        value={adminMessage}
                        onChange={(event) => setAdminMessage(event.currentTarget.value)}
                        placeholder="Enviar aviso administrativo para esta conversa"
                      />
                      <Button type="submit" size="xs" variant="default" className="!border-slate-700 !text-slate-100">
                        Enviar aviso do admin
                      </Button>
                    </Stack>
                  </form>
                ) : null}
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
