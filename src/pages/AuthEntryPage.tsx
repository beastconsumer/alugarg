import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function AuthEntryPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/app/home" replace />;
  }

  return (
    <main className="auth-hero" style={{ backgroundImage: "url('/background.png')" }}>
      <div className="overlay" />
      <section className="auth-card glass">
        <img src="/logoapp.png" alt="Aluga Aluga" className="auth-logo" />
        <h1>Aluga Aluga</h1>
        <p>Seu aluguel local no Cassino com reserva e moderacao em tempo real.</p>

        <div className="stack gap-12">
          <button className="btn btn-primary" onClick={() => navigate('/signup')}>
            Criar conta
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/login')}>
            Ja tenho conta
          </button>
        </div>
      </section>
    </main>
  );
}

