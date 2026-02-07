import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { PropertyCard } from '../components/PropertyCard';
import { supabase } from '../lib/supabase';
import { parseProperty, Property, RentType } from '../lib/types';

export function HomePage() {
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [rentType, setRentType] = useState<'' | RentType>('');
  const [petFriendly, setPetFriendly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [bedrooms, setBedrooms] = useState(0);

  const loadApprovedProperties = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(120);

      if (error) {
        throw error;
      }

      setAllProperties((data ?? []).map((row) => parseProperty(row)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar feed';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApprovedProperties();

    const channel = supabase
      .channel('home-approved-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          void loadApprovedProperties();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return allProperties.filter((property) => {
      if (rentType && property.rent_type !== rentType) {
        return false;
      }
      if (petFriendly && !property.pet_friendly) {
        return false;
      }
      if (property.price > maxPrice) {
        return false;
      }
      if (bedrooms > 0 && property.bedrooms < bedrooms) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchable = [property.title, property.description, property.location.addressText]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [allProperties, bedrooms, maxPrice, petFriendly, rentType, search]);

  const onResetFilters = (event: FormEvent) => {
    event.preventDefault();
    setSearch('');
    setRentType('');
    setPetFriendly(false);
    setMaxPrice(10000);
    setBedrooms(0);
  };

  return (
    <main className="screen content-page">
      <header className="page-header">
        <div>
          <h1>Aluga Aluga</h1>
          <p className="muted">Balneario Cassino • Rio Grande</p>
        </div>
        <button className="btn btn-icon" onClick={() => void loadApprovedProperties()} title="Atualizar">
          <RotateCcw size={18} />
        </button>
      </header>

      <section className="card filters-card">
        <label className="field">
          <span>Buscar por rua, bairro ou ponto</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex: Cassino, Avenida Atlantica"
          />
        </label>

        <div className="chips-row">
          <button
            className={`chip-action ${rentType === 'mensal' ? 'active' : ''}`}
            onClick={() => setRentType((value) => (value === 'mensal' ? '' : 'mensal'))}
          >
            Mensal
          </button>
          <button
            className={`chip-action ${rentType === 'temporada' ? 'active' : ''}`}
            onClick={() => setRentType((value) => (value === 'temporada' ? '' : 'temporada'))}
          >
            Temporada
          </button>
          <button
            className={`chip-action ${rentType === 'diaria' ? 'active' : ''}`}
            onClick={() => setRentType((value) => (value === 'diaria' ? '' : 'diaria'))}
          >
            Diaria
          </button>
          <button
            className={`chip-action ${petFriendly ? 'active' : ''}`}
            onClick={() => setPetFriendly((value) => !value)}
          >
            Pet
          </button>
        </div>

        <div className="range-group">
          <label>
            <span>Ate R$ {maxPrice.toLocaleString('pt-BR')}</span>
            <input
              type="range"
              min={500}
              max={30000}
              step={500}
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </label>

          <label>
            <span>Quartos minimos: {bedrooms}</span>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={bedrooms}
              onChange={(event) => setBedrooms(Number(event.target.value))}
            />
          </label>
        </div>

        <button className="btn btn-outline" onClick={onResetFilters}>
          Limpar filtros
        </button>
      </section>

      {loading && <p className="muted">Carregando propriedades...</p>}
      {errorMessage && <p className="alert error">{errorMessage}</p>}

      {!loading && !errorMessage && (
        <section className="property-grid">
          {filteredProperties.length === 0 && (
            <div className="card">
              <p className="muted">Nenhum imovel com esses filtros.</p>
            </div>
          )}

          {filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </section>
      )}
    </main>
  );
}

