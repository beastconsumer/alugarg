import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseBirthDateText } from '../lib/format';
import { toE164Like } from '../lib/phone';
import { supabase } from '../lib/supabase';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [birthDateText, setBirthDateText] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const birthDate = parseBirthDateText(birthDateText);
    if (!birthDate) {
      setErrorMessage('Data invalida. Use formato DD/MM/AAAA.');
      return;
    }

    if (!strongPasswordRegex.test(password)) {
      setErrorMessage('Senha fraca. Use 8+ caracteres, maiuscula, minuscula, numero e simbolo.');
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = toE164Like(phone);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            phone: normalizedPhone,
            cpf: cpf.trim(),
            birth_date: birthDate,
          },
        },
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id;
      if (!userId) {
        throw new Error('Nao foi possivel criar a conta.');
      }

      if (data.session) {
        const { error: profileError } = await supabase.from('users').upsert({
          id: userId,
          name: name.trim(),
          phone: normalizedPhone,
          cpf: cpf.trim(),
          email: email.trim().toLowerCase(),
          birth_date: birthDate,
        });

        if (profileError) {
          throw profileError;
        }

        navigate('/app/home', { replace: true });
        return;
      }

      setSuccessMessage(
        'Conta criada. Se a confirmacao de email estiver ativa no Supabase, confirme seu email e depois entre.',
      );
      navigate('/login', {
        replace: true,
        state: {
          notice:
            'Conta criada. Se seu projeto exige confirmacao de email, confirme primeiro e depois faca login.',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar conta';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="screen auth-screen">
      <section className="card auth-form-card">
        <h1>Criar conta</h1>
        <p className="muted">Preencha seus dados para acessar o app.</p>

        <form className="stack gap-12" onSubmit={onSubmit}>
          <label className="field">
            <span>Nome completo</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>

          <label className="field">
            <span>Telefone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+5553999005952"
              required
            />
          </label>

          <label className="field">
            <span>CPF</span>
            <input value={cpf} onChange={(event) => setCpf(event.target.value)} required />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>

          <label className="field">
            <span>Data de nascimento (DD/MM/AAAA)</span>
            <input
              value={birthDateText}
              onChange={(event) => setBirthDateText(event.target.value)}
              placeholder="31/12/1990"
              required
            />
          </label>

          <label className="field">
            <span>Senha forte</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Min 8 com A-z, 0-9 e simbolo"
              required
            />
          </label>

          {errorMessage && <p className="alert error">{errorMessage}</p>}
          {successMessage && <p className="alert success">{successMessage}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="muted">
          Ja tem conta? <Link to="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}

