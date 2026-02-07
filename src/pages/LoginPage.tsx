import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { AlertCircle, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/phone';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState(
    ((location.state as { notice?: string } | null)?.notice ?? '').toString(),
  );

  const isPhone = useMemo(() => /\d{8,}/.test(identifier.replace(/\D/g, '')), [identifier]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');
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
    <Box className="auth-screen-shell">
      <Container size="xs" py={48}>
        <Paper withBorder radius="xl" shadow="lg" p="xl">
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={2}>Entrar</Title>
              <Text c="dimmed" size="sm">
                Use email ou telefone com senha.
              </Text>
            </Stack>

            <form onSubmit={onSubmit}>
              <Stack gap="md">
                <TextInput
                  label="Email ou telefone"
                  placeholder="email@dominio.com ou +5553999005952"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.currentTarget.value)}
                  required
                />

                <PasswordInput
                  label="Senha"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                />

                {noticeMessage ? (
                  <Alert color="green" variant="light">
                    {noticeMessage}
                  </Alert>
                ) : null}

                {errorMessage ? (
                  <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
                    {errorMessage}
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  loading={loading}
                  leftSection={<LogIn size={16} />}
                  variant="gradient"
                  gradient={{ from: 'ocean.6', to: 'ocean.4', deg: 120 }}
                  fullWidth
                >
                  Entrar
                </Button>
              </Stack>
            </form>

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
