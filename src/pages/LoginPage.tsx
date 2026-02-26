import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Anchor, Box, Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { AlertCircle, ArrowLeft, Lock, LogIn, Mail, Phone, Send } from 'lucide-react';
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

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

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

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      navigate('/app/home', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  };

  const onForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotError('');

    if (!forgotEmail.trim()) {
      setForgotError('Informe seu email de cadastro.');
      return;
    }

    setForgotLoading(true);

    try {
      const configuredPublicUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ?? '';
      const redirectBase = (configuredPublicUrl || window.location.origin).replace(/\/$/, '');

      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        redirectTo: `${redirectBase}/auth/callback`,
      });

      if (error) throw error;
      setForgotSent(true);
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : 'Falha ao enviar email');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <Box className="auth-clean-shell">
      <Container size="xs" className="auth-clean-container">
        {/* Brand header */}
        <div className="auth-brand-header">
          <img src="/logoapp.png" alt="AlugaSul" className="auth-brand-logo" />
          <span className="auth-brand-name">AlugaSul</span>
          <span className="auth-brand-tagline">Aluguel de temporada no Sul</span>
        </div>

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

            {forgotMode ? (
              /* ── Forgot password panel ── */
              <Stack gap="sm">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<ArrowLeft size={14} />}
                  onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(''); }}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Voltar ao login
                </Button>

                <div className="auth-forgot-panel">
                  <Stack gap="sm">
                    <Text fw={700} size="sm">Redefinir senha</Text>
                    <Text size="xs" c="dimmed">
                      Informe o email da sua conta e enviaremos um link para redefinir sua senha.
                    </Text>

                    {forgotSent ? (
                      <Alert color="teal" variant="light" radius="md">
                        Email enviado! Verifique sua caixa de entrada e siga as instrucoes.
                      </Alert>
                    ) : (
                      <form onSubmit={onForgotSubmit}>
                        <Stack gap="sm">
                          <TextInput
                            label="Email de cadastro"
                            type="email"
                            placeholder="email@dominio.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.currentTarget.value)}
                            leftSection={<Mail size={16} />}
                            required
                          />

                          {forgotError ? (
                            <Alert color="red" variant="light" icon={<AlertCircle size={14} />} radius="md">
                              {forgotError}
                            </Alert>
                          ) : null}

                          <Button
                            type="submit"
                            loading={forgotLoading}
                            leftSection={<Send size={14} />}
                            fullWidth
                            radius="xl"
                          >
                            Enviar link de redefinicao
                          </Button>
                        </Stack>
                      </form>
                    )}
                  </Stack>
                </div>
              </Stack>
            ) : (
              /* ── Login form ── */
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

                  <Text size="xs" ta="right">
                    <Anchor
                      fw={600}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setForgotMode(true); setForgotEmail(identifier.includes('@') ? identifier : ''); }}
                    >
                      Esqueceu a senha?
                    </Anchor>
                  </Text>

                  {noticeMessage ? <Alert color="green" variant="light">{noticeMessage}</Alert> : null}

                  {errorMessage ? (
                    <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
                      {errorMessage}
                    </Alert>
                  ) : null}

                  <Button type="submit" loading={loading} leftSection={<LogIn size={16} />} fullWidth radius="xl">
                    Entrar
                  </Button>
                </Stack>
              </form>
            )}

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
