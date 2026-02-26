import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Anchor, Button, PasswordInput, TextInput } from '@mantine/core';
import { AlertCircle, ArrowLeft, Lock, Mail, Phone, Send } from 'lucide-react';
import { normalizePhone } from '../lib/phone';
import { supabase } from '../lib/supabase';

// Logo SVG component
function AlugaSulLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#3b82f6" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Background circle */}
      <circle cx="60" cy="60" r="56" fill="url(#logoGradient)" filter="url(#logoShadow)" />
      {/* House roof */}
      <path
        d="M60 28L30 52V54H90V52L60 28Z"
        fill="white"
        opacity="0.95"
      />
      {/* House body */}
      <rect x="38" y="54" width="44" height="32" rx="2" fill="white" opacity="0.95" />
      {/* Door */}
      <rect x="52" y="64" width="16" height="22" rx="2" fill="url(#logoGradient)" opacity="0.8" />
      {/* Window left */}
      <rect x="42" y="60" width="8" height="8" rx="1" fill="url(#logoGradient)" opacity="0.6" />
      {/* Window right */}
      <rect x="70" y="60" width="8" height="8" rx="1" fill="url(#logoGradient)" opacity="0.6" />
      {/* Wave decoration */}
      <path
        d="M25 92C35 88 45 96 60 92C75 88 85 96 95 92"
        stroke="url(#waveGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage] = useState(((location.state as { notice?: string } | null)?.notice ?? '').toString());

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const isPhone = useMemo(() => /\d{8,}/.test(identifier.replace(/\D/g, '')), [identifier]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!identifier.trim()) {
      setErrorMessage('Informe seu email ou telefone.');
      return;
    }
    if (!password) {
      setErrorMessage('Informe sua senha.');
      return;
    }

    setLoading(true);

    try {
      let email = identifier.trim().toLowerCase();

      if (isPhone && !identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email_by_phone', {
          p_phone: normalizePhone(identifier),
        });

        if (error) throw error;
        if (!data) throw new Error('Telefone nao encontrado. Cadastre-se primeiro.');
        email = String(data);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      navigate('/app/home', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  };

  const onForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotError('');

    if (!forgotEmail.trim()) {
      setForgotError('Informe seu email de cadastro.');
      return;
    }

    setForgotLoading(true);

    try {
      const configuredPublicUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ?? '';
      const redirectBase = (configuredPublicUrl || window.location.origin).replace(/\/$/, '');

      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        redirectTo: `${redirectBase}/auth/callback`,
      });

      if (error) throw error;
      setForgotSent(true);
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : 'Falha ao enviar email');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      <div className="login-container">
        {/* Logo & Brand */}
        <div className="login-brand">
          <div className="login-logo-wrapper">
            <AlugaSulLogo size={88} />
          </div>
          <h1 className="login-brand-name">AlugaSul</h1>
          <p className="login-brand-tagline">Aluguel de temporada no Sul do Brasil</p>
        </div>

        {/* Card */}
        <div className="login-card">
          {forgotMode ? (
            /* ── Forgot password panel ── */
            <div className="login-form-wrapper">
              <button
                type="button"
                className="login-back-btn"
                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(''); }}
              >
                <ArrowLeft size={16} />
                <span>Voltar ao login</span>
              </button>

              <div className="login-header">
                <h2>Redefinir senha</h2>
                <p>Informe o email da sua conta e enviaremos um link para redefinir sua senha.</p>
              </div>

              {forgotSent ? (
                <Alert color="teal" variant="light" radius="lg" className="login-alert-success">
                  Email enviado! Verifique sua caixa de entrada e siga as instrucoes.
                </Alert>
              ) : (
                <form onSubmit={onForgotSubmit} className="login-form">
                  <div className="login-input-group">
                    <label>Email de cadastro</label>
                    <TextInput
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.currentTarget.value)}
                      leftSection={<Mail size={18} />}
                      size="lg"
                      radius="xl"
                      classNames={{ input: 'login-input' }}
                      required
                    />
                  </div>

                  {forgotError && (
                    <Alert color="red" variant="light" icon={<AlertCircle size={16} />} radius="lg">
                      {forgotError}
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    loading={forgotLoading}
                    leftSection={<Send size={18} />}
                    fullWidth
                    size="lg"
                    radius="xl"
                    className="login-submit-btn"
                  >
                    Enviar link
                  </Button>
                </form>
              )}
            </div>
          ) : (
            /* ── Login form ── */
            <div className="login-form-wrapper">
              <div className="login-header">
                <h2>Bem-vindo de volta</h2>
                <p>Entre na sua conta para continuar</p>
              </div>

              <form onSubmit={onSubmit} className="login-form">
                <div className="login-input-group">
                  <label>Email ou telefone</label>
                  <TextInput
                    placeholder="seu@email.com"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.currentTarget.value)}
                    leftSection={isPhone ? <Phone size={18} /> : <Mail size={18} />}
                    size="lg"
                    radius="xl"
                    classNames={{ input: 'login-input' }}
                    required
                  />
                </div>

                <div className="login-input-group">
                  <div className="login-label-row">
                    <label>Senha</label>
                    <button
                      type="button"
                      className="login-forgot-link"
                      onClick={() => { setForgotMode(true); setForgotEmail(identifier.includes('@') ? identifier : ''); }}
                    >
                      Esqueceu?
                    </button>
                  </div>
                  <PasswordInput
                    placeholder="Sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    leftSection={<Lock size={18} />}
                    size="lg"
                    radius="xl"
                    classNames={{ input: 'login-input' }}
                    required
                  />
                </div>

                {noticeMessage && (
                  <Alert color="green" variant="light" radius="lg">
                    {noticeMessage}
                  </Alert>
                )}

                {errorMessage && (
                  <Alert color="red" variant="light" icon={<AlertCircle size={16} />} radius="lg">
                    {errorMessage}
                  </Alert>
                )}

                <Button
                  type="submit"
                  loading={loading}
                  fullWidth
                  size="lg"
                  radius="xl"
                  className="login-submit-btn"
                >
                  Entrar
                </Button>
              </form>

              <div className="login-divider">
                <span>ou</span>
              </div>

              <div className="login-footer">
                <p>
                  Ainda nao tem conta?{' '}
                  <Anchor component={Link} to="/signup" className="login-signup-link">
                    Criar conta gratis
                  </Anchor>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Terms */}
        <p className="login-terms">
          Ao entrar, voce concorda com os{' '}
          <Anchor component={Link} to="/termos-de-uso">Termos</Anchor>
          {' '}e{' '}
          <Anchor component={Link} to="/politica-de-privacidade">Privacidade</Anchor>
        </p>
      </div>
    </div>
  );
}
