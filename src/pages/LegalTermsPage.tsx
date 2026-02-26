import { Anchor, Box, Card, Container, List, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

const sections = [
  {
    title: '1. Natureza da plataforma',
    items: [
      'O AlugaSul atua como plataforma de intermediacao entre anfitrioes e hospedes.',
      'O contrato de locacao e firmado diretamente entre anfitriao e hospede; a plataforma nao se torna parte locadora ou locataria.',
    ],
  },
  {
    title: '2. Conta e elegibilidade',
    items: [
      'O usuario deve fornecer dados verdadeiros e manter informacoes atualizadas.',
      'E proibido compartilhar conta, burlar verificacoes ou usar identidade de terceiros.',
      'A plataforma pode solicitar validacao adicional de identidade e documentos a qualquer momento.',
    ],
  },
  {
    title: '3. Regras para anfitrioes',
    items: [
      'O anfitriao responde pela veracidade do anuncio, fotos, disponibilidade, regras e condicoes do imovel.',
      'E obrigatorio cumprir leis locais, regras de condominio, obrigacoes fiscais e de seguranca.',
      'Problemas no imovel, cancelamentos indevidos ou informacao enganosa podem gerar bloqueio, reembolso e responsabilizacao.',
    ],
  },
  {
    title: '4. Regras para hospedes',
    items: [
      'O hospede deve respeitar regras da casa, capacidade maxima, horarios e normas locais.',
      'Danos ao imovel, conduta abusiva, fraude ou uso ilegal podem gerar multa, bloqueio e cobranca regressiva.',
    ],
  },
  {
    title: '5. Pagamentos, taxas e repasses',
    items: [
      'Taxas da plataforma e valores de limpeza/servico sao exibidos no checkout antes da confirmacao.',
      'A plataforma pode reter ou estornar valores em caso de suspeita de fraude, chargeback, ordem judicial ou violacao destes termos.',
      'Repasses ao anfitriao podem ser suspensos ate conclusao de analise de risco ou disputa.',
    ],
  },
  {
    title: '6. Cancelamento, no-show e reembolso',
    items: [
      'As regras de cancelamento aplicaveis a cada reserva prevalecem conforme informadas no momento da contratacao.',
      'No-show, cancelamento fora da politica ou violacao de regras pode implicar perda parcial ou total dos valores pagos.',
      'Em casos excepcionais de risco, fraude ou ilicitude, a plataforma pode cancelar reservas unilateralmente para proteger as partes.',
    ],
  },
  {
    title: '7. Bloqueio, suspensao e encerramento',
    items: [
      'Contas podem ser bloqueadas preventiva ou definitivamente por fraude, risco operacional, descumprimento legal/contratual ou uso abusivo.',
      'Durante bloqueio, o usuario pode ter acesso restrito a reservas, chats, anuncios e funcoes financeiras.',
    ],
  },
  {
    title: '8. Limitacao de responsabilidade',
    items: [
      'O AlugaSul nao garante ausencia total de falhas, indisponibilidades tecnicas ou condutas de terceiros.',
      'A responsabilidade da plataforma fica limitada aos limites legais e ao valor das taxas efetivamente recebidas na operacao discutida, quando aplicavel.',
      'A plataforma nao responde por lucros cessantes, danos indiretos ou fatos de terceiros fora de seu controle razoavel, salvo dolo ou culpa grave quando exigido por lei.',
    ],
  },
  {
    title: '9. Indenizacao',
    items: [
      'O usuario concorda em indenizar a plataforma por prejuizos decorrentes de fraude, violacao contratual, uso ilegal ou violacao de direitos de terceiros.',
    ],
  },
  {
    title: '10. Propriedade intelectual e uso da marca',
    items: [
      'Interface, codigo, identidade visual e conteudos institucionais sao protegidos e nao podem ser copiados sem autorizacao.',
    ],
  },
  {
    title: '11. Provas, auditoria e foro',
    items: [
      'Logs tecnicos, comprovantes de pagamento, mensagens e registros de seguranca podem ser utilizados como prova para analise de disputa.',
      'Eventuais disputas serao tratadas conforme legislacao aplicavel e foro definido em contrato especifico ou na jurisdicao legal competente.',
    ],
  },
  {
    title: '12. Alteracoes dos termos',
    items: [
      'Os termos podem ser atualizados para refletir mudancas legais, operacionais e de seguranca.',
      'A continuidade de uso apos atualizacao representa aceite da versao vigente.',
    ],
  },
];

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
                Ultima atualizacao: 26/02/2026
              </Text>
              <Text size="xs" c="dimmed">
                Este texto e informativo e deve ser validado por assessoria juridica antes da publicacao oficial.
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
