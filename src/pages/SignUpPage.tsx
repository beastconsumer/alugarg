import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Checkbox,
  Container,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { AlertCircle, UserPlus } from 'lucide-react';
import { parseBirthDateText } from '../lib/format';
import { toE164Like } from '../lib/phone';
import { supabase } from '../lib/supabase';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [birthDateText, setBirthDateText] = useState('');
  const [password, setPassword] = useState('');
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const birthDate = parseBirthDateText(birthDateText);
    if (!birthDate) {
      setErrorMessage('Data invalida. Use DD/MM/AAAA.');
      return;
    }

    if (!strongPasswordRegex.test(password)) {
      setErrorMessage('Senha fraca. Use 8+ caracteres com maiuscula, minuscula, numero e simbolo.');
      return;
    }

    if (!acceptLegal) {
      setErrorMessage('Voce precisa aceitar os Termos de Uso e a Politica de Privacidade.');
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = toE164Like(phone);
      const configuredPublicUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ?? '';
      const redirectBase = (configuredPublicUrl || window.location.origin).replace(/\/$/, '');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${redirectBase}/auth/callback`,
          data: {
            name: name.trim(),
            phone: normalizedPhone,
            cpf: cpf.trim(),
            birth_date: birthDate,
          },
        },
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('Nao foi possivel criar a conta.');

      if (data.session) {
        const { error: profileError } = await supabase.from('users').upsert({
          id: userId,
          name: name.trim(),
          phone: normalizedPhone,
          cpf: cpf.trim(),
          email: email.trim().toLowerCase(),
          birth_date: birthDate,
        });

        if (profileError) throw profileError;

        navigate('/app/home', { replace: true });
        return;
      }

      navigate('/login', {
        replace: true,
        state: {
          notice: 'Conta criada. Se seu projeto exige confirmacao de email, confirme e depois faca login.',
        },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-clean-shell">
      <Container size="sm" className="auth-clean-container">
        <Paper withBorder radius="xl" p="xl" className="auth-clean-card">
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={2} className="auth-clean-title">
                Criar conta
              </Title>
              <Text c="dimmed" size="sm">
                Cadastro simples para reservar, anunciar e conversar com seguranca.
              </Text>
            </Stack>

            <form onSubmit={onSubmit}>
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Nome completo"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Telefone"
                    placeholder="+5553999005952"
                    value={phone}
                    onChange={(event) => setPhone(event.currentTarget.value)}
                    required
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(event) => setCpf(event.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Data de nascimento"
                    placeholder="DD/MM/AAAA"
                    value={birthDateText}
                    onChange={(event) => setBirthDateText(event.currentTarget.value)}
                    required
                  />
                </SimpleGrid>

                <TextInput
                  label="Email"
                  type="email"
                  placeholder="email@dominio.com"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                />

                <PasswordInput
                  label="Senha forte"
                  description="Minimo 8, com maiuscula, minuscula, numero e simbolo"
                  placeholder="Crie uma senha"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                />

                <Checkbox
                  checked={acceptLegal}
                  onChange={(event) => setAcceptLegal(event.currentTarget.checked)}
                  label={
                    <span>
                      Li e aceito os{' '}
                      <Anchor component={Link} to="/termos-de-uso" fw={700}>
                        Termos de Uso
                      </Anchor>{' '}
                      e a{' '}
                      <Anchor component={Link} to="/politica-de-privacidade" fw={700}>
                        Politica de Privacidade
                      </Anchor>
                      .
                    </span>
                  }
                />

                {errorMessage ? (
                  <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
                    {errorMessage}
                  </Alert>
                ) : null}

                <Button type="submit" loading={loading} leftSection={<UserPlus size={16} />} fullWidth>
                  Criar conta
                </Button>
              </Stack>
            </form>

            <Text c="dimmed" size="sm" ta="center">
              Ja tem conta?{' '}
              <Anchor component={Link} to="/login" fw={700}>
                Entrar
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
