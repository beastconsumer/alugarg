export type RentType = 'mensal' | 'temporada' | 'diaria';
export type PropertyStatus = 'pending' | 'approved' | 'rejected';
export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

export interface PropertyLocation {
  lat: number | null;
  lng: number | null;
  addressText: string;
}

export interface Property {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  price: number;
  rent_type: RentType;
  bedrooms: number;
  bathrooms: number;
  garage_spots: number;
  pet_friendly: boolean;
  verified: boolean;
  status: PropertyStatus;
  photos: string[];
  location: PropertyLocation;
  created_at: string;
  updated_at: string;
  views_count: number;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  avatar_url: string;
  cpf: string;
  email: string;
  birth_date: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Booking {
  id: string;
  property_id: string;
  property_title: string;
  renter_id: string;
  owner_id: string;
  check_in_date: string;
  check_out_date: string;
  units: number;
  base_amount: number;
  client_fee_amount: number;
  owner_fee_amount: number;
  total_paid_by_renter: number;
  owner_payout_amount: number;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface OwnerReview {
  id: string;
  booking_id: string;
  property_id: string;
  renter_id: string;
  owner_id: string;
  rating: number;
  tags: string[];
  comment: string;
  created_at: string;
}

export const rentTypeLabel: Record<RentType, string> = {
  mensal: 'Mensal',
  temporada: 'Temporada',
  diaria: 'Diaria',
};

export const statusLabel: Record<PropertyStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export const parseLocation = (raw: unknown): PropertyLocation => {
  if (!raw || typeof raw !== 'object') {
    return { lat: null, lng: null, addressText: '' };
  }

  const value = raw as Record<string, unknown>;

  return {
    lat: typeof value.lat === 'number' ? value.lat : null,
    lng: typeof value.lng === 'number' ? value.lng : null,
    addressText: typeof value.addressText === 'string' ? value.addressText : '',
  };
};

export const parseProperty = (raw: Record<string, unknown>): Property => ({
  id: String(raw.id ?? ''),
  owner_id: String(raw.owner_id ?? ''),
  title: String(raw.title ?? ''),
  description: String(raw.description ?? ''),
  price: Number(raw.price ?? 0),
  rent_type: (String(raw.rent_type ?? 'mensal') as RentType),
  bedrooms: Number(raw.bedrooms ?? 0),
  bathrooms: Number(raw.bathrooms ?? 0),
  garage_spots: Number(raw.garage_spots ?? 0),
  pet_friendly: Boolean(raw.pet_friendly ?? false),
  verified: Boolean(raw.verified ?? false),
  status: (String(raw.status ?? 'pending') as PropertyStatus),
  photos: Array.isArray(raw.photos) ? raw.photos.map((item) => String(item)) : [],
  location: parseLocation(raw.location),
  created_at: String(raw.created_at ?? ''),
  updated_at: String(raw.updated_at ?? ''),
  views_count: Number(raw.views_count ?? 0),
});

export const parseProfile = (raw: Record<string, unknown>): UserProfile => ({
  id: String(raw.id ?? ''),
  name: String(raw.name ?? ''),
  phone: String(raw.phone ?? ''),
  avatar_url: String(raw.avatar_url ?? ''),
  cpf: String(raw.cpf ?? ''),
  email: String(raw.email ?? ''),
  birth_date: raw.birth_date ? String(raw.birth_date) : null,
  role: (String(raw.role ?? 'user') as 'user' | 'admin'),
  created_at: String(raw.created_at ?? ''),
});

export const parseBooking = (raw: Record<string, unknown>): Booking => ({
  id: String(raw.id ?? ''),
  property_id: String(raw.property_id ?? ''),
  property_title: String(raw.property_title ?? ''),
  renter_id: String(raw.renter_id ?? ''),
  owner_id: String(raw.owner_id ?? ''),
  check_in_date: String(raw.check_in_date ?? ''),
  check_out_date: String(raw.check_out_date ?? ''),
  units: Number(raw.units ?? 0),
  base_amount: Number(raw.base_amount ?? 0),
  client_fee_amount: Number(raw.client_fee_amount ?? 0),
  owner_fee_amount: Number(raw.owner_fee_amount ?? 0),
  total_paid_by_renter: Number(raw.total_paid_by_renter ?? 0),
  owner_payout_amount: Number(raw.owner_payout_amount ?? 0),
  status: (String(raw.status ?? 'pending_payment') as BookingStatus),
  created_at: String(raw.created_at ?? ''),
  updated_at: String(raw.updated_at ?? ''),
});

export const parseOwnerReview = (raw: Record<string, unknown>): OwnerReview => ({
  id: String(raw.id ?? ''),
  booking_id: String(raw.booking_id ?? ''),
  property_id: String(raw.property_id ?? ''),
  renter_id: String(raw.renter_id ?? ''),
  owner_id: String(raw.owner_id ?? ''),
  rating: Number(raw.rating ?? 5),
  tags: Array.isArray(raw.tags) ? raw.tags.map((item) => String(item)) : [],
  comment: String(raw.comment ?? ''),
  created_at: String(raw.created_at ?? ''),
});

