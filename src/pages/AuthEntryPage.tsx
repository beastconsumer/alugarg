import {
  Box,
  Button,
  Container,
  Divider,
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
    <Box className="auth-gate-shell" style={{ backgroundImage: "url('/background.png')" }}>
      <div className="auth-gate-overlay" aria-hidden="true" />

      <Container size="xs" className="auth-gate-container">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Paper className="auth-gate-card" radius="xl" shadow="xl" p="xl">
            <Stack gap="sm">
              <div>
                <Title order={2} className="auth-gate-title">
                  Entrar ou cadastrar
                </Title>
                <Text className="auth-gate-sub">
                  Crie sua conta em minutos ou entre com seus dados.
                </Text>
              </div>

              <Button
                size="lg"
                radius="md"
                className="auth-gate-primary"
                onClick={() => navigate('/signup')}
                fullWidth
              >
                Criar conta
              </Button>

              <Button
                size="lg"
                radius="md"
                className="auth-gate-secondary"
                variant="white"
                color="dark"
                onClick={() => navigate('/login')}
                fullWidth
              >
                Ja tenho conta
              </Button>

              <Divider my="xs" />

              <Text className="auth-gate-fine" size="xs" c="dimmed">
                Ao continuar, voce concorda com nossos termos e confirma que leu nossa politica de privacidade.
              </Text>
            </Stack>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
