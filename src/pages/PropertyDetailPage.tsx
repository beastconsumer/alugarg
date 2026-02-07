import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Navigation, ShieldCheck } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { calculateUnits, formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import { parseProfile, parseProperty, Property, UserProfile } from '../lib/types';

export function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) {
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Imovel nao encontrado.');
        }

        const parsedProperty = parseProperty(data);
        setProperty(parsedProperty);

        const { data: ownerData } = await supabase
          .from('users')
          .select('*')
          .eq('id', parsedProperty.owner_id)
          .maybeSingle();

        if (ownerData) {
          setOwner(parseProfile(ownerData));
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar detalhe');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [id]);

  const units = useMemo(() => {
    if (!property) {
      return 0;
    }
    return calculateUnits(property.rent_type, checkInDate, checkOutDate);
  }, [checkInDate, checkOutDate, property]);

  const amounts = useMemo(() => {
    if (!property || units <= 0) {
      return {
        base: 0,
        clientFee: 0,
        ownerFee: 0,
        totalPaid: 0,
        ownerPayout: 0,
      };
    }

    const base = property.price * units;
    const clientFee = Math.round(base * 0.1);
    const ownerFee = Math.round(base * 0.04);

    return {
      base,
      clientFee,
      ownerFee,
      totalPaid: base + clientFee,
      ownerPayout: base - ownerFee,
    };
  }, [property, units]);

  const onCreateBooking = async (event: FormEvent) => {
    event.preventDefault();

    if (!property || !user) {
      setBookingError('Faca login para reservar.');
      return;
    }

    if (units <= 0) {
      setBookingError('Escolha um periodo valido.');
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    setBookingMessage('');

    try {
      const { error } = await supabase.from('bookings').insert({
        property_id: property.id,
        property_title: property.title,
        renter_id: user.id,
        owner_id: property.owner_id,
        check_in_date: new Date(`${checkInDate}T12:00:00`).toISOString(),
        check_out_date: new Date(`${checkOutDate}T12:00:00`).toISOString(),
        units,
        base_amount: amounts.base,
        client_fee_amount: amounts.clientFee,
        owner_fee_amount: amounts.ownerFee,
        total_paid_by_renter: amounts.totalPaid,
        owner_payout_amount: amounts.ownerPayout,
        status: 'pending_payment',
      });

      if (error) {
        throw error;
      }

      setBookingMessage('Reserva criada com sucesso. Veja em Reservas para acompanhar.');
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Falha ao reservar');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="screen content-page">
        <p className="muted">Carregando imovel...</p>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="screen content-page">
        <p className="alert error">{errorMessage || 'Imovel nao encontrado.'}</p>
      </main>
    );
  }

  const whatsappText = encodeURIComponent(
    `Ola! Vi seu anuncio no Aluga Aluga: ${property.title}. Ainda esta disponivel?`,
  );
  const ownerPhone = owner?.phone ?? '';
  const whatsappUrl = ownerPhone
    ? `https://wa.me/${ownerPhone.replace(/\D/g, '')}?text=${whatsappText}`
    : '';

  return (
    <main className="screen content-page">
      <button className="btn btn-outline small" onClick={() => navigate(-1)}>
        Voltar
      </button>

      <section className="card stack gap-16">
        <div className="detail-gallery">
          {(property.photos.length > 0 ? property.photos : ['/background.png']).map((photo, index) => (
            <img key={`${photo}-${index}`} src={photo} alt={`${property.title} ${index + 1}`} />
          ))}
        </div>

        <div className="stack gap-8">
          <h1>{property.title}</h1>
          <p className="muted">{property.location.addressText || 'Balneario Cassino'}</p>
          <h2>{formatMoney(property.price)}</h2>
        </div>

        <div className="chips-row">
          <span className="chip chip-soft">{property.rent_type}</span>
          {property.pet_friendly && <span className="chip chip-soft">Pet friendly</span>}
          {property.verified && (
            <span className="chip chip-verified">
              <ShieldCheck size={14} /> Verificado
            </span>
          )}
        </div>

        <p>{property.description}</p>

        <div className="property-meta">
          <span>{property.bedrooms} quartos</span>
          <span>{property.bathrooms} banheiros</span>
          <span>{property.garage_spots} vagas</span>
        </div>

        <div className="inline-grid two">
          {whatsappUrl ? (
            <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Chamar no WhatsApp
            </a>
          ) : (
            <button className="btn btn-outline" disabled>
              WhatsApp indisponivel
            </button>
          )}

          <a
            className="btn btn-outline"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              property.location.addressText || property.title,
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={16} /> Ver no mapa
          </a>
        </div>
      </section>

      <section className="card stack gap-12">
        <h2>Reservar / Alugar</h2>
        <p className="muted">Taxas: cliente 10% sobre total, proprietario 4% descontado no repasse.</p>

        <form className="stack gap-12" onSubmit={onCreateBooking}>
          <div className="inline-grid two">
            <label className="field">
              <span>Check-in</span>
              <input
                type="date"
                value={checkInDate}
                onChange={(event) => setCheckInDate(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Check-out</span>
              <input
                type="date"
                value={checkOutDate}
                onChange={(event) => setCheckOutDate(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="cost-card">
            <p>Unidades cobradas: {units}</p>
            <p>Base: {formatMoney(amounts.base)}</p>
            <p>Taxa cliente (10%): {formatMoney(amounts.clientFee)}</p>
            <p>Total cliente: {formatMoney(amounts.totalPaid)}</p>
            <p>Repasse proprietario (ja c/ taxa 4%): {formatMoney(amounts.ownerPayout)}</p>
          </div>

          {bookingError && <p className="alert error">{bookingError}</p>}
          {bookingMessage && <p className="alert success">{bookingMessage}</p>}

          <button className="btn btn-primary" type="submit" disabled={bookingLoading}>
            {bookingLoading ? 'Processando...' : 'Confirmar reserva'}
          </button>
        </form>
      </section>
    </main>
  );
}

