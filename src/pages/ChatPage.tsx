import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core';
import { AlertCircle, ArrowLeft, MessageCircleMore, MessageSquareLock, ShieldCheck } from 'lucide-react';
import { formatDate } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Booking, ChatConversation, ChatMessage, parseBooking, parseChatConversation, parseChatMessage } from '../lib/types';
import { useAuth } from '../state/AuthContext';

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

export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId: conversationIdFromPath } = useParams();
  const [searchParams] = useSearchParams();

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
    const bookingStatus = booking?.status ?? '';
    return ['pre_checking', 'checked_in', 'checked_out'].includes(bookingStatus);
  }, [activeConversation, bookingsById]);

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
      const bookingId = searchParams.get('bookingId') ?? '';

      if (!targetConversationId && bookingId) {
        const { data, error } = await supabase.rpc('ensure_booking_chat', {
          p_booking_id: bookingId,
        });

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
        return;
      }

      const preferredConversationId =
        parsedConversations.find((item) => item.id === targetConversationId)?.id ||
        parsedConversations.find((item) => item.id === conversationIdFromPath)?.id ||
        parsedConversations[0]?.id ||
        '';

      setActiveConversationId(preferredConversationId);

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
  }, [user?.id, conversationIdFromPath, searchParams.toString()]);

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
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const parsed = parseChatMessage(payload.new as Record<string, unknown>);
          setMessagesByConversation((current) => {
            const list = current[activeConversationId] ?? [];
            if (list.some((item) => item.id === parsed.id)) return current;
            return {
              ...current,
              [activeConversationId]: [...list, parsed],
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
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
      setErrorMessage('Por seguranca da plataforma, nao e permitido compartilhar telefone, email, pix ou links externos no chat.');
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Stack py="md">
        <Text c="dimmed">Carregando chats...</Text>
      </Stack>
    );
  }

  if (conversations.length === 0) {
    return (
      <Stack gap="md" py="md">
        <Card withBorder radius="xl" p="lg">
          <Stack gap="xs">
            <Title order={3}>Central de chat</Title>
            <Text c="dimmed">Nenhuma conversa disponivel ainda.</Text>
            <Text size="sm" c="dimmed">
              O chat e liberado automaticamente apos uma reserva entrar em pre-checking.
            </Text>
          </Stack>
        </Card>

        <Button component={Link} to="/app/bookings" variant="default" leftSection={<ArrowLeft size={16} />}>
          Ir para reservas
        </Button>

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

  return (
    <Stack gap="md" py="md">
      <Group justify="space-between" align="center">
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
        <Alert color="red" icon={<AlertCircle size={16} />}>
          {errorMessage}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="xl" p="md">
          <Stack gap="sm">
            <Title order={4}>Seus chats</Title>

            <Stack gap="xs" className="chat-conversation-list">
              {conversations.map((conversation) => {
                const meta = conversationStatusMeta[conversation.status];
                const booking = bookingsById[conversation.booking_id];

                return (
                  <Button
                    key={conversation.id}
                    variant={activeConversationId === conversation.id ? 'light' : 'subtle'}
                    color={activeConversationId === conversation.id ? 'ocean' : 'gray'}
                    justify="space-between"
                    className="chat-conversation-item"
                    onClick={() => openConversation(conversation.id)}
                    rightSection={<Badge color={meta.color} size="xs">{meta.label}</Badge>}
                  >
                    <Stack gap={2} align="flex-start">
                      <Text fw={700} size="sm">
                        {booking?.property_title || 'Reserva'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Atualizado: {formatDate(conversation.last_message_at)}
                      </Text>
                    </Stack>
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </Card>

        <Card withBorder radius="xl" p="lg">
          <Stack gap="sm">
            <Stack gap={4}>
              <Title order={4}>Chat da reserva</Title>
              <Text c="dimmed" size="sm">
                {activeBooking?.property_title || 'Conversa da reserva selecionada'}
              </Text>
              <Text size="xs" c="dimmed">
                Reserva: {activeConversation?.booking_id || '-'}
              </Text>
            </Stack>

            <Alert icon={<MessageSquareLock size={16} />} color="blue" variant="light">
              Regras: sem telefone, email, PIX ou links externos.
            </Alert>

            <Box className="chat-scroll" ref={messageViewportRef}>
              <Stack gap="xs">
                {activeMessages.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Sem mensagens ainda.
                  </Text>
                ) : null}

                {activeMessages.map((message) => {
                  const mine = message.sender_id === user?.id;
                  return (
                    <div key={message.id} className={`chat-bubble ${message.is_system ? 'system' : mine ? 'mine' : 'theirs'}`}>
                      <Text size="sm">{message.message_text}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(message.created_at)}
                      </Text>
                    </div>
                  );
                })}
              </Stack>
            </Box>

            <form onSubmit={sendMessage}>
              <Stack gap="sm">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  minRows={3}
                  maxLength={1000}
                  placeholder="Digite sua mensagem para alinhar check-in e detalhes da reserva..."
                  disabled={!activeConversation || activeConversation.status !== 'open' || !chatUnlocked}
                />
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    {draft.length}/1000
                  </Text>
                  <Button
                    type="submit"
                    loading={sending}
                    leftSection={<MessageCircleMore size={16} />}
                    disabled={!activeConversation || activeConversation.status !== 'open' || !chatUnlocked}
                  >
                    Enviar mensagem
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
