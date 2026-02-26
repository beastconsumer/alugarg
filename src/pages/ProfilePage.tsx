import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Home,
  LogOut,
  MessageCircleMore,
  Settings,
  Shield,
} from 'lucide-react';
import { formatDate } from '../lib/format';
import { supabase, uploadImageAndGetPublicUrl } from '../lib/supabase';
import { parseSupportTicket, SupportTicket } from '../lib/types';
import { useAuth } from '../state/AuthContext';

type MenuKey = 'account' | 'announce' | 'help' | 'privacy';

const menuItems: Array<{ key: MenuKey; label: string; icon: typeof Settings }> = [
  { key: 'account', label: 'Minha conta', icon: Settings },
  { key: 'announce', label: 'Anunciar imovel', icon: Home },
  { key: 'help', label: 'Suporte e ajuda', icon: CircleHelp },
  { key: 'privacy', label: 'Privacidade e sair', icon: Shield },
];

const faqItems = [
  {
    q: 'Como fazer uma reserva?',
    a: 'Encontre um imovel na Home, selecione as datas e numero de hospedes e clique em Reservar.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'Apos o pagamento ser confirmado, a reserva entra em pre-checking e o chat com o anfitriao e liberado automaticamente.',
  },
  {
    q: 'Posso cancelar minha reserva?',
    a: 'Cancelamentos devem ser solicitados no Suporte informando o numero da reserva e o motivo.',
  },
  {
    q: 'Como me torno anfitriao?',
    a: 'Acesse "Anunciar imovel", envie documentos e aguarde a validacao da equipe AlugaSul.',
  },
  {
    q: 'O chat e seguro?',
    a: 'Sim. O chat da plataforma bloqueia telefone, email, PIX e links externos para proteger as partes.',
  },
];

const supportCategoryOptions = [
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'reserva', label: 'Reserva' },
  { value: 'anuncio', label: 'Anuncio' },
  { value: 'conta', label: 'Conta e acesso' },
  { value: 'outros', label: 'Outros' },
];

const supportStatusMeta: Record<SupportTicket['status'], { label: string; color: 'red' | 'blue' | 'teal' | 'gray' }> = {
  open: { label: 'Aberto', color: 'red' },
  in_progress: { label: 'Em atendimento', color: 'blue' },
  resolved: { label: 'Resolvido', color: 'teal' },
  closed: { label: 'Fechado', color: 'gray' },
};

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [activeMenu, setActiveMenu] = useState<MenuKey>('account');
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [supportCategory, setSupportCategory] = useState('reserva');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSuccessMessage, setSupportSuccessMessage] = useState('');

  useEffect(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setCpf(profile?.cpf ?? '');
    setBirthDate(profile?.birth_date ?? '');
  }, [profile]);

  const displayName = useMemo(() => {
    const fallback = profile?.email?.split('@')[0] || 'Seu perfil';
    return (profile?.name || fallback).trim();
  }, [profile?.email, profile?.name]);

  const roleInfo = useMemo(() => {
    if (profile?.role === 'admin') return { label: 'Administrador', color: 'brandBlue' as const };
    if (profile?.host_verification_status === 'verified') return { label: 'Anfitriao verificado', color: 'teal' as const };
    if (profile?.host_verification_status === 'pending') return { label: 'Verificacao pendente', color: 'yellow' as const };
    if (profile?.host_verification_status === 'rejected') return { label: 'Verificacao rejeitada', color: 'red' as const };
    return { label: 'Hospede', color: 'gray' as const };
  }, [profile?.role, profile?.host_verification_status]);

  const memberSince = useMemo(() => {
    if (!profile?.created_at) return null;
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(profile.created_at));
  }, [profile?.created_at]);

  const loadSupportTickets = async () => {
    if (!user) return;
    setSupportLoading(true);

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      setSupportTickets((data ?? []).map((row) => parseSupportTicket(row)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar tickets de suporte');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu !== 'help' || !user) return;
    void loadSupportTickets();
  }, [activeMenu, user]);

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
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
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

  const submitSupportTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const subject = supportSubject.trim();
    const message = supportMessage.trim();

    if (subject.length < 6) {
      setErrorMessage('Informe um assunto com pelo menos 6 caracteres.');
      return;
    }

    if (message.length < 12) {
      setErrorMessage('Descreva o problema com pelo menos 12 caracteres.');
      return;
    }

    setSupportSubmitting(true);
    setErrorMessage('');
    setSupportSuccessMessage('');

    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        category: supportCategory || 'outros',
        subject,
        message,
        status: 'open',
      });
      if (error) throw error;

      setSupportSubject('');
      setSupportMessage('');
      setSupportSuccessMessage('Ticket aberto com sucesso. Nossa equipe vai responder em breve.');
      await loadSupportTickets();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao abrir ticket de suporte');
    } finally {
      setSupportSubmitting(false);
    }
  };

  return (
    <Stack gap="lg" py="md" className="profile-clean-page">
      {errorMessage ? <Alert color="red" radius="xl">{errorMessage}</Alert> : null}

      <Stack align="center" gap={6} className="profile-hero">
        <label className="profile-clean-avatar-label" aria-label="Alterar foto de perfil">
          <div className="profile-avatar-wrap">
            <Avatar src={profile?.avatar_url || '/logoapp.png'} size={98} radius="50%" />
            <span className="profile-avatar-edit-hint" aria-hidden>
              <Camera size={14} />
            </span>
          </div>
          <input type="file" accept="image/*" onChange={onAvatarSelected} hidden />
        </label>

        <Title order={3} className="profile-hero-name">
          {displayName}
        </Title>

        <Group gap={6} wrap="wrap" justify="center">
          <Badge size="sm" variant="light" radius="xl" color={roleInfo.color}>{roleInfo.label}</Badge>
          {memberSince ? (
            <Badge size="sm" variant="dot" radius="xl" color="gray">
              Membro desde {memberSince}
            </Badge>
          ) : null}
        </Group>

        <Text c="dimmed" size="sm">{profile?.email || '-'}</Text>
        <Text c="dimmed" size="xs">Toque na foto para alterar</Text>

        {avatarUploading ? (
          <Text size="xs" c="dimmed">Enviando foto...</Text>
        ) : null}
      </Stack>

      <Stack gap={0} className="profile-clean-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activeMenu === item.key;

          return (
            <UnstyledButton
              key={item.key}
              className={`profile-clean-menu-item ${active ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <span className={`profile-clean-menu-icon ${active ? 'active' : ''}`} aria-hidden>
                    <Icon size={16} />
                  </span>
                  <Text fw={600}>{item.label}</Text>
                </Group>

                <ChevronRight size={16} />
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>

      {activeMenu === 'account' ? (
        <form onSubmit={onSaveProfile} className="profile-clean-panel profile-panel-enter">
          <Stack gap="sm">
            <TextInput label="Nome" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
            <TextInput label="Telefone" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} required />
            <TextInput label="CPF" value={cpf} onChange={(event) => setCpf(event.currentTarget.value)} />
            <TextInput
              label="Nascimento (YYYY-MM-DD)"
              value={birthDate}
              onChange={(event) => setBirthDate(event.currentTarget.value)}
            />

            {savedOk ? (
              <Alert color="teal" variant="light" radius="xl">
                Perfil atualizado com sucesso.
              </Alert>
            ) : null}

            <Button type="submit" loading={savingProfile} radius="xl">
              Salvar configuracao
            </Button>
          </Stack>
        </form>
      ) : null}

      {activeMenu === 'announce' ? (
        <Stack gap="sm" className="profile-clean-panel profile-panel-enter">
          <div className="profile-announce-banner">
            <Stack gap={4}>
              <Text fw={700}>Fluxo de anfitriao</Text>
              <Text size="sm" c="dimmed">
                Envie documentos, acompanhe sua validacao e publique seu imovel com seguranca.
              </Text>
            </Stack>
            <Group gap="xs" mt="sm" wrap="wrap">
              <Badge size="sm" variant="light" color={roleInfo.color}>{roleInfo.label}</Badge>
              {profile?.host_verification_submitted_at ? (
                <Badge size="sm" variant="dot" color="gray">
                  Ultimo envio: {formatDate(profile.host_verification_submitted_at)}
                </Badge>
              ) : null}
            </Group>
          </div>

          <Group grow>
            <Button component={Link} to="/app/announce" radius="xl" leftSection={<Home size={15} />}>
              Ir para anunciar
            </Button>
            <Button component={Link} to="/app/bookings" radius="xl" variant="default">
              Ver minhas reservas
            </Button>
          </Group>
        </Stack>
      ) : null}

      {activeMenu === 'help' ? (
        <Stack gap="md" className="profile-clean-panel profile-panel-enter">
          <div className="profile-support-block">
            <Text fw={700} size="sm" mb={10}>Abrir ticket de suporte</Text>
            <form onSubmit={submitSupportTicket}>
              <Stack gap="sm">
                <Select
                  label="Categoria"
                  data={supportCategoryOptions}
                  value={supportCategory}
                  onChange={(value) => setSupportCategory(value || 'outros')}
                />
                <TextInput
                  label="Assunto"
                  placeholder="Ex: problema no pagamento da reserva"
                  value={supportSubject}
                  onChange={(event) => setSupportSubject(event.currentTarget.value)}
                  required
                />
                <Textarea
                  label="Descricao"
                  minRows={3}
                  placeholder="Conte com detalhes o que aconteceu e informe a reserva, se houver."
                  value={supportMessage}
                  onChange={(event) => setSupportMessage(event.currentTarget.value)}
                  required
                />
                {supportSuccessMessage ? (
                  <Alert color="teal" variant="light" radius="md">
                    {supportSuccessMessage}
                  </Alert>
                ) : null}
                <Button
                  type="submit"
                  radius="xl"
                  leftSection={<MessageCircleMore size={15} />}
                  loading={supportSubmitting}
                  fullWidth
                >
                  Enviar ticket
                </Button>
              </Stack>
            </form>
          </div>

          <div className="profile-support-block">
            <Group justify="space-between" align="center" mb={8}>
              <Text fw={700} size="sm">Meus tickets</Text>
              <Button size="xs" variant="subtle" onClick={() => void loadSupportTickets()} loading={supportLoading}>
                Atualizar
              </Button>
            </Group>

            {supportLoading ? (
              <Text size="sm" c="dimmed">Carregando tickets...</Text>
            ) : supportTickets.length === 0 ? (
              <Text size="sm" c="dimmed">Voce ainda nao abriu nenhum ticket.</Text>
            ) : (
              <Stack gap="xs">
                {supportTickets.map((ticket) => {
                  const meta = supportStatusMeta[ticket.status];
                  return (
                    <Card key={ticket.id} withBorder radius="lg" p="sm">
                      <Stack gap={6}>
                        <Group justify="space-between" align="center">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {ticket.subject}
                          </Text>
                          <Badge size="xs" color={meta.color} variant="light">
                            {meta.label}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {ticket.category} - aberto em {formatDate(ticket.created_at)}
                        </Text>
                        <Text size="sm" c="dimmed">{ticket.message}</Text>
                        {ticket.admin_note ? (
                          <Alert color="blue" variant="light" radius="md">
                            Resposta do suporte: {ticket.admin_note}
                          </Alert>
                        ) : null}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </div>

          <div className="profile-faq-block">
            <Text fw={700} size="sm" mb={8}>Perguntas frequentes</Text>
            <Stack gap={0} className="profile-faq-list">
              {faqItems.map((item) => (
                <div key={item.q} className="profile-faq-item">
                  <UnstyledButton
                    className="profile-faq-trigger"
                    onClick={() => setOpenFaq(openFaq === item.q ? null : item.q)}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Text fw={600} size="sm">{item.q}</Text>
                      <ChevronDown
                        size={14}
                        style={{
                          flexShrink: 0,
                          color: '#7a8baa',
                          transform: openFaq === item.q ? 'rotate(180deg)' : 'none',
                          transition: 'transform 200ms ease',
                        }}
                      />
                    </Group>
                  </UnstyledButton>
                  {openFaq === item.q ? (
                    <Text size="sm" c="dimmed" className="profile-faq-answer">{item.a}</Text>
                  ) : null}
                </div>
              ))}
            </Stack>
          </div>

          <Group gap="xs" wrap="wrap">
            <Anchor component={Link} to="/termos-de-uso" size="xs" fw={600}>
              Termos de uso
            </Anchor>
            <Text size="xs" c="dimmed">-</Text>
            <Anchor component={Link} to="/politica-de-privacidade" size="xs" fw={600}>
              Politica de privacidade
            </Anchor>
          </Group>

          <Text size="xs" c="dimmed">
            Para casos urgentes, fale com o time em <Anchor href="mailto:suporte@alugasul.com.br">suporte@alugasul.com.br</Anchor>.
          </Text>
        </Stack>
      ) : null}

      {activeMenu === 'privacy' ? (
        <Stack gap="sm" className="profile-clean-panel profile-panel-enter">
          <div className="profile-data-card">
            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={600}>Nome publico</Text>
                <Text size="sm" fw={600}>{displayName}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={600}>Email</Text>
                <Text size="sm">{profile?.email || '-'}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={600}>Telefone</Text>
                <Text size="sm">{profile?.phone || '-'}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={600}>Status</Text>
                <Badge size="xs" variant="light" color={roleInfo.color} radius="xl">{roleInfo.label}</Badge>
              </Group>
            </Stack>
          </div>

          <Anchor component={Link} to="/politica-de-privacidade" size="sm" fw={600}>
            Ver politica de privacidade completa
          </Anchor>

          <Button
            color="red"
            variant="light"
            leftSection={<LogOut size={16} />}
            onClick={() => void signOut()}
            radius="xl"
            fullWidth
          >
            Sair da conta
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
