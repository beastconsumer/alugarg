import { useEffect, useState } from 'react';
import { Alert, Card, Stack, Text, Title } from '@mantine/core';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const otpType = params.get('type');

        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email',
          });
          if (error) throw error;
        }

        setConfirmed(true);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao confirmar email.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  if (loading) {
    return (
      <Stack py="xl" align="center">
        <Text c="dimmed">Confirmando seu email...</Text>
      </Stack>
    );
  }

  return (
    <Stack py="xl" align="center" px="md">
      <Card withBorder radius="xl" p="lg" maw={520} w="100%">
        <Stack gap="md">
          {confirmed ? (
            <>
              <Title order={3}>Conta confirmada</Title>
              <Alert color="green" variant="light">
                Conta confirmada com sucesso. Voce ja pode fechar esta pagina e entrar no app.
              </Alert>
            </>
          ) : (
            <>
              <Title order={3}>Nao foi possivel confirmar</Title>
              <Alert color="red" variant="light">
                {errorMessage || 'Link invalido ou expirado.'}
              </Alert>
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
