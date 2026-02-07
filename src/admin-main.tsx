import React from 'react';
import ReactDOM from 'react-dom/client';
import { envIssue } from './env';
import { ErrorScreen } from './components/ErrorScreen';
import { AdminPage } from './pages/AdminPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('admin-root')!).render(
  <React.StrictMode>
    {envIssue ? <ErrorScreen title="Configuracao invalida" message={envIssue} /> : <AdminPage />}
  </React.StrictMode>,
);

