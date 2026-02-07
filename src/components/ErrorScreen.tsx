import { ReactNode } from 'react';
import { Alert, Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { AlertCircle } from 'lucide-react';

export function ErrorScreen({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Center mih="100dvh" p="md">
      <Paper withBorder radius="xl" shadow="md" p="xl" maw={560} w="100%">
        <Stack gap="md">
          <Title order={2}>{title}</Title>
          <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
            <Text size="sm">{message}</Text>
          </Alert>
          {action ?? <Button component="a" href="/">Voltar ao inicio</Button>}
        </Stack>
      </Paper>
    </Center>
  );
}
