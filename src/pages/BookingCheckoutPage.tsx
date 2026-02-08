import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { calculateUnits, formatDate, formatMoney } from '../lib/format';
import { findSeedPropertyById } from '../lib/seedProperties';
import { supabase } from '../lib/supabase';
import { parseBooking, parseProperty, Property } from '../lib/types';
import { useAuth } from '../state/AuthContext';

type PaymentMethod = 'card' | 'pix';

const calculateNights = (checkInDate: string, checkOutDate: string): number => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return 0;
  }

  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
};

const toDateInputValue = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const safeFormatDate = (value: string): string => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return formatDate(parsed);
};

const sanitizeDigits = (value: string): string => value.replace(/\D/g, '');

const formatCardNumber = (value: string): string => {
  const digits = sanitizeDigits(value).slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const formatExpiry = (value: string): string => {
  const digits = sanitizeDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const paymentMethodLabel = (value: PaymentMethod): string => (value === 'pix' ? 'PIX' : 'Cartao');

export function BookingCheckoutPage() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successBookingId, setSuccessBookingId] = useState('');
  const [emailNotice, setEmailNotice] = useState('');

  const [property, setProperty] = useState<Property | null>(null);

  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guestCount, setGuestCount] = useState(1);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardName, setCardName] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);

  const sendBookingConfirmationEmail = async (finalBookingId: string) => {
    try {
      const guestName = profile?.name || user?.email || 'Hospede';

      const { error } = await supabase.functions.invoke('send-booking-confirmation', {
        body: {
          toEmail: billingEmail.trim(),
          bookingId: finalBookingId,
          guestName,
          propertyTitle: property?.title ?? 'Imovel',
          addressText: property?.location.addressText ?? 'Balneario Cassino',
          checkInDate,
          checkOutDate,
          units,
          totalPaid: amounts.totalPaid,
          paymentMethod,
        },
      });

      if (error) {
        setEmailNotice('Reserva confirmada, mas nao foi possivel enviar o email automatico.');
        return;
      }

      setEmailNotice(`Email de confirmacao enviado para ${billingEmail.trim()}.`);
    } catch {
      setEmailNotice('Reserva confirmada, mas houve falha no envio de email.');
    }
  };

  useEffect(() => {
    setBillingEmail(profile?.email ?? user?.email ?? '');
  }, [profile?.email, user?.email]);

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setLoading(false);
        setErrorMessage('Voce precisa estar logado para seguir com o checkout.');
        return;
      }

      setLoading(true);
      setErrorMessage('');
      setSuccessBookingId('');
      setEmailNotice('');

      try {
        if (bookingId) {
          const { data: bookingRaw, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .eq('renter_id', user.id)
            .maybeSingle();

          if (bookingError) throw bookingError;
          if (!bookingRaw) throw new Error('Reserva nao encontrada para este usuario.');

          const booking = parseBooking(bookingRaw);
          const seedProperty = findSeedPropertyById(booking.property_id);

          if (seedProperty) {
            setProperty(seedProperty);
          } else {
            const { data: propertyRaw, error: propertyError } = await supabase
              .from('properties')
              .select('*')
              .eq('id', booking.property_id)
              .maybeSingle();

            if (propertyError) throw propertyError;
            if (!propertyRaw) throw new Error('Imovel da reserva nao foi encontrado.');
            setProperty(parseProperty(propertyRaw));
          }

          setCheckInDate(toDateInputValue(booking.check_in_date));
          setCheckOutDate(toDateInputValue(booking.check_out_date));
          setGuestCount(1);
        } else {
          const propertyId = searchParams.get('propertyId') ?? '';
          const checkIn = searchParams.get('checkIn') ?? '';
          const checkOut = searchParams.get('checkOut') ?? '';
          const guests = Number(searchParams.get('guests') ?? '1');

          if (!propertyId) {
            throw new Error('Checkout invalido: imovel nao informado.');
          }

          const seedProperty = findSeedPropertyById(propertyId);
          let selectedProperty: Property;

          if (seedProperty) {
            selectedProperty = seedProperty;
          } else {
            const { data: propertyRaw, error: propertyError } = await supabase
              .from('properties')
              .select('*')
              .eq('id', propertyId)
              .maybeSingle();

            if (propertyError) throw propertyError;
            if (!propertyRaw) throw new Error('Imovel nao encontrado para checkout.');
            selectedProperty = parseProperty(propertyRaw);
          }

          setProperty(selectedProperty);
          setCheckInDate(checkIn);
          setCheckOutDate(checkOut);
          setGuestCount(Number.isFinite(guests) && guests > 0 ? guests : 1);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar checkout');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [bookingId, searchParams, user]);

  const nights = useMemo(() => calculateNights(checkInDate, checkOutDate), [checkInDate, checkOutDate]);

  const units = useMemo(() => {
    if (!property) return 0;
    return calculateUnits(property.rent_type, checkInDate, checkOutDate);
  }, [checkInDate, checkOutDate, property]);

  const amounts = useMemo(() => {
    if (!property || units <= 0) {
      return {
        rentalBase: 0,
        cleaningFee: 0,
        clientFee: 0,
        ownerFee: 0,
        totalPaid: 0,
        ownerPayout: 0,
      };
    }

    const rentalBase = property.price * units;
    const cleaningFee = property.cleaning_fee;
    const clientFee = Math.round(rentalBase * 0.1);
    const ownerFee = Math.round(rentalBase * 0.04);

    return {
      rentalBase,
      cleaningFee,
      clientFee,
      ownerFee,
      totalPaid: rentalBase + cleaningFee + clientFee,
      ownerPayout: rentalBase + cleaningFee - ownerFee,
    };
  }, [property, units]);

  const validateInput = (): string | null => {
    if (!property) return 'Imovel nao encontrado.';
    if (!checkInDate || !checkOutDate) return 'Informe check-in e checkout.';
    if (units <= 0) return 'Periodo invalido. Revise as datas.';
    if (nights < property.minimum_nights) return `Minimo de ${property.minimum_nights} noite(s) para este imovel.`;
    if (guestCount < 1) return 'Informe ao menos 1 hospede.';
    if (guestCount > property.guests_capacity) return `Maximo de ${property.guests_capacity} hospede(s).`;
    if (!billingEmail.includes('@')) return 'Informe um email valido para o comprovante.';

    if (paymentMethod === 'card') {
      if (cardName.trim().length < 3) return 'Informe o nome no cartao.';
      if (sanitizeDigits(cardCpf).length !== 11) return 'Informe um CPF valido (11 digitos).';
      const numberLength = sanitizeDigits(cardNumber).length;
      if (numberLength < 13 || numberLength > 19) return 'Numero de cartao invalido.';

      const expiryDigits = sanitizeDigits(cardExpiry);
      if (expiryDigits.length !== 4) return 'Validade invalida. Use MM/AA.';
      const month = Number(expiryDigits.slice(0, 2));
      if (month < 1 || month > 12) return 'Mes da validade invalido.';

      const cvvLength = sanitizeDigits(cardCvv).length;
      if (cvvLength < 3 || cvvLength > 4) return 'CVV invalido.';
    }

    if (!acceptTerms) return 'Voce precisa aceitar os termos de reserva.';
    if (!acceptPolicy) return 'Voce precisa aceitar a politica de cancelamento.';

    return null;
  };

  const hasDateConflict = async (): Promise<boolean> => {
    if (!property) return false;

    const checkInIso = new Date(`${checkInDate}T12:00:00`).toISOString();
    const checkOutIso = new Date(`${checkOutDate}T12:00:00`).toISOString();

    const { data, error } = await supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date, status')
      .eq('property_id', property.id)
      .in('status', ['pre_checking', 'confirmed', 'checked_in']);

    if (error) throw error;

    return (data ?? []).some((row) => {
      if (bookingId && String(row.id) === bookingId) return false;
      const existingStart = new Date(String(row.check_in_date));
      const existingEnd = new Date(String(row.check_out_date));
      return existingStart < new Date(checkOutIso) && existingEnd > new Date(checkInIso);
    });
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !property) return;

    setErrorMessage('');
    const validationIssue = validateInput();
    if (validationIssue) {
      setErrorMessage(validationIssue);
      return;
    }

    setSubmitting(true);

    try {
      const conflict = await hasDateConflict();
      if (conflict) {
        throw new Error('Este imovel ja foi reservado para o periodo escolhido.');
      }

      if (bookingId) {
        const { error } = await supabase
          .from('bookings')
          .update({
            status: 'pre_checking',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .eq('renter_id', user.id);

        if (error) throw error;
        setSuccessBookingId(bookingId);
        await sendBookingConfirmationEmail(bookingId);
      } else {
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            property_id: property.id,
            property_title: property.title,
            renter_id: user.id,
            owner_id: property.owner_id,
            check_in_date: new Date(`${checkInDate}T12:00:00`).toISOString(),
            check_out_date: new Date(`${checkOutDate}T12:00:00`).toISOString(),
            units,
            base_amount: amounts.rentalBase + amounts.cleaningFee,
            client_fee_amount: amounts.clientFee,
            owner_fee_amount: amounts.ownerFee,
            total_paid_by_renter: amounts.totalPaid,
            owner_payout_amount: amounts.ownerPayout,
            status: 'pre_checking',
          })
          .select('id')
          .single();

        if (error) throw error;
        const createdBookingId = String(data?.id ?? '');
        setSuccessBookingId(createdBookingId);
        if (createdBookingId) {
          await sendBookingConfirmationEmail(createdBookingId);
        } else {
          setEmailNotice('Reserva confirmada, mas o identificador para envio de email nao foi gerado.');
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao concluir pagamento');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Stack py="md" pb={96}>
        <Text c="dimmed">Carregando checkout...</Text>
      </Stack>
    );
  }

  if (!property) {
    return (
      <Stack py="md" pb={96}>
        <Alert color="red" icon={<AlertCircle size={16} />}>
          {errorMessage || 'Nao foi possivel abrir o checkout.'}
        </Alert>
      </Stack>
    );
  }

  const cover = property.photos[0] || '/background.png';
  const checkInLabel = safeFormatDate(checkInDate);
  const checkOutLabel = safeFormatDate(checkOutDate);

  return (
    <Stack gap="md" py="md" pb={96}>
      <Group justify="space-between" align="center">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Voltar
        </Button>

        <Badge color="teal" variant="light" leftSection={<ShieldCheck size={13} />}>
          Checkout seguro
        </Badge>
      </Group>

      <Card withBorder radius="xl" p="lg">
        <Stack gap={2}>
          <Title order={2}>Finalizar reserva</Title>
          <Text c="dimmed">
            Revise os dados, escolha o pagamento e confirme. Metodo: {paymentMethodLabel(paymentMethod)}.
          </Text>
        </Stack>
      </Card>

      {successBookingId ? (
        <Card withBorder radius="xl" p="lg">
          <Stack gap="sm">
            <Group gap="xs">
              <CheckCircle2 size={20} />
              <Title order={3}>Pagamento confirmado</Title>
            </Group>

            <Text c="dimmed">
              Seu pagamento foi aprovado e sua reserva entrou em <strong>pre-checking</strong>.
            </Text>
            <Text size="sm">Codigo da reserva: {successBookingId}</Text>
            {emailNotice ? (
              <Alert color={emailNotice.startsWith('Email de confirmacao') ? 'blue' : 'yellow'} variant="light">
                {emailNotice}
              </Alert>
            ) : null}

            <Group>
              <Button component={Link} to={`/app/chat?bookingId=${successBookingId}`}>
                Abrir chat interno com anfitriao
              </Button>
              <Button component={Link} to="/app/bookings">
                Ir para Reservas
              </Button>
              <Button component={Link} to={`/app/property/${property.id}`} variant="default">
                Voltar ao imovel
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : null}

      {!successBookingId ? (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" className="checkout-layout">
          <Card withBorder radius="xl" p="lg" className="checkout-summary-card">
            <Stack gap="md">
              <div className="checkout-cover-wrap">
                <img src={cover} alt={property.title} className="checkout-cover-image" />
              </div>

              <Stack gap={3}>
                <Text fw={800}>{property.title}</Text>
                <Text size="sm" c="dimmed">
                  {property.location.addressText || 'Balneario Cassino, Rio Grande - RS'}
                </Text>
                <Text size="sm">
                  {guestCount} hospede(s) - {checkInLabel} ate {checkOutLabel}
                </Text>
              </Stack>

              <Divider />

              <Stack gap={7}>
                <Group justify="space-between">
                  <Text size="sm">Locacao ({units} unidade(s))</Text>
                  <Text size="sm">{formatMoney(amounts.rentalBase)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Taxa de limpeza</Text>
                  <Text size="sm">{formatMoney(amounts.cleaningFee)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Taxa da plataforma (10%)</Text>
                  <Text size="sm">{formatMoney(amounts.clientFee)}</Text>
                </Group>

                <Divider />

                <Group justify="space-between" className="checkout-total-line">
                  <Text fw={800}>Total a pagar</Text>
                  <Text fw={800}>{formatMoney(amounts.totalPaid)}</Text>
                </Group>

                <Text size="xs" c="dimmed">
                  O repasse previsto ao proprietario sera de {formatMoney(amounts.ownerPayout)}.
                </Text>
              </Stack>
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" className="checkout-payment-card">
            <form onSubmit={submitPayment}>
              <Stack gap="md">
                <Title order={4}>Pagamento e termos</Title>

                {errorMessage ? (
                  <Alert color="red" icon={<AlertCircle size={16} />}>
                    {errorMessage}
                  </Alert>
                ) : null}

                <Radio.Group
                  label="Forma de pagamento"
                  value={paymentMethod}
                  onChange={(value) => setPaymentMethod((value as PaymentMethod) || 'card')}
                >
                  <Group mt={8}>
                    <Radio value="card" label="Cartao de credito/debito" />
                    <Radio value="pix" label="PIX" />
                  </Group>
                </Radio.Group>

                {paymentMethod === 'card' ? (
                  <Stack gap="sm">
                    <TextInput
                      label="Nome no cartao"
                      placeholder="Como impresso no cartao"
                      value={cardName}
                      onChange={(event) => setCardName(event.currentTarget.value)}
                      required
                    />

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <TextInput
                        label="CPF do pagador"
                        placeholder="000.000.000-00"
                        value={cardCpf}
                        onChange={(event) => setCardCpf(event.currentTarget.value)}
                        required
                      />
                      <TextInput
                        label="Numero do cartao"
                        placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={(event) => setCardNumber(formatCardNumber(event.currentTarget.value))}
                        required
                      />
                    </SimpleGrid>

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <TextInput
                        label="Validade (MM/AA)"
                        placeholder="08/29"
                        value={cardExpiry}
                        onChange={(event) => setCardExpiry(formatExpiry(event.currentTarget.value))}
                        required
                      />
                      <TextInput
                        label="CVV"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(event) => setCardCvv(sanitizeDigits(event.currentTarget.value).slice(0, 4))}
                        required
                      />
                    </SimpleGrid>
                  </Stack>
                ) : (
                  <Alert color="teal" variant="light">
                    Ao confirmar, um codigo PIX e comprovante serao gerados automaticamente para esta reserva.
                  </Alert>
                )}

                <TextInput
                  label="Email para comprovante"
                  value={billingEmail}
                  onChange={(event) => setBillingEmail(event.currentTarget.value)}
                  required
                />

                <Card withBorder radius="lg" p="sm">
                  <Stack gap="xs">
                    <Text fw={700} size="sm">
                      Termos da reserva
                    </Text>
                    <Text size="sm" c="dimmed">
                      Cancelamento gratuito em ate 24h apos pagamento e antes do check-in.
                    </Text>
                    <Text size="sm" c="dimmed">
                      A confirmacao da reserva libera os dados para check-in e inicia a mediacao financeira da plataforma.
                    </Text>
                  </Stack>
                </Card>

                <Checkbox
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.currentTarget.checked)}
                  label="Li e aceito os termos de uso e intermediacao financeira."
                />
                <Checkbox
                  checked={acceptPolicy}
                  onChange={(event) => setAcceptPolicy(event.currentTarget.checked)}
                  label="Li e aceito a politica de cancelamento e reembolso."
                />

                <Group>
                  <Button type="submit" loading={submitting}>
                    Pagar e confirmar reserva
                  </Button>
                  <Button variant="default" onClick={() => navigate(-1)}>
                    Revisar dados
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </SimpleGrid>
      ) : null}
    </Stack>
  );
}
