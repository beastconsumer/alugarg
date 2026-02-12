import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { AlertCircle, Apple, Facebook, Lock, LogIn, Mail, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/phone';

type LoginStage = 'identifier' | 'password';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<LoginStage>('identifier');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState(
    ((location.state as { notice?: string } | null)?.notice ?? '').toString(),
  );

  const isPhone = useMemo(() => /\d{8,}/.test(identifier.replace(/\D/g, '')), [identifier]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');
    setInfoMessage('');

    if (stage === 'identifier') {
      if (!identifier.trim()) {
        setErrorMessage('Informe seu email ou telefone.');
        return;
      }

      setStage('password');
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
    <Box className="auth-air-shell">
      <Container size="xs" className="auth-air-container">
        <Paper className="auth-air-card" radius="xl" p="xl" shadow="xl">
          <Group justify="space-between" align="center" className="auth-air-header">
            <Title order={3} className="auth-air-title">
              Entrar ou cadastrar
            </Title>
            <Text className="auth-air-brand">Aluga Aluga</Text>
          </Group>

          <Text className="auth-air-sub" size="sm">
            {stage === 'identifier'
              ? 'Use email ou telefone. Depois, confirme com sua senha.'
              : 'Digite sua senha para continuar.'}
          </Text>

          <form onSubmit={onSubmit}>
            <Stack gap="sm" mt="md">
              <TextInput
                label="Email ou telefone"
                placeholder="email@dominio.com ou +55 53 99900-5952"
                value={identifier}
                onChange={(event) => setIdentifier(event.currentTarget.value)}
                leftSection={isPhone ? <Phone size={16} /> : <Mail size={16} />}
                required
              />

              {stage === 'password' ? (
                <PasswordInput
                  label="Senha"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  leftSection={<Lock size={16} />}
                  required
                />
              ) : null}

              {noticeMessage ? (
                <Alert color="green" variant="light">
                  {noticeMessage}
                </Alert>
              ) : null}

              {infoMessage ? (
                <Alert color="blue" variant="light">
                  {infoMessage}
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
                leftSection={stage === 'password' ? <LogIn size={16} /> : undefined}
                className="auth-air-continue"
                fullWidth
              >
                {stage === 'password' ? 'Entrar' : 'Continuar'}
              </Button>

              {stage === 'password' ? (
                <Button
                  type="button"
                  variant="subtle"
                  className="auth-air-back"
                  onClick={() => {
                    setStage('identifier');
                    setPassword('');
                  }}
                >
                  Voltar
                </Button>
              ) : (
                <Text className="auth-air-policy" size="xs" c="dimmed">
                  Continuando, voce concorda com nossos termos e confirma que leu nossa politica de privacidade.
                </Text>
              )}
            </Stack>
          </form>

          {stage === 'identifier' ? (
            <>
              <Divider className="auth-air-divider" label="ou" labelPosition="center" my="lg" />

              <Stack gap="sm">
                <Button
                  variant="outline"
                  className="auth-air-alt"
                  leftSection={<Facebook size={18} />}
                  fullWidth
                  onClick={() => setInfoMessage('Login com Facebook: em breve.')}
                >
                  Continuar com Facebook
                </Button>

                <Button
                  variant="outline"
                  className="auth-air-alt"
                  leftSection={<Mail size={18} />}
                  fullWidth
                  onClick={() => setInfoMessage('Login com Google: em breve.')}
                >
                  Continuar com Google
                </Button>

                <Button
                  variant="outline"
                  className="auth-air-alt"
                  leftSection={<Apple size={18} />}
                  fullWidth
                  onClick={() => setInfoMessage('Login com Apple: em breve.')}
                >
                  Continuar com Apple
                </Button>

                <Button
                  variant="outline"
                  className="auth-air-alt"
                  leftSection={<Mail size={18} />}
                  fullWidth
                  onClick={() => setInfoMessage('Voce ja pode entrar com email/telefone acima.')}
                >
                  Continuar com email
                </Button>
              </Stack>
            </>
          ) : null}

          <Text c="dimmed" size="sm" ta="center" mt="lg">
            Nao tem conta?{' '}
            <Anchor component={Link} to="/signup" fw={700}>
              Criar conta
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

