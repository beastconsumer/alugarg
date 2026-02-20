import { Anchor, Box, Card, Container, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function LegalTermsPage() {
  const { session } = useAuth();
  const backTo = session ? '/app/announce' : '/login';

  return (
    <Box py="md">
      <Container size="md">
        <Card withBorder radius="xl" p="lg">
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={2}>Termos de Uso</Title>
              <Text size="sm" c="dimmed">
                Ultima atualizacao: 20/02/2026
              </Text>
            </Stack>

            <Text>
              Ao utilizar o AlugaSul, voce concorda em fornecer informacoes verdadeiras, manter seus dados atualizados
              e respeitar as regras de convivencia entre hospedes e anfitrioes.
            </Text>
            <Text>
              O anunciante e responsavel pela veracidade das informacoes publicadas no anuncio, incluindo fotos, preco,
              regras da casa e disponibilidade.
            </Text>
            <Text>
              A plataforma pode suspender contas, anuncios ou reservas em caso de fraude, envio de documentos invalidos,
              violacao de regras internas ou descumprimento de obrigacoes legais.
            </Text>
            <Text>
              O uso da plataforma nao autoriza atividades ilegais, discriminatorias, perigosas ou que violem normas locais
              e regulamentos de condominio.
            </Text>
            <Text>
              Para suporte, solicitacoes legais ou revisao de dados, entre em contato pelos canais oficiais cadastrados no
              app.
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
