import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ExternalLink, LocateFixed } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { parseProperty, Property } from '../lib/types';

const toRad = (v: number) => (v * Math.PI) / 180;

const distanceInKm = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number => {
  const earthRadius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export function MapPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [originLat, setOriginLat] = useState<string>('');
  const [originLng, setOriginLng] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setProperties((data ?? []).map((row) => parseProperty(row)));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar mapa');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const onGetCurrentPosition = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocalizacao nao suportada no navegador.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOriginLat(String(position.coords.latitude));
        setOriginLng(String(position.coords.longitude));
      },
      () => {
        setErrorMessage('Nao foi possivel ler a localizacao atual.');
      },
    );
  };

  const originCoordinates = useMemo(() => {
    const lat = Number(originLat);
    const lng = Number(originLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  }, [originLat, originLng]);

  const items = useMemo(() => {
    return properties
      .filter((property) => {
        const text = [property.title, property.location.addressText].join(' ').toLowerCase();
        return text.includes(searchAddress.toLowerCase());
      })
      .map((property) => {
        let distance: number | null = null;

        if (
          originCoordinates &&
          property.location.lat !== null &&
          property.location.lng !== null
        ) {
          distance = distanceInKm(
            originCoordinates.lat,
            originCoordinates.lng,
            property.location.lat,
            property.location.lng,
          );
        }

        return { property, distance };
      })
      .sort((a, b) => {
        if (a.distance === null && b.distance === null) {
          return 0;
        }
        if (a.distance === null) {
          return 1;
        }
        if (b.distance === null) {
          return -1;
        }
        return a.distance - b.distance;
      });
  }, [originCoordinates, properties, searchAddress]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
  };

  return (
    <main className="screen content-page">
      <header className="page-header">
        <div>
          <h1>Mapa e proximidade</h1>
          <p className="muted">Sem API paga: usamos lista inteligente + Google Maps externo.</p>
        </div>
      </header>

      <section className="card stack gap-12">
        <form className="stack gap-12" onSubmit={onSubmit}>
          <label className="field">
            <span>Buscar endereco</span>
            <input
              value={searchAddress}
              onChange={(event) => setSearchAddress(event.target.value)}
              placeholder="Ex: Avenida Atlantica"
            />
          </label>

          <div className="inline-grid two">
            <label className="field">
              <span>Latitude origem</span>
              <input value={originLat} onChange={(event) => setOriginLat(event.target.value)} />
            </label>
            <label className="field">
              <span>Longitude origem</span>
              <input value={originLng} onChange={(event) => setOriginLng(event.target.value)} />
            </label>
          </div>

          <button className="btn btn-outline" type="button" onClick={onGetCurrentPosition}>
            <LocateFixed size={16} /> Usar minha localizacao
          </button>
        </form>
      </section>

      {loading && <p className="muted">Carregando...</p>}
      {errorMessage && <p className="alert error">{errorMessage}</p>}

      <section className="stack gap-12">
        {items.map(({ property, distance }) => (
          <article key={property.id} className="card listing-row">
            <div>
              <h3>{property.title}</h3>
              <p className="muted">{property.location.addressText || 'Endereco nao informado'}</p>
              <p>
                {formatMoney(property.price)} - {property.rent_type}
              </p>
              {distance !== null && <p className="muted">{distance.toFixed(1)} km de voce</p>}
            </div>
            <a
              className="btn btn-outline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                property.location.addressText || property.title,
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Abrir no Google Maps
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}

