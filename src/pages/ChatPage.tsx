import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { AlertCircle, ArrowLeft, MessageSquareLock, ShieldCheck } from 'lucide-react';
import { formatDate } from '../lib/format';
import { supabase } from '../lib/supabase';
import { ChatConversation, ChatMessage, parseChatConversation, parseChatMessage } from '../lib/types';
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
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [chatUnlocked, setChatUnlocked] = useState(true);

  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  const conversationId = useMemo(
    () => conversationIdFromPath || '',
    [conversationIdFromPath],
  );

  const loadChat = async () => {
    if (!user) return;

    setLoading(true);
    setErrorMessage('');

    try {
      let resolvedConversationId = conversationId;

      if (!resolvedConversationId) {
        const bookingId = searchParams.get('bookingId') ?? '';
        if (!bookingId) {
          throw new Error('Chat invalido: reserva nao informada.');
        }

        const { data, error } = await supabase.rpc('ensure_booking_chat', {
          p_booking_id: bookingId,
        });

        if (error) throw error;
        if (!data) throw new Error('Nao foi possivel abrir conversa para esta reserva.');

        resolvedConversationId = String(data);
      }

      const { data: conversationRaw, error: conversationError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', resolvedConversationId)
        .maybeSingle();

      if (conversationError) throw conversationError;
      if (!conversationRaw) throw new Error('Conversa nao encontrada.');

      const parsedConversation = parseChatConversation(conversationRaw);
      setConversation(parsedConversation);

      const { data: bookingRaw, error: bookingError } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', parsedConversation.booking_id)
        .maybeSingle();

      if (bookingError) throw bookingError;
      const bookingStatus = String(bookingRaw?.status ?? '');
      const unlocked = ['pre_checking', 'checked_in', 'checked_out'].includes(bookingStatus);
      setChatUnlocked(unlocked);

      if (!unlocked) {
        throw new Error('Chat so e liberado apos pagamento confirmado e status pre-checking.');
      }

      const { data: messagesRaw, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', resolvedConversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((messagesRaw ?? []).map((item) => parseChatMessage(item)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId, searchParams.toString()]);

  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const parsed = parseChatMessage(payload.new as Record<string, unknown>);
          setMessages((current) => {
            if (current.some((item) => item.id === parsed.id)) return current;
            return [...current, parsed];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages.length]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !conversation) return;

    const text = draft.trim();
    if (!text) return;

    if (!chatUnlocked) {
      setErrorMessage('Chat so e liberado apos pagamento confirmado e status pre-checking.');
      return;
    }

    if (conversation.status !== 'open') {
      setErrorMessage('Esta conversa nao esta aberta para envio de mensagens.');
      return;
    }

    if (containsForbiddenContact(text)) {
      setErrorMessage(
        'Por seguranca da plataforma, nao e permitido compartilhar telefone, email, pix ou links externos no chat.',
      );
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
        conversation_id: conversation.id,
        sender_id: user.id,
        message_text: text,
        is_system: false,
      });

      if (error) throw error;

      await supabase
        .from('chat_conversations')
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

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
        <Text c="dimmed">Carregando chat...</Text>
      </Stack>
    );
  }

  if (!conversation) {
    return (
      <Stack py="md">
        <Alert color="red" icon={<AlertCircle size={16} />}>
          {errorMessage || 'Conversa nao disponivel.'}
        </Alert>
        <Button component={Link} to="/app/bookings" variant="default">
          Voltar para Reservas
        </Button>
      </Stack>
    );
  }

  const statusMeta = conversationStatusMeta[conversation.status];

  return (
    <Stack gap="md" py="md">
      <Group justify="space-between" align="center">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Voltar
        </Button>

        <Badge color={statusMeta.color} variant="light" leftSection={<ShieldCheck size={13} />}>
          {statusMeta.label}
        </Badge>
      </Group>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="xs">
          <Title order={3}>Chat da reserva</Title>
          <Text c="dimmed">Conversa protegida entre inquilino e proprietario para alinhamento de check-in.</Text>
          <Text size="sm" c="dimmed">
            Reserva: {conversation.booking_id}
          </Text>
        </Stack>
      </Card>

      <Alert icon={<MessageSquareLock size={16} />} color="blue" variant="light">
        Regras: sem telefone, email, PIX ou links externos. Todo o processo deve acontecer pela plataforma.
      </Alert>

      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Card withBorder radius="xl" p="lg">
        <Stack gap="sm">
          <Box className="chat-scroll" ref={messageViewportRef}>
            <Stack gap="xs">
              {messages.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Sem mensagens ainda.
                </Text>
              ) : null}

              {messages.map((message) => {
                const mine = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`chat-bubble ${message.is_system ? 'system' : mine ? 'mine' : 'theirs'}`}
                  >
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
                placeholder="Digite sua mensagem para combinar check-in, horario e acesso..."
                disabled={conversation.status !== 'open' || !chatUnlocked}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {draft.length}/1000
                </Text>
                <Button type="submit" loading={sending} disabled={conversation.status !== 'open' || !chatUnlocked}>
                  Enviar mensagem
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Stack>
  );
}
