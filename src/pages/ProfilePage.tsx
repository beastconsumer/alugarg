import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { supabase, uploadImageAndGetPublicUrl } from '../lib/supabase';
import {
  Booking,
  OwnerReview,
  Property,
  parseBooking,
  parseOwnerReview,
  parseProperty,
  statusLabel,
} from '../lib/types';

const reviewTags = [
  'Pontual',
  'Comunicacao boa',
  'Imovel limpo',
  'Confiavel',
  'Recomendo',
  'Check-in facil',
];

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [myProperties, setMyProperties] = useState<Property[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [reviewsGiven, setReviewsGiven] = useState<OwnerReview[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<OwnerReview[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTagsSelected, setReviewTagsSelected] = useState<string[]>([]);
  const [reviewBookingId, setReviewBookingId] = useState('');

  useEffect(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setCpf(profile?.cpf ?? '');
    setBirthDate(profile?.birth_date ?? '');
  }, [profile]);

  const loadData = async () => {
    if (!user) {
      return;
    }

    setLoadingData(true);
    setErrorMessage('');

    try {
      const [propertiesRes, bookingsRes, givenReviewsRes, receivedReviewsRes] = await Promise.all([
        supabase
          .from('properties')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('*')
          .eq('renter_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('owner_reviews')
          .select('*')
          .eq('renter_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('owner_reviews')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (propertiesRes.error) {
        throw propertiesRes.error;
      }

      if (bookingsRes.error) {
        throw bookingsRes.error;
      }

      if (givenReviewsRes.error) {
        throw givenReviewsRes.error;
      }

      if (receivedReviewsRes.error) {
        throw receivedReviewsRes.error;
      }

      setMyProperties((propertiesRes.data ?? []).map((row) => parseProperty(row)));
      setMyBookings((bookingsRes.data ?? []).map((row) => parseBooking(row)));
      setReviewsGiven((givenReviewsRes.data ?? []).map((row) => parseOwnerReview(row)));
      setReceivedReviews((receivedReviewsRes.data ?? []).map((row) => parseOwnerReview(row)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar perfil');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const pendingReviewBookings = useMemo(() => {
    const reviewedBookingIds = new Set(reviewsGiven.map((review) => review.booking_id));
    return myBookings.filter(
      (booking) => booking.status === 'checked_out' && !reviewedBookingIds.has(booking.id),
    );
  }, [myBookings, reviewsGiven]);

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    setSavingProfile(true);
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          phone: phone.trim(),
          cpf: cpf.trim(),
          birth_date: birthDate || null,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao salvar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatarSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setAvatarUploading(true);
    setErrorMessage('');

    try {
      const path = `${user.id}/avatar/${Date.now()}.jpg`;
      const url = await uploadImageAndGetPublicUrl(file, path);

      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (error) {
        throw error;
      }

      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao subir avatar');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const toggleTag = (tag: string) => {
    setReviewTagsSelected((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !reviewBookingId) {
      return;
    }

    const booking = myBookings.find((item) => item.id === reviewBookingId);
    if (!booking) {
      setErrorMessage('Reserva invalida para avaliacao.');
      return;
    }

    try {
      const { error } = await supabase.from('owner_reviews').insert({
        booking_id: booking.id,
        property_id: booking.property_id,
        renter_id: user.id,
        owner_id: booking.owner_id,
        rating: reviewRating,
        tags: reviewTagsSelected,
        comment: reviewComment.trim(),
      });

      if (error) {
        throw error;
      }

      setReviewBookingId('');
      setReviewComment('');
      setReviewTagsSelected([]);
      setReviewRating(5);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar avaliacao');
    }
  };

  return (
    <main className="screen content-page">
      <header className="page-header">
        <h1>Perfil</h1>
      </header>

      {errorMessage && <p className="alert error">{errorMessage}</p>}

      <section className="card stack gap-12">
        <div className="profile-top">
          <img
            className="avatar"
            src={profile?.avatar_url || '/logoapp.png'}
            alt={profile?.name || 'Avatar do usuario'}
          />

          <label className="btn btn-outline small" aria-label="Subir avatar">
            <Upload size={14} /> {avatarUploading ? 'Enviando...' : 'Alterar foto'}
            <input type="file" accept="image/*" onChange={onAvatarSelected} hidden />
          </label>
        </div>

        <form className="stack gap-12" onSubmit={onSaveProfile}>
          <label className="field">
            <span>Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Telefone</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <label className="field">
            <span>CPF</span>
            <input value={cpf} onChange={(event) => setCpf(event.target.value)} />
          </label>
          <label className="field">
            <span>Email (login)</span>
            <input value={profile?.email || ''} readOnly />
          </label>
          <label className="field">
            <span>Data nascimento (YYYY-MM-DD)</span>
            <input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
          </label>

          <button className="btn btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>

        {profile?.role === 'admin' && (
          <a className="btn btn-outline" href="/admin.html" target="_blank" rel="noreferrer">
            Abrir painel admin web
          </a>
        )}

        <button className="btn btn-danger" onClick={() => void signOut()}>
          Sair
        </button>
      </section>

      <section className="card stack gap-12">
        <h2>Meus anuncios</h2>

        {loadingData && <p className="muted">Carregando...</p>}

        {myProperties.map((property) => (
          <article key={property.id} className="listing-row">
            <div>
              <h3>{property.title}</h3>
              <p className="muted">{property.location.addressText || 'Sem endereco'}</p>
              <p>
                {formatMoney(property.price)} - {statusLabel[property.status]}
              </p>
            </div>

            <div className="inline-grid two">
              <Link className="btn btn-outline small" to={`/app/property/${property.id}`}>
                Ver
              </Link>
              <Link className="btn btn-primary small" to={`/app/edit-property/${property.id}`}>
                Editar
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="card stack gap-12">
        <h2>Casas alugadas por voce</h2>

        {myBookings.length === 0 && <p className="muted">Nenhuma reserva ainda.</p>}

        {myBookings.map((booking) => (
          <article key={booking.id} className="booking-card">
            <div>
              <h3>{booking.property_title}</h3>
              <p className="muted">
                {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
              </p>
              <p>Total: {formatMoney(booking.total_paid_by_renter)}</p>
              <p>Status: {booking.status}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="card stack gap-12">
        <h2>Avaliar proprietario (apos check-out)</h2>

        {pendingReviewBookings.length === 0 && (
          <p className="muted">Sem locacoes finalizadas pendentes de avaliacao.</p>
        )}

        {pendingReviewBookings.length > 0 && (
          <form className="stack gap-12" onSubmit={submitReview}>
            <label className="field">
              <span>Reserva</span>
              <select value={reviewBookingId} onChange={(event) => setReviewBookingId(event.target.value)} required>
                <option value="">Selecione</option>
                {pendingReviewBookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.property_title} - {formatDate(booking.check_out_date)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Nota (1 a 5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={reviewRating}
                onChange={(event) => setReviewRating(Number(event.target.value))}
              />
            </label>

            <div className="chips-row">
              {reviewTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`chip-action ${reviewTagsSelected.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <label className="field">
              <span>Comentario</span>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={3}
              />
            </label>

            <button className="btn btn-primary" type="submit">
              Enviar avaliacao
            </button>
          </form>
        )}
      </section>

      <section className="card stack gap-12">
        <h2>Tags e avaliacoes recebidas como proprietario</h2>

        {receivedReviews.length === 0 && <p className="muted">Nenhuma avaliacao recebida ainda.</p>}

        {receivedReviews.map((review) => (
          <article key={review.id} className="booking-card">
            <div>
              <p>Nota: {review.rating}/5</p>
              <p className="muted">{review.comment || 'Sem comentario'}</p>
              <div className="chips-row">
                {review.tags.map((tag) => (
                  <span key={tag} className="chip chip-soft">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

