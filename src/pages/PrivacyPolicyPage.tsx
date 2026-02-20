import { Anchor, Box, Card, Container, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function PrivacyPolicyPage() {
  const { session } = useAuth();
  const backTo = session ? '/app/announce' : '/login';

  return (
    <Box py="md">
      <Container size="md">
        <Card withBorder radius="xl" p="lg">
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={2}>Politica de Privacidade</Title>
              <Text size="sm" c="dimmed">
                Ultima atualizacao: 20/02/2026
              </Text>
            </Stack>

            <Text>
              Coletamos dados de cadastro, contato e uso da plataforma para autenticar usuarios, processar reservas e
              oferecer suporte operacional.
            </Text>
            <Text>
              Documentos enviados para verificacao de anfitriao sao armazenados com acesso restrito e utilizados apenas para
              analise de identidade e prevencao a fraudes.
            </Text>
            <Text>
              Nao comercializamos dados pessoais. Compartilhamentos podem ocorrer apenas quando necessarios para cumprir lei,
              responder autoridade competente ou proteger direitos da plataforma e de terceiros.
            </Text>
            <Text>
              O usuario pode solicitar atualizacao ou exclusao de dados pessoais, observadas obrigacoes legais de retencao e
              seguranca.
            </Text>

            <Anchor component={Link} to={backTo} fw={700}>
              Voltar para o app
            </Anchor>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}
