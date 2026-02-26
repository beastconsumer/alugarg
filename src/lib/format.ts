const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const formatMoney = (value: number): string => moneyFormatter.format(value);

export const formatDate = (value: string | Date): string => dateFormatter.format(new Date(value));

const chatTimeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const chatDayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export const formatChatTime = (value: string | Date): string => {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const time = chatTimeFormatter.format(date);
  if (date >= startOfToday) return `Hoje as ${time}`;
  if (date >= startOfYesterday) return `Ontem as ${time}`;
  return `${chatDayFormatter.format(date)} as ${time}`;
};

export const parseBirthDateText = (value: string): string | null => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const parsed = new Date(`${iso}T00:00:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(yyyy) ||
    parsed.getUTCMonth() + 1 !== Number(mm) ||
    parsed.getUTCDate() !== Number(dd)
  ) {
    return null;
  }

  return iso;
};

export const calculateUnits = (
  rentType: 'mensal' | 'temporada' | 'diaria',
  checkInDate: string,
  checkOutDate: string,
): number => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return 0;
  }

  const msDiff = checkOut.getTime() - checkIn.getTime();
  const dayDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

  if (rentType === 'mensal') {
    return Math.max(1, Math.ceil(dayDiff / 30));
  }

  return Math.max(1, dayDiff);
};

