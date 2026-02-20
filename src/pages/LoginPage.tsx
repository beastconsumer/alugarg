import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Anchor, Box, Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { AlertCircle, Lock, LogIn, Mail, Phone } from 'lucide-react';
import { normalizePhone } from '../lib/phone';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage] = useState(((location.state as { notice?: string } | null)?.notice ?? '').toString());

  const isPhone = useMemo(() => /\d{8,}/.test(identifier.replace(/\D/g, '')), [identifier]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!identifier.trim()) {
      setErrorMessage('Informe seu email ou telefone.');
      return;
    }

    if (!password) {
      setErrorMessage('Informe sua senha.');
      return;
    }

    setLoading(true);

    try {
      let email = identifier.trim().toLowerCase();

      if (isPhone && !identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email_by_phone', {
          p_phone: normalizePhone(identifier),
        });

        if (error) throw error;
        if (!data) throw new Error('Telefone nao encontrado. Cadastre-se primeiro.');

        email = String(data);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      navigate('/app/home', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-clean-shell">
      <Container size="xs" className="auth-clean-container">
        <Paper radius="xl" p="xl" withBorder className="auth-clean-card">
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={2} className="auth-clean-title">
                Entrar
              </Title>
              <Text c="dimmed" size="sm">
                Acesse sua conta para acompanhar reservas, chat e perfil.
              </Text>
            </Stack>

            <form onSubmit={onSubmit}>
              <Stack gap="sm">
                <TextInput
                  label="Email ou telefone"
                  placeholder="email@dominio.com ou +55 53 99900-5952"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.currentTarget.value)}
                  leftSection={isPhone ? <Phone size={16} /> : <Mail size={16} />}
                  required
                />

                <PasswordInput
                  label="Senha"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  leftSection={<Lock size={16} />}
                  required
                />

                {noticeMessage ? <Alert color="green" variant="light">{noticeMessage}</Alert> : null}

                {errorMessage ? (
                  <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
                    {errorMessage}
                  </Alert>
                ) : null}

                <Button type="submit" loading={loading} leftSection={<LogIn size={16} />} fullWidth>
                  Entrar
                </Button>
              </Stack>
            </form>

            <Text className="auth-clean-fine" size="xs" c="dimmed">
              Ao entrar, voce concorda com nossos{' '}
              <Anchor component={Link} to="/termos-de-uso" fw={700}>
                Termos de Uso
              </Anchor>{' '}
              e com a{' '}
              <Anchor component={Link} to="/politica-de-privacidade" fw={700}>
                Politica de Privacidade
              </Anchor>
              .
            </Text>

            <Text c="dimmed" size="sm" ta="center">
              Nao tem conta?{' '}
              <Anchor component={Link} to="/signup" fw={700}>
                Criar conta
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
