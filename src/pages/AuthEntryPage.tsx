import {
  Box,
  Button,
  Container,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { motion } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function AuthEntryPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/app/home" replace />;
  }

  return (
    <Box className="auth-hero premium" style={{ backgroundImage: "url('/background.png')" }}>
      <div className="overlay" />

      <Container size="sm" className="auth-entry-container">
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <Paper className="auth-card glass premium" radius="xl" shadow="xl" p="xl">
            <Stack gap="sm">
              <Group>
                <Image src="/logoapp.png" alt="Aluga Aluga" className="auth-logo" w={68} h={68} radius="lg" />
                <div>
                  <Title order={1} c="white">
                    Aluga Aluga
                  </Title>
                  <Text c="rgba(255,255,255,0.85)" size="sm">
                    Marketplace local premium do Cassino
                  </Text>
                </div>
              </Group>

              <Text c="rgba(255,255,255,0.90)">
                Reserve com seguranca, avalie anfitrioes e gerencie alugueis em tempo real.
              </Text>

              <Stack gap={10} mt="sm">
                <Button
                  size="lg"
                  radius="md"
                  variant="gradient"
                  gradient={{ from: 'ocean.6', to: 'ocean.4', deg: 135 }}
                  onClick={() => navigate('/signup')}
                >
                  Criar conta
                </Button>
                <Button size="lg" radius="md" variant="white" color="dark" onClick={() => navigate('/login')}>
                  Ja tenho conta
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
