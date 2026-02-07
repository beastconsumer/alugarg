import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/phone';
import { formatDate, formatMoney } from '../lib/format';
import { parseProperty, parseProfile, Property, UserProfile } from '../lib/types';

interface AdminItem {
  property: Property;
  owner: UserProfile | null;
}

export function AdminPage() {
  const [ready, setReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [items, setItems] = useState<AdminItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadAdminState = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id || '';
    setSessionUserId(userId);

    if (!userId) {
      setIsAdmin(false);
      setReady(true);
      return;
    }

    const { data: profileRow } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

    const role = String(profileRow?.role ?? 'user');
    setIsAdmin(role === 'admin');
    setReady(true);
  };

  const loadPendingProperties = async () => {
    setLoadingData(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase.from('properties').select('*').order('created_at', { ascending: false });

      if (error) throw error;

      const parsed = (data ?? []).map((row) => parseProperty(row));
      const ownerIds = Array.from(new Set(parsed.map((item) => item.owner_id)));

      let ownerMap = new Map<string, UserProfile>();
      if (ownerIds.length > 0) {
        const { data: ownerRows, error: ownerError } = await supabase.from('users').select('*').in('id', ownerIds);

        if (ownerError) throw ownerError;

        ownerMap = new Map(
          (ownerRows ?? []).map((row) => {
            const profile = parseProfile(row);
            return [profile.id, profile];
          }),
        );
      }

      setItems(
        parsed.map((property) => ({
          property,
          owner: ownerMap.get(property.owner_id) ?? null,
        })),
      );
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

    void loadPendingProperties();

    const channel = supabase
      .channel('admin-properties-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          void loadPendingProperties();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, isAdmin]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.property.status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 },
    );
  }, [items]);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();

    setLoginLoading(true);
    setErrorMessage('');

    try {
      let email = identifier.trim().toLowerCase();
      if (!email.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email_by_phone', {
          p_phone: normalizePhone(identifier),
        });

        if (error) throw error;
        if (!data) throw new Error('Telefone nao encontrado.');

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

  const updateStatus = async (
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

      await loadPendingProperties();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao atualizar status');
    }
  };

  if (!ready) {
    return (
      <Stack py="xl" align="center">
        <Text c="dimmed">Inicializando painel...</Text>
      </Stack>
    );
  }

  if (!sessionUserId) {
    return (
      <Stack className="admin-page" justify="center" align="center" mih="100dvh" p="md">
        <Paper withBorder radius="xl" shadow="lg" p="xl" maw={520} w="100%">
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={2}>Aluga Aluga Admin</Title>
              <Text c="dimmed">Site para moderacao e aprovacao de anuncios.</Text>
            </Stack>

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

                {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

                <Button type="submit" loading={loginLoading}>
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
      <Stack className="admin-page" justify="center" align="center" mih="100dvh" p="md">
        <Paper withBorder radius="xl" shadow="lg" p="xl" maw={520} w="100%">
          <Stack gap="md">
            <Title order={2}>Acesso negado</Title>
            <Alert color="red">
              Este usuario nao tem permissao de admin. Promova o role para admin no Supabase.
            </Alert>
            <Button
              variant="default"
              onClick={() =>
                void supabase.auth.signOut().then(() => {
                  setSessionUserId('');
                  setIsAdmin(false);
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
    <Stack gap="md" p="md" maw={1200} mx="auto" className="admin-page">
      <Card withBorder radius="xl" p="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Admin Aluga Aluga</Title>
            <Text c="dimmed">Atualizacao em tempo real de anuncios</Text>
          </div>
          <Button
            variant="default"
            onClick={() =>
              void supabase.auth.signOut().then(() => {
                setSessionUserId('');
                setIsAdmin(false);
              })
            }
          >
            Sair
          </Button>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card withBorder radius="xl" p="lg">
          <Text c="dimmed">Pendentes</Text>
          <Title order={2}>{summary.pending}</Title>
        </Card>
        <Card withBorder radius="xl" p="lg">
          <Text c="dimmed">Aprovados</Text>
          <Title order={2}>{summary.approved}</Title>
        </Card>
        <Card withBorder radius="xl" p="lg">
          <Text c="dimmed">Rejeitados</Text>
          <Title order={2}>{summary.rejected}</Title>
        </Card>
      </SimpleGrid>

      {loadingData ? <Text c="dimmed">Carregando anuncios...</Text> : null}
      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Stack gap="sm">
        {items.map(({ property, owner }) => (
          <Card key={property.id} withBorder radius="xl" p="lg">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={700} size="lg">
                    {property.title}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {property.location.addressText || 'Sem endereco'}
                  </Text>
                  <Text size="sm">
                    {formatMoney(property.price)} - {property.rent_type}
                  </Text>
                  <Text c="dimmed" size="sm">
                    Status: {property.status} • Criado em {formatDate(property.created_at)}
                  </Text>
                  <Text c="dimmed" size="sm">
                    Proprietario: {owner?.name || 'Sem nome'} ({owner?.phone || '-'})
                  </Text>
                </div>

                <Group gap="xs" wrap="wrap">
                  {property.verified ? (
                    <Badge color="teal" leftSection={<ShieldCheck size={14} />}>
                      Verificado
                    </Badge>
                  ) : (
                    <Badge variant="light">Nao verificado</Badge>
                  )}
                </Group>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                {(property.photos.length > 0 ? property.photos.slice(0, 3) : ['/background.png']).map((photo) => (
                  <img key={photo} src={photo} alt={property.title} className="admin-photo" />
                ))}
              </SimpleGrid>

              <Group wrap="wrap">
                <Button size="xs" onClick={() => void updateStatus(property.id, 'approved')}>
                  Aprovar
                </Button>
                <Button size="xs" color="red" onClick={() => void updateStatus(property.id, 'rejected')}>
                  Rejeitar
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => void updateStatus(property.id, property.status, !property.verified)}
                >
                  {property.verified ? 'Remover selo' : 'Marcar verificado'}
                </Button>
                <Button size="xs" variant="default" onClick={() => void updateStatus(property.id, 'pending')}>
                  Voltar para pendente
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
