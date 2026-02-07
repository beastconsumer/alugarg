export const normalizePhone = (value: string): string => value.replace(/\D/g, '');

export const toE164Like = (value: string): string => {
  const digits = normalizePhone(value);
  if (!digits) {
    return '';
  }
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
};

