import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  AlertCircle,
  ArrowLeft,
  MessageCircleMore,
  MessageSquareLock,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react';
import { formatChatTime } from '../lib/format';
import { sendPushNotification } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { Booking, ChatConversation, ChatMessage, parseBooking, parseChatConversation, parseChatMessage } from '../lib/types';
import { useAuth } from '../state/AuthContext';

const CONV_COLORS = ['#1f5ed6', '#0b4d8a', '#2a7a4d', '#7c3d8a', '#b86d1a'];

const getConvColor = (id: string): string => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CONV_COLORS[hash % CONV_COLORS.length];
};

const conversationStatusMeta: Record<ChatConversation['status'], { label: string; color: 'teal' | 'gray' | 'red' }> = {
  open: { label: 'Chat aberto', color: 'teal' },
  closed: { label: 'Chat encerrado', color: 'gray' },
  blocked: { label: 'Chat bloqueado', color: 'red' },
};

const containsForbiddenContact = (message: string): boolean => {
  const text = message.toLowerCase();
  const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const phonePattern = /\b\d{8,}\b/;
  const linkPattern = /(https?:\/\/|www\.)/i;
  const bypassPattern = /\b(whatsapp|zap|telefone|contato|pix|instagram|facebook|telegram)\b/i;
  return emailPattern.test(text) || phonePattern.test(text) || linkPattern.test(text) || bypassPattern.test(text);
};

interface MessageGroup {
  sender_id: string;
  is_system: boolean;
  messages: ChatMessage[];
}

export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId: conversationIdFromPath } = useParams();
  const [searchParams] = useSearchParams();
  const bookingIdFromQuery = searchParams.get('bookingId') ?? '';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [bookingsById, setBookingsById] = useState<Record<string, Booking>>({});
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState('');

  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const activeMessages = useMemo(
    () => messagesByConversation[activeConversationId] ?? [],
    [activeConversationId, messagesByConversation],
  );

  const chatUnlocked = useMemo(() => {
    if (!activeConversation) return false;
    const booking = bookingsById[activeConversation.booking_id];
    return ['pre_checking', 'checked_in', 'checked_out'].includes(booking?.status ?? '');
  }, [activeConversation, bookingsById]);

  // Group consecutive messages by same sender
  const messageGroups = useMemo((): MessageGroup[] => {
    const groups: MessageGroup[] = [];
    for (const msg of activeMessages) {
      const last = groups[groups.length - 1];
      if (last && last.sender_id === msg.sender_id && last.is_system === msg.is_system) {
        last.messages.push(msg);
      } else {
        groups.push({ sender_id: msg.sender_id, is_system: msg.is_system, messages: [msg] });
      }
    }
    return groups;
  }, [activeMessages]);

  const getSenderLabel = useCallback(
    (group: MessageGroup): string => {
      if (group.is_system) return 'Sistema';
      if (group.sender_id === user?.id) return 'Voce';
      if (activeConversation?.renter_id === user?.id) return 'Anfitriao';
      return 'Hospede';
    },
    [activeConversation, user?.id],
  );

  const loadConversationMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: (data ?? []).map((item) => parseChatMessage(item)),
    }));
  };

  const loadChatState = async () => {
    if (!user) return;

    setLoading(true);
    setErrorMessage('');

    try {
      let targetConversationId = conversationIdFromPath || '';
      const bookingId = bookingIdFromQuery;

      if (!targetConversationId && bookingId) {
        const { data, error } = await supabase.rpc('ensure_booking_chat', { p_booking_id: bookingId });
        if (error) throw error;
        if (!data) throw new Error('Nao foi possivel abrir conversa para esta reserva.');
        targetConversationId = String(data);
      }

      const { data: conversationsRaw, error: conversationsError } = await supabase
        .from('chat_conversations')
        .select('*')
        .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      const parsedConversations = (conversationsRaw ?? []).map((item) => parseChatConversation(item));
      setConversations(parsedConversations);

      const bookingIds = Array.from(new Set(parsedConversations.map((item) => item.booking_id).filter(Boolean)));
      if (bookingIds.length > 0) {
        const { data: bookingsRaw, error: bookingsError } = await supabase.from('bookings').select('*').in('id', bookingIds);
        if (bookingsError) throw bookingsError;

        const nextBookingsById: Record<string, Booking> = {};
        (bookingsRaw ?? []).forEach((item) => {
          const parsed = parseBooking(item);
          nextBookingsById[parsed.id] = parsed;
        });
        setBookingsById(nextBookingsById);
      } else {
        setBookingsById({});
      }

      if (parsedConversations.length === 0) {
        setActiveConversationId('');
        if (isMobile) setMobileView('list');
        return;
      }

      const preferredConversationId =
        parsedConversations.find((item) => item.id === targetConversationId)?.id ||
        parsedConversations.find((item) => item.id === conversationIdFromPath)?.id ||
        parsedConversations[0]?.id ||
        '';

      setActiveConversationId(preferredConversationId);
      if (isMobile && preferredConversationId) {
        setMobileView(conversationIdFromPath || bookingIdFromQuery ? 'chat' : 'list');
      }

      if (preferredConversationId) {
        await loadConversationMessages(preferredConversationId);
        if (conversationIdFromPath !== preferredConversationId) {
          navigate(`/app/chat/${preferredConversationId}`, { replace: true });
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar chats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChatState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, conversationIdFromPath, bookingIdFromQuery]);

  useEffect(() => {
    if (!isMobile) {
      setMobileView('chat');
      return;
    }
    if (conversationIdFromPath || bookingIdFromQuery) {
      setMobileView('chat');
      return;
    }
    setMobileView('list');
  }, [conversationIdFromPath, isMobile, bookingIdFromQuery]);

  useEffect(() => {
    if (!activeConversationId || messagesByConversation[activeConversationId]) return;
    void loadConversationMessages(activeConversationId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
      .channel(`chat-${activeConversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          const parsed = parseChatMessage(payload.new as Record<string, unknown>);
          setMessagesByConversation((current) => {
            const list = current[activeConversationId] ?? [];
            if (list.some((item) => item.id === parsed.id)) return current;
            return { ...current, [activeConversationId]: [...list, parsed] };
          });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [activeConversationId]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [activeMessages.length, activeConversationId]);

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setErrorMessage('');
    navigate(`/app/chat/${conversationId}`);
    if (isMobile) setMobileView('chat');
  };

  const doSend = async () => {
    if (!user || !activeConversation) return;

    const text = draft.trim();
    if (!text) return;

    if (!chatUnlocked) {
      setErrorMessage('Chat so e liberado apos pagamento confirmado e status pre-checking.');
      return;
    }
    if (activeConversation.status !== 'open') {
      setErrorMessage('Esta conversa nao esta aberta para envio de mensagens.');
      return;
    }
    if (containsForbiddenContact(text)) {
      setErrorMessage('Por seguranca, nao e permitido compartilhar telefone, email, PIX ou links externos no chat.');
      return;
    }
    if (text.length > 1000) {
      setErrorMessage('Mensagem muito longa. Limite de 1000 caracteres.');
      return;
    }

    setSending(true);
    setErrorMessage('');

    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        message_text: text,
        is_system: false,
      });

      if (error) throw error;
      setDraft('');

      // Notify the other participant
      const otherUserId =
        user.id === activeConversation.renter_id
          ? activeConversation.owner_id
          : activeConversation.renter_id;

      void sendPushNotification({
        targetUserId: otherUserId,
        title: 'Nova mensagem',
        body: text.length > 60 ? `${text.slice(0, 57)}...` : text,
        data: { type: 'chat', conversationId: activeConversation.id },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    await doSend();
  };

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void doSend();
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <Stack gap="md" py="md">
        <Skeleton height={44} radius="xl" />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card withBorder radius="xl" p="md">
            <Stack gap="sm">
              <Skeleton height={20} width={120} radius="md" />
              <div className="chat-skeleton-list">
                {[1, 2, 3].map((i) => <Skeleton key={i} height={58} radius="lg" />)}
              </div>
            </Stack>
          </Card>
          <Card withBorder radius="xl" p="lg">
            <Stack gap="sm">
              <Skeleton height={20} width={160} radius="md" />
              <Skeleton height={200} radius="lg" />
              <Skeleton height={80} radius="lg" />
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    );
  }

  // ── Empty state ────────────────────────────────────────────────
  if (conversations.length === 0) {
    return (
      <Stack gap="md" py="md">
        <Card withBorder radius="xl" p="lg">
          <div className="empty-state">
            <div className="empty-state-icon">
              <MessageSquareText size={32} />
            </div>
            <Text fw={700}>Nenhuma conversa ainda</Text>
            <Text c="dimmed" size="sm">
              O chat e liberado automaticamente apos uma reserva entrar em pre-checking.
            </Text>
            <Button component={Link} to="/app/bookings" variant="light" radius="xl" leftSection={<ArrowLeft size={16} />}>
              Ir para reservas
            </Button>
          </div>
        </Card>

        {errorMessage ? (
          <Alert color="red" icon={<AlertCircle size={16} />}>
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  const statusMeta = activeConversation ? conversationStatusMeta[activeConversation.status] : null;
  const activeBooking = activeConversation ? bookingsById[activeConversation.booking_id] : null;
  const canSend = !!activeConversation && activeConversation.status === 'open' && chatUnlocked;

  return (
    <Stack gap="md" py="md">
      <Group justify="space-between" align="center" className="chat-header-row">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Voltar
        </Button>

        {statusMeta ? (
          <Badge color={statusMeta.color} variant="light" leftSection={<ShieldCheck size={13} />}>
            {statusMeta.label}
          </Badge>
        ) : null}
      </Group>

      {errorMessage ? (
        <Alert color="red" icon={<AlertCircle size={16} />} radius="xl">
          {errorMessage}
        </Alert>
      ) : null}

      {/* Mobile tabs */}
      {isMobile ? (
        <Group className="chat-mobile-tabs" gap={0}>
          <button
            type="button"
            className={`chat-mobile-tab-btn${mobileView === 'list' ? ' active' : ''}`}
            onClick={() => setMobileView('list')}
          >
            <MessageSquareText size={15} />
            Conversas
          </button>
          <button
            type="button"
            className={`chat-mobile-tab-btn${mobileView === 'chat' ? ' active' : ''}`}
            disabled={!activeConversationId}
            onClick={() => setMobileView('chat')}
          >
            <MessageCircleMore size={15} />
            Chat
          </button>
        </Group>
      ) : null}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* ── Conversation list ── */}
        <Card
          withBorder
          radius="xl"
          p="md"
          className="chat-list-card"
          style={{ display: isMobile && mobileView !== 'list' ? 'none' : undefined }}
        >
          <Stack gap="sm">
            <Title order={4}>Seus chats</Title>

            <Stack gap="xs" className="chat-conversation-list">
              {conversations.map((conversation) => {
                const meta = conversationStatusMeta[conversation.status];
                const booking = bookingsById[conversation.booking_id];
                const title = booking?.property_title || 'Reserva';
                const initial = title.charAt(0).toUpperCase();
                const color = getConvColor(conversation.id);
                const isActive = activeConversationId === conversation.id;

                return (
                  <Button
                    key={conversation.id}
                    variant={isActive ? 'light' : 'subtle'}
                    color={isActive ? 'ocean' : 'gray'}
                    justify="flex-start"
                    className="chat-conversation-item"
                    onClick={() => openConversation(conversation.id)}
                    leftSection={
                      <div className="chat-conv-avatar" style={{ background: color }}>
                        {initial}
                      </div>
                    }
                    rightSection={
                      <Badge color={meta.color} size="xs" className="chat-conversation-status">
                        {meta.label}
                      </Badge>
                    }
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" gap={4} wrap="nowrap">
                        <Text fw={700} size="sm" truncate style={{ flex: 1, minWidth: 0 }}>{title}</Text>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{formatChatTime(conversation.last_message_at)}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {user?.id === conversation.renter_id ? 'Voce e hospede' : 'Voce e anfitriao'}
                      </Text>
                    </div>
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </Card>

        {/* ── Chat thread ── */}
        <Card
          withBorder
          radius="xl"
          p="lg"
          className="chat-thread-card"
          style={{ display: isMobile && mobileView !== 'chat' ? 'none' : undefined }}
        >
          <Stack gap="sm">
            {isMobile ? (
              <Button variant="subtle" size="compact-sm" onClick={() => setMobileView('list')}>
                Ver conversas
              </Button>
            ) : null}

            {activeConversation ? (
              <Group gap="sm" className="chat-thread-header" wrap="nowrap">
                <div className="chat-thread-avatar" style={{ background: getConvColor(activeConversation.id) }}>
                  {(activeBooking?.property_title ?? 'C').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={700} size="sm" truncate>{activeBooking?.property_title || 'Reserva'}</Text>
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      {user?.id === activeConversation.renter_id ? 'Anfitriao' : 'Hospede'}
                    </Text>
                    {activeBooking?.check_in_date ? (
                      <>
                        <Text size="xs" c="dimmed">-</Text>
                        <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatChatTime(activeBooking.check_in_date)}
                          {activeBooking.check_out_date ? ` ate ${formatChatTime(activeBooking.check_out_date)}` : ''}
                        </Text>
                      </>
                    ) : null}
                  </Group>
                </div>
                {statusMeta ? (
                  <Badge color={statusMeta.color} variant="dot" size="sm" style={{ flexShrink: 0 }}>
                    {statusMeta.label}
                  </Badge>
                ) : null}
              </Group>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text fw={700}>Selecione uma conversa</Text>
                <Text size="sm" c="dimmed" ta="center">
                  Escolha um chat da lista para visualizar as mensagens.
                </Text>
              </Stack>
            )}

            <Group gap={6} className="chat-security-note">
              <MessageSquareLock size={12} />
              <Text size="xs" c="dimmed">Sem telefone, e-mail, PIX ou links externos neste chat</Text>
            </Group>

            {/* Messages area */}
            <Box className="chat-scroll" ref={messageViewportRef}>
              {!chatUnlocked && activeConversation ? (
                <div className="chat-locked-banner">
                  <MessageSquareLock size={26} />
                  <Text size="sm" fw={700}>Chat bloqueado</Text>
                  <Text size="xs" c="dimmed">
                    O chat sera liberado automaticamente apos o pagamento ser confirmado e a reserva entrar em pre-checking.
                  </Text>
                </div>
              ) : null}

              {chatUnlocked && activeMessages.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="md">
                  Nenhuma mensagem ainda. Diga ola!
                </Text>
              ) : null}

              {chatUnlocked ? (
                <Stack gap={0}>
                  {messageGroups.map((group, groupIndex) => {
                    const mine = group.sender_id === user?.id;
                    const isSystem = group.is_system;
                    const label = getSenderLabel(group);

                    return (
                      <div
                        key={`group-${groupIndex}`}
                        className="chat-group"
                        style={{ alignItems: isSystem ? 'center' : mine ? 'flex-end' : 'flex-start' }}
                      >
                        <div className="chat-bubble-label">{label}</div>
                        {group.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`chat-bubble ${isSystem ? 'system' : mine ? 'mine' : 'theirs'}`}
                          >
                            <Text size="sm">{message.message_text}</Text>
                            <Text size="xs" c="dimmed" mt={2}>
                              {formatChatTime(message.created_at)}
                            </Text>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </Stack>
              ) : null}
            </Box>

            {/* Compose */}
            <form onSubmit={sendMessage}>
              <Stack gap="sm">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={onTextareaKeyDown}
                  autosize
                  minRows={2}
                  maxRows={6}
                  maxLength={1000}
                  placeholder={
                    canSend
                      ? 'Digite sua mensagem...'
                      : 'Chat indisponivel nesta reserva'
                  }
                  disabled={!canSend}
                  radius="lg"
                />
                <Group justify="space-between" className="chat-compose-actions">
                  <Text size="xs" c="dimmed">
                    {draft.length}/1000
                  </Text>
                  <Button
                    type="submit"
                    loading={sending}
                    leftSection={<MessageCircleMore size={16} />}
                    disabled={!canSend}
                    radius="xl"
                  >
                    Enviar
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
