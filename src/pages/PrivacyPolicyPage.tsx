import { Anchor, Box, Card, Container, List, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

const sections = [
  {
    title: '1. Dados coletados',
    items: [
      'Dados de cadastro: nome, telefone, email, CPF e data de nascimento.',
      'Dados de uso: historico de reservas, interacoes no app, mensagens e logs tecnicos.',
      'Dados de verificacao: documentos enviados para validacao de anfitriao e prevencao a fraude.',
    ],
  },
  {
    title: '2. Finalidades do tratamento',
    items: [
      'Autenticar usuarios, operar reservas, processar pagamentos e executar repasses.',
      'Prevenir fraude, cumprir obrigacoes legais/regulatorias e proteger direitos da plataforma e de terceiros.',
      'Atender suporte, auditoria, resolucao de disputas e melhoria de seguranca/experiencia.',
    ],
  },
  {
    title: '3. Compartilhamento de dados',
    items: [
      'Compartilhamos o minimo necessario com provedores de pagamento, infraestrutura, antifraude e atendimento.',
      'Tambem pode haver compartilhamento para cumprimento de ordem legal, regulatoria ou judicial.',
      'Nao vendemos dados pessoais para terceiros.',
    ],
  },
  {
    title: '4. Retencao e descarte',
    items: [
      'Dados sao mantidos pelo periodo necessario para operacao, seguranca, defesa em processos e obrigacoes legais.',
      'Apos o prazo aplicavel, os dados sao anonimizados ou eliminados conforme politica interna e requisitos legais.',
    ],
  },
  {
    title: '5. Seguranca',
    items: [
      'Adotamos controles tecnicos e administrativos de seguranca, incluindo restricao de acesso e trilhas de auditoria.',
      'Nenhum sistema e infalivel; incidentes podem ocorrer e serao tratados com plano de resposta e comunicacao aplicavel.',
    ],
  },
  {
    title: '6. Direitos do titular',
    items: [
      'O usuario pode solicitar confirmacao de tratamento, acesso, correcao, exclusao, portabilidade e revisao de decisoes, quando cabivel.',
      'Solicitacoes podem ser limitadas por obrigacoes legais, seguranca, prevencao a fraude e defesa de direitos em disputa.',
    ],
  },
  {
    title: '7. Cookies, SDKs e notificacoes',
    items: [
      'Podemos usar identificadores tecnicos para manter sessao, seguranca, notificacoes e funcionamento essencial do app.',
      'Desativar certos recursos pode afetar funcionalidades criticas de reserva e autenticacao.',
    ],
  },
  {
    title: '8. Alteracoes desta politica',
    items: [
      'A politica pode ser atualizada para refletir mudancas legais, operacionais e de seguranca.',
      'O uso continuado da plataforma apos atualizacao representa ciencia da versao vigente.',
    ],
  },
];

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
                Ultima atualizacao: 26/02/2026
              </Text>
              <Text size="xs" c="dimmed">
                Politica oficial de privacidade e protecao de dados da plataforma AlugaSul.
              </Text>
            </Stack>

            {sections.map((section) => (
              <Stack key={section.title} gap={6}>
                <Title order={4}>{section.title}</Title>
                <List spacing={4} size="sm">
                  {section.items.map((item) => (
                    <List.Item key={item}>{item}</List.Item>
                  ))}
                </List>
              </Stack>
            ))}

            <Anchor component={Link} to={backTo} fw={700}>
              Voltar para o app
            </Anchor>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}
