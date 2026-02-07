import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/phone';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState(
    ((location.state as { notice?: string } | null)?.notice ?? '').toString(),
  );

  const isPhone = useMemo(() => /\d{8,}/.test(identifier.replace(/\D/g, '')), [identifier]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');
    setLoading(true);

    try {
      let email = identifier.trim().toLowerCase();

      if (isPhone && !identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email_by_phone', {
          p_phone: normalizePhone(identifier),
        });

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Telefone nao encontrado. Cadastre-se primeiro.');
        }

        email = String(data);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      navigate('/app/home', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao entrar';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="screen auth-screen">
      <section className="card auth-form-card">
        <h1>Entrar</h1>
        <p className="muted">Use email ou telefone + senha.</p>

        <form className="stack gap-12" onSubmit={onSubmit}>
          <label className="field">
            <span>Email ou telefone</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="email@dominio.com ou +5553..."
              required
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Sua senha"
              required
            />
          </label>

          {noticeMessage && <p className="alert success">{noticeMessage}</p>}
          {errorMessage && <p className="alert error">{errorMessage}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="muted">
          Nao tem conta? <Link to="/signup">Criar conta</Link>
        </p>
      </section>
    </main>
  );
}

