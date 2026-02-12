export type RentType = 'mensal' | 'temporada' | 'diaria';
export type PropertyStatus = 'pending' | 'approved' | 'rejected';
export type BookingStatus =
  | 'pending_payment'
  | 'pre_checking'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';
export type HostVerificationStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

export interface PropertyLocation {
  lat: number | null;
  lng: number | null;
  addressText: string;
  cep: string;
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
  guests_capacity: number;
  suites: number;
  area_m2: number;
  pet_friendly: boolean;
  furnished: boolean;
  smoking_allowed: boolean;
  events_allowed: boolean;
  amenities: string[];
  house_rules: string;
  check_in_time: string;
  check_out_time: string;
  minimum_nights: number;
  cleaning_fee: number;
  security_deposit: number;
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
  host_verification_status: HostVerificationStatus;
  host_document_type: 'rg' | 'cnh' | '';
  host_document_front_path: string;
  host_document_back_path: string;
  host_verification_submitted_at: string | null;
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

export type ChatConversationStatus = 'open' | 'closed' | 'blocked';

export interface ChatConversation {
  id: string;
  booking_id: string;
  property_id: string;
  renter_id: string;
  owner_id: string;
  status: ChatConversationStatus;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  is_system: boolean;
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
    return { lat: null, lng: null, addressText: '', cep: '' };
  }

  const value = raw as Record<string, unknown>;

  return {
    lat: typeof value.lat === 'number' ? value.lat : null,
    lng: typeof value.lng === 'number' ? value.lng : null,
    addressText: typeof value.addressText === 'string' ? value.addressText : '',
    cep: typeof value.cep === 'string' ? value.cep : '',
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
  guests_capacity: Number(raw.guests_capacity ?? 1),
  suites: Number(raw.suites ?? 0),
  area_m2: Number(raw.area_m2 ?? 0),
  pet_friendly: Boolean(raw.pet_friendly ?? false),
  furnished: Boolean(raw.furnished ?? false),
  smoking_allowed: Boolean(raw.smoking_allowed ?? false),
  events_allowed: Boolean(raw.events_allowed ?? false),
  amenities: Array.isArray(raw.amenities) ? raw.amenities.map((item) => String(item)) : [],
  house_rules: String(raw.house_rules ?? ''),
  check_in_time: String(raw.check_in_time ?? '14:00'),
  check_out_time: String(raw.check_out_time ?? '11:00'),
  minimum_nights: Number(raw.minimum_nights ?? 1),
  cleaning_fee: Number(raw.cleaning_fee ?? 0),
  security_deposit: Number(raw.security_deposit ?? 0),
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
  host_verification_status: (String(raw.host_verification_status ?? 'not_started') as HostVerificationStatus),
  host_document_type: (String(raw.host_document_type ?? '') as 'rg' | 'cnh' | ''),
  host_document_front_path: String(raw.host_document_front_path ?? ''),
  host_document_back_path: String(raw.host_document_back_path ?? ''),
  host_verification_submitted_at: raw.host_verification_submitted_at
    ? String(raw.host_verification_submitted_at)
    : null,
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

export const parseChatConversation = (raw: Record<string, unknown>): ChatConversation => ({
  id: String(raw.id ?? ''),
  booking_id: String(raw.booking_id ?? ''),
  property_id: String(raw.property_id ?? ''),
  renter_id: String(raw.renter_id ?? ''),
  owner_id: String(raw.owner_id ?? ''),
  status: (String(raw.status ?? 'open') as ChatConversationStatus),
  created_at: String(raw.created_at ?? ''),
  updated_at: String(raw.updated_at ?? ''),
  last_message_at: String(raw.last_message_at ?? ''),
});

export const parseChatMessage = (raw: Record<string, unknown>): ChatMessage => ({
  id: String(raw.id ?? ''),
  conversation_id: String(raw.conversation_id ?? ''),
  sender_id: String(raw.sender_id ?? ''),
  message_text: String(raw.message_text ?? ''),
  is_system: Boolean(raw.is_system ?? false),
  created_at: String(raw.created_at ?? ''),
});

