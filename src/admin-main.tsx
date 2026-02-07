import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { envIssue } from './env';
import { ErrorScreen } from './components/ErrorScreen';
import { AdminPage } from './pages/AdminPage';
import { appTheme } from './theme';
import './styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

ReactDOM.createRoot(document.getElementById('admin-root')!).render(
  <React.StrictMode>
    <MantineProvider theme={appTheme} defaultColorScheme="light">
      <Notifications position="top-right" />
      {envIssue ? <ErrorScreen title="Configuracao invalida" message={envIssue} /> : <AdminPage />}
    </MantineProvider>
  </React.StrictMode>,
);
