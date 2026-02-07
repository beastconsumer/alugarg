import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/phone';
import { formatDate, formatMoney } from '../lib/format';
import { parseProperty, parseProfile, Property, UserProfile } from '../lib/types';

interface AdminItem {
  property: Property;
  owner: UserProfile | null;
}

export function AdminPage() {
  const [ready, setReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [items, setItems] = useState<AdminItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadAdminState = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id || '';
    setSessionUserId(userId);

    if (!userId) {
      setIsAdmin(false);
      setReady(true);
      return;
    }

    const { data: profileRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const role = String(profileRow?.role ?? 'user');
    setIsAdmin(role === 'admin');
    setReady(true);
  };

  const loadPendingProperties = async () => {
    setLoadingData(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const parsed = (data ?? []).map((row) => parseProperty(row));
      const ownerIds = Array.from(new Set(parsed.map((item) => item.owner_id)));

      let ownerMap = new Map<string, UserProfile>();
      if (ownerIds.length > 0) {
        const { data: ownerRows, error: ownerError } = await supabase
          .from('users')
          .select('*')
          .in('id', ownerIds);

        if (ownerError) {
          throw ownerError;
        }

        ownerMap = new Map(
          (ownerRows ?? []).map((row) => {
            const profile = parseProfile(row);
            return [profile.id, profile];
          }),
        );
      }

      setItems(
        parsed.map((property) => ({
          property,
          owner: ownerMap.get(property.owner_id) ?? null,
        })),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar painel admin');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void loadAdminState();
  }, []);

  useEffect(() => {
    if (!ready || !isAdmin) {
      return;
    }

    void loadPendingProperties();

    const channel = supabase
      .channel('admin-properties-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          void loadPendingProperties();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, isAdmin]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.property.status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 },
    );
  }, [items]);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();

    setLoginLoading(true);
    setErrorMessage('');

    try {
      let email = identifier.trim().toLowerCase();
      if (!email.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email_by_phone', {
          p_phone: normalizePhone(identifier),
        });

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Telefone nao encontrado.');
        }

        email = String(data);
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        throw loginError;
      }

      await loadAdminState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha no login admin');
    } finally {
      setLoginLoading(false);
    }
  };

  const updateStatus = async (
    propertyId: string,
    status: 'pending' | 'approved' | 'rejected',
    verified?: boolean,
  ) => {
    try {
      const payload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (typeof verified === 'boolean') {
        payload.verified = verified;
      }

      const { error } = await supabase.from('properties').update(payload).eq('id', propertyId);
      if (error) {
        throw error;
      }

      await loadPendingProperties();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao atualizar status');
    }
  };

  if (!ready) {
    return (
      <main className="screen center-screen">
        <p className="muted">Inicializando painel...</p>
      </main>
    );
  }

  if (!sessionUserId) {
    return (
      <main className="screen center-screen admin-bg">
        <section className="card admin-login-card stack gap-12">
          <div>
            <h1>Aluga Aluga Admin</h1>
            <p className="muted">Site independente para moderacao e aprovacao de anuncios.</p>
          </div>

          <form className="stack gap-12" onSubmit={onLogin}>
            <label className="field">
              <span>Email ou telefone admin</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="+5553999005952"
                required
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
              />
            </label>

            {errorMessage && <p className="alert error">{errorMessage}</p>}

            <button className="btn btn-primary" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="screen center-screen admin-bg">
        <section className="card admin-login-card stack gap-12">
          <h1>Acesso negado</h1>
          <p className="alert error">
            Este usuario nao tem permissao de admin. Promova o role para `admin` no Supabase.
          </p>
          <button
            className="btn btn-outline"
            onClick={() =>
              void supabase.auth.signOut().then(() => {
                setSessionUserId('');
                setIsAdmin(false);
              })
            }
          >
            Limpar sessao atual
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="screen content-page admin-bg">
      <header className="page-header">
        <div>
          <h1>Admin Aluga Aluga</h1>
          <p className="muted">Atualizacao em tempo real de anuncios</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() =>
            void supabase.auth.signOut().then(() => {
              setSessionUserId('');
              setIsAdmin(false);
            })
          }
        >
          Sair
        </button>
      </header>

      <section className="inline-grid three">
        <article className="card stat-card">
          <h3>Pendentes</h3>
          <strong>{summary.pending}</strong>
        </article>
        <article className="card stat-card">
          <h3>Aprovados</h3>
          <strong>{summary.approved}</strong>
        </article>
        <article className="card stat-card">
          <h3>Rejeitados</h3>
          <strong>{summary.rejected}</strong>
        </article>
      </section>

      {loadingData && <p className="muted">Carregando anuncios...</p>}
      {errorMessage && <p className="alert error">{errorMessage}</p>}

      <section className="stack gap-12">
        {items.map(({ property, owner }) => (
          <article key={property.id} className="card stack gap-12">
            <div className="inline-grid two align-start">
              <div>
                <h2>{property.title}</h2>
                <p className="muted">{property.location.addressText || 'Sem endereco'}</p>
                <p>
                  {formatMoney(property.price)} - {property.rent_type}
                </p>
                <p className="muted">
                  Status: <strong>{property.status}</strong> • Criado em {formatDate(property.created_at)}
                </p>
                <p className="muted">Proprietario: {owner?.name || 'Sem nome'} ({owner?.phone || '-'})</p>
              </div>

              <div className="photo-grid mini">
                {property.photos.slice(0, 3).map((photo) => (
                  <img key={photo} src={photo} alt={property.title} />
                ))}
              </div>
            </div>

            <div className="chips-row">
              {property.verified ? (
                <span className="chip chip-verified">
                  <ShieldCheck size={14} /> Verificado
                </span>
              ) : (
                <span className="chip chip-soft">Nao verificado</span>
              )}
            </div>

            <div className="inline-grid four">
              <button className="btn btn-primary small" onClick={() => void updateStatus(property.id, 'approved')}>
                Aprovar
              </button>
              <button className="btn btn-danger small" onClick={() => void updateStatus(property.id, 'rejected')}>
                Rejeitar
              </button>
              <button
                className="btn btn-outline small"
                onClick={() => void updateStatus(property.id, property.status, !property.verified)}
              >
                {property.verified ? 'Remover selo' : 'Marcar verificado'}
              </button>
              <button className="btn btn-outline small" onClick={() => void updateStatus(property.id, 'pending')}>
                Voltar para pendente
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

