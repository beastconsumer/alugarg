import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Booking, parseBooking } from '../lib/types';

export function BookingsPage() {
  const { user } = useAuth();

  const [renterBookings, setRenterBookings] = useState<Booking[]>([]);
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const [renterRes, ownerRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .eq('renter_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (renterRes.error) {
        throw renterRes.error;
      }

      if (ownerRes.error) {
        throw ownerRes.error;
      }

      setRenterBookings((renterRes.data ?? []).map((row) => parseBooking(row)));
      setOwnerBookings((ownerRes.data ?? []).map((row) => parseBooking(row)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const updateStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (error) {
        throw error;
      }

      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar status');
    }
  };

  return (
    <main className="screen content-page">
      <header className="page-header">
        <h1>Reservas</h1>
      </header>

      {loading && <p className="muted">Carregando reservas...</p>}
      {errorMessage && <p className="alert error">{errorMessage}</p>}

      <section className="card stack gap-12">
        <h2>Minhas reservas (inquilino)</h2>

        {renterBookings.length === 0 && <p className="muted">Sem reservas no momento.</p>}

        {renterBookings.map((booking) => (
          <article key={booking.id} className="booking-card">
            <div>
              <h3>{booking.property_title}</h3>
              <p className="muted">
                {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
              </p>
              <p>Total pago: {formatMoney(booking.total_paid_by_renter)}</p>
              <p>Status: {booking.status}</p>
            </div>
            <div className="booking-actions">
              {booking.status === 'pending_payment' && (
                <button className="btn btn-primary small" onClick={() => void updateStatus(booking.id, 'confirmed')}>
                  Marcar pagamento
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="card stack gap-12">
        <h2>Reservas dos meus imoveis (proprietario)</h2>

        {ownerBookings.length === 0 && <p className="muted">Sem reservas nos seus imoveis.</p>}

        {ownerBookings.map((booking) => (
          <article key={booking.id} className="booking-card">
            <div>
              <h3>{booking.property_title}</h3>
              <p className="muted">
                {formatDate(booking.check_in_date)} ate {formatDate(booking.check_out_date)}
              </p>
              <p>Repasse previsto: {formatMoney(booking.owner_payout_amount)}</p>
              <p>Status: {booking.status}</p>
            </div>
            <div className="booking-actions">
              {booking.status === 'confirmed' && (
                <button className="btn btn-outline small" onClick={() => void updateStatus(booking.id, 'checked_in')}>
                  Check-in
                </button>
              )}
              {booking.status === 'checked_in' && (
                <button className="btn btn-primary small" onClick={() => void updateStatus(booking.id, 'checked_out')}>
                  Finalizar (check-out)
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

