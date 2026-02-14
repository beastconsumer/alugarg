import { Navigate, Route, Routes } from 'react-router-dom';
import { envIssue } from './env';
import { AppShell } from './components/AppShell';
import { ErrorScreen } from './components/ErrorScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { useAuth } from './state/AuthContext';
import { AnnouncePage } from './pages/AnnouncePage';
import { AuthEntryPage } from './pages/AuthEntryPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { BookingCheckoutPage } from './pages/BookingCheckoutPage';
import { BookingsPage } from './pages/BookingsPage';
import { ChatPage } from './pages/ChatPage';
import { EditPropertyPage } from './pages/EditPropertyPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { ProfilePage } from './pages/ProfilePage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { SignUpPage } from './pages/SignUpPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { ready, session } = useAuth();

  if (!ready) {
    return <LoadingScreen message="Validando sessao..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function AppRouter() {
  if (envIssue) {
    return <ErrorScreen title="Configurar ambiente" message={envIssue} />;
  }

  return (
    <Routes>
      <Route path="/" element={<AuthEntryPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="announce" element={<AnnouncePage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/:conversationId" element={<ChatPage />} />
        <Route path="checkout" element={<BookingCheckoutPage />} />
        <Route path="checkout/:bookingId" element={<BookingCheckoutPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="property/:id" element={<PropertyDetailPage />} />
        <Route path="edit-property/:id" element={<EditPropertyPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

