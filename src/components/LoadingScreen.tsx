import { Center, Loader, Paper, Stack, Text } from '@mantine/core';

export function LoadingScreen({ message = 'Carregando...' }: { message?: string }) {
  return (
    <Center mih="100dvh" p="md">
      <Paper withBorder radius="xl" shadow="md" p="xl" maw={420} w="100%">
        <Stack align="center" gap="md">
          <Loader color="ocean" />
          <Text c="dimmed" ta="center">
            {message}
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
