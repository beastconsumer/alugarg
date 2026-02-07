import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import { Property, rentTypeLabel } from '../lib/types';

export function PropertyCard({ property }: { property: Property }) {
  const cover = property.photos[0] || '/background.png';

  return (
    <article className="property-card">
      <Link to={`/app/property/${property.id}`} className="property-cover-wrap">
        <img className="property-cover" src={cover} alt={property.title} />
        <div className="property-badges">
          <span className="chip chip-soft">{rentTypeLabel[property.rent_type]}</span>
          {property.verified && <span className="chip chip-verified">Verificado</span>}
        </div>
        <div className="price-pill">{formatMoney(property.price)}</div>
      </Link>

      <div className="property-content">
        <h3>{property.title}</h3>
        <p className="muted text-truncate">{property.location.addressText || 'Balneario Cassino'}</p>

        <div className="property-meta">
          <span>{property.bedrooms} qts</span>
          <span>{property.bathrooms} banh</span>
          <span>{property.garage_spots} vaga</span>
          {property.pet_friendly && <span>Pet</span>}
        </div>

        <Link className="btn btn-primary full" to={`/app/property/${property.id}`}>
          Ver detalhes
        </Link>
      </div>
    </article>
  );
}

