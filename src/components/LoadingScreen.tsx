import { Center, Paper, Stack, Text } from '@mantine/core';
import UseAnimations from 'react-useanimations';
import loadingAnimated from 'react-useanimations/lib/loading2';

export function LoadingScreen({ message = 'Carregando...' }: { message?: string }) {
  return (
    <Center mih="100dvh" p="md">
      <Paper withBorder radius="xl" shadow="md" p="xl" maw={420} w="100%">
        <Stack align="center" gap="md">
          <UseAnimations animation={loadingAnimated} size={48} strokeColor="#1f5ed6" autoplay loop speed={0.8} />
          <Text c="dimmed" ta="center">
            {message}
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
