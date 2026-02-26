import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  BadgeCheck,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Home,
  ImagePlus,
  Info,
  MapPin,
  Shield,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { env } from '../env';
import { formatDate } from '../lib/format';
import { formatCep, isValidCep, resolveLocationFromCepAddress, sanitizeCep } from '../lib/location';
import {
  removePrivateDocumentByRef,
  uploadImageAndGetPublicUrl,
  uploadPrivateDocumentAndGetPath,
  supabase,
} from '../lib/supabase';
import { amenityOptions, getAmenityLabel } from '../lib/propertyCatalog';
import { RentType } from '../lib/types';

interface DraftPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const createPhotoDrafts = (files: File[]): DraftPhoto[] =>
  files.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));

const allowedDocumentMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxDocumentSizeBytes = 12 * 1024 * 1024;

const formatFileSize = (sizeBytes: number): string => {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.ceil(sizeBytes / 1024)} KB`;
};

const validateDocumentFile = (file: File, sideLabel: string): string | null => {
  if (!allowedDocumentMimeTypes.includes(file.type)) {
    return `${sideLabel}: use JPG, PNG ou WEBP.`;
  }
  if (file.size > maxDocumentSizeBytes) {
    return `${sideLabel}: tamanho maximo de 12 MB.`;
  }
  return null;
};

const getDocumentTypeLabel = (value: 'rg' | 'cnh' | ''): string => {
  if (value === 'rg') return 'RG';
  if (value === 'cnh') return 'CNH';
  return '-';
};

export function AnnouncePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [documentType, setDocumentType] = useState<'rg' | 'cnh'>('rg');
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [documentFrontPreviewUrl, setDocumentFrontPreviewUrl] = useState('');
  const [documentBackPreviewUrl, setDocumentBackPreviewUrl] = useState('');
  const [documentFrontError, setDocumentFrontError] = useState('');
  const [documentBackError, setDocumentBackError] = useState('');
  const [documentSuccessMessage, setDocumentSuccessMessage] = useState('');
  const [submittingDocuments, setSubmittingDocuments] = useState(false);
  const [acceptHostRules, setAcceptHostRules] = useState(false);
  const [forceDocUpload, setForceDocUpload] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [rentTypes, setRentTypes] = useState<RentType[]>(['mensal']);
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [garageSpots, setGarageSpots] = useState(0);
  const [guestsCapacity, setGuestsCapacity] = useState(2);
  const [suites, setSuites] = useState(0);
  const [areaM2, setAreaM2] = useState(0);
  const [minimumNights, setMinimumNights] = useState(1);
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [cleaningFee, setCleaningFee] = useState(0);
  const [securityDeposit, setSecurityDeposit] = useState(0);
  const [petFriendly, setPetFriendly] = useState(false);
  const [furnished, setFurnished] = useState(true);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [eventsAllowed, setEventsAllowed] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenitySearch, setAmenitySearch] = useState('');
  const [houseRules, setHouseRules] = useState('');

  const [addressText, setAddressText] = useState('');
  const [cep, setCep] = useState('');

  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState('');

  const hostStatus = profile?.host_verification_status ?? 'not_started';
  const hasDocuments = Boolean(
    profile?.host_document_front_path && profile?.host_document_back_path,
  );
  const isVerifiedHost = hostStatus === 'verified' && hasDocuments;
  const isPendingHost = hostStatus === 'pending';
  const isRejectedHost = hostStatus === 'rejected';
  const showDocumentForm = forceDocUpload || hostStatus === 'not_started' || isRejectedHost;
  const hostJourneyStep = isVerifiedHost ? 2 : isPendingHost ? 1 : 0;
  const canSubmitDocuments =
    Boolean(documentFront) &&
    Boolean(documentBack) &&
    acceptHostRules &&
    !documentFrontError &&
    !documentBackError;
  const submittedDocumentTypeLabel = getDocumentTypeLabel(profile?.host_document_type ?? '');

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

  useEffect(() => {
    if (profile?.host_document_type === 'rg' || profile?.host_document_type === 'cnh') {
      setDocumentType(profile.host_document_type);
    }
  }, [profile?.host_document_type]);

  useEffect(() => {
    return () => {
      if (documentFrontPreviewUrl) URL.revokeObjectURL(documentFrontPreviewUrl);
      if (documentBackPreviewUrl) URL.revokeObjectURL(documentBackPreviewUrl);
    };
  }, [documentBackPreviewUrl, documentFrontPreviewUrl]);

  const onSelectPhotos = (files: File[] | null) => {
    if (!files || files.length === 0) return;
    const drafts = createPhotoDrafts(files);
    setPhotos((current) => [...current, ...drafts]);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const setCoverPhoto = (id: string) => {
    setPhotos((current) => {
      const idx = current.findIndex((photo) => photo.id === id);
      if (idx < 0) return current;
      const clone = [...current];
      const [selected] = clone.splice(idx, 1);
      clone.unshift(selected);
      return clone;
    });
  };

  const primaryRentType = rentTypes[0] ?? 'mensal';

  const toggleAmenity = (value: string) => {
    setAmenities((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  };

  const filteredAmenityOptions = useMemo(() => {
    const query = amenitySearch.trim().toLowerCase();
    if (!query) return amenityOptions;
    return amenityOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [amenitySearch]);

  const canGoNext = useMemo(() => {
    if (step === 0) {
      return (
        title.trim().length > 3 &&
        Number(price) > 0 &&
        rentTypes.length > 0 &&
        description.trim().length > 10 &&
        guestsCapacity >= 1 &&
        minimumNights >= 1
      );
    }

    if (step === 1) {
      return addressText.trim().length > 5 && isValidCep(cep);
    }

    return true;
  }, [addressText, description, guestsCapacity, minimumNights, price, rentTypes.length, step, title]);

  const getFileExtension = (file: File): string => {
    const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (fromName) return fromName.replace(/[^a-z0-9]/g, '') || 'jpg';
    if (file.type.includes('png')) return 'png';
    if (file.type.includes('webp')) return 'webp';
    return 'jpg';
  };

  const onChangeDocumentFile = (side: 'front' | 'back', file: File | null) => {
    if (side === 'front') {
      setDocumentFrontError('');
      setDocumentSuccessMessage('');
      if (documentFrontPreviewUrl) {
        URL.revokeObjectURL(documentFrontPreviewUrl);
        setDocumentFrontPreviewUrl('');
      }
      if (!file) { setDocumentFront(null); return; }
      const validationError = validateDocumentFile(file, 'Frente');
      if (validationError) {
        setDocumentFront(null);
        setDocumentFrontError(validationError);
        return;
      }
      setDocumentFront(file);
      setDocumentFrontPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setDocumentBackError('');
    setDocumentSuccessMessage('');
    if (documentBackPreviewUrl) {
      URL.revokeObjectURL(documentBackPreviewUrl);
      setDocumentBackPreviewUrl('');
    }
    if (!file) { setDocumentBack(null); return; }
    const validationError = validateDocumentFile(file, 'Verso');
    if (validationError) {
      setDocumentBack(null);
      setDocumentBackError(validationError);
      return;
    }
    setDocumentBack(file);
    setDocumentBackPreviewUrl(URL.createObjectURL(file));
  };

  const submitHostDocuments = async () => {
    if (!user) { setErrorMessage('Sessao expirada. Entre novamente.'); return; }
    setDocumentSuccessMessage('');
    setDocumentFrontError('');
    setDocumentBackError('');

    if (!documentFront || !documentBack) {
      setErrorMessage('Envie frente e verso do documento.');
      return;
    }

    const frontValidationError = validateDocumentFile(documentFront, 'Frente');
    const backValidationError = validateDocumentFile(documentBack, 'Verso');

    if (frontValidationError || backValidationError) {
      if (frontValidationError) setDocumentFrontError(frontValidationError);
      if (backValidationError) setDocumentBackError(backValidationError);
      setErrorMessage('Revise os arquivos antes de enviar.');
      return;
    }

    if (!acceptHostRules) {
      setErrorMessage('Voce precisa aceitar as regras para se tornar anfitriao.');
      return;
    }

    setSubmittingDocuments(true);
    setErrorMessage('');
    let frontStoragePath = '';
    let backStoragePath = '';
    let frontStoredRef = '';
    let backStoredRef = '';

    try {
      const stamp = Date.now();
      frontStoragePath = `${user.id}/host-documents/${stamp}-front.${getFileExtension(documentFront)}`;
      backStoragePath = `${user.id}/host-documents/${stamp}-back.${getFileExtension(documentBack)}`;

      frontStoredRef = await uploadPrivateDocumentAndGetPath(documentFront, frontStoragePath);
      backStoredRef = await uploadPrivateDocumentAndGetPath(documentBack, backStoragePath);

      const { error } = await supabase
        .from('users')
        .update({
          host_verification_status: 'pending',
          host_document_type: documentType,
          host_document_front_path: frontStoredRef,
          host_document_back_path: backStoredRef,
          host_verification_submitted_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setDocumentFront(null);
      setDocumentBack(null);
      if (documentFrontPreviewUrl) { URL.revokeObjectURL(documentFrontPreviewUrl); setDocumentFrontPreviewUrl(''); }
      if (documentBackPreviewUrl) { URL.revokeObjectURL(documentBackPreviewUrl); setDocumentBackPreviewUrl(''); }
      setDocumentSuccessMessage('Documentos enviados com sucesso. Sua analise ja foi iniciada.');
      setForceDocUpload(false);
      setAcceptHostRules(false);
    } catch (error) {
      await Promise.all([
        removePrivateDocumentByRef(frontStoredRef),
        removePrivateDocumentByRef(backStoredRef),
      ]);
      const message = error instanceof Error ? error.message : 'Falha ao enviar documentos';
      if (message.toLowerCase().includes('bucket')) {
        setErrorMessage('Nao foi possivel enviar os documentos no momento. Verifique a configuracao do Storage no Supabase.');
      } else if (message.toLowerCase().includes('row level security') || message.toLowerCase().includes('permission')) {
        setErrorMessage('Sem permissao para enviar documentos. Entre novamente e tente de novo.');
      } else if (message.toLowerCase().includes('mime') || message.toLowerCase().includes('content-type')) {
        setErrorMessage('Formato invalido. Envie JPG, PNG ou WEBP com boa qualidade.');
      } else if (message.toLowerCase().includes('network') || message.toLowerCase().includes('failed to fetch')) {
        setErrorMessage('Falha de rede. Verifique sua internet e tente novamente.');
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSubmittingDocuments(false);
    }
  };

  const publishProperty = async () => {
    if (!user) { setErrorMessage('Sessao expirada. Entre novamente.'); return; }
    if (!isVerifiedHost) { setErrorMessage('Aguarde a confirmacao dos documentos antes de anunciar.'); return; }
    if (photos.length < 3) { setErrorMessage('Selecione pelo menos 3 fotos.'); return; }

    setLoading(true);
    setErrorMessage('');
    setPublishSuccessMessage('');

    try {
      const uploadedUrls: string[] = [];

      for (const [index, photo] of photos.entries()) {
        const path = `${user.id}/properties/${Date.now()}-${index}.jpg`;
        const url = await uploadImageAndGetPublicUrl(photo.file, path);
        uploadedUrls.push(url);
      }

      const resolvedLocation = await resolveLocationFromCepAddress(cep, addressText);
      if (resolvedLocation.lat === null || resolvedLocation.lng === null) {
        throw new Error('Nao foi possivel localizar este endereco. Confira o CEP e endereco.');
      }

      const { error } = await supabase.from('properties').insert({
        owner_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        rent_type: primaryRentType,
        rent_types: rentTypes,
        bedrooms,
        bathrooms,
        garage_spots: garageSpots,
        guests_capacity: guestsCapacity,
        suites,
        area_m2: areaM2,
        minimum_nights: minimumNights,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        cleaning_fee: cleaningFee,
        security_deposit: securityDeposit,
        pet_friendly: petFriendly,
        furnished,
        smoking_allowed: smokingAllowed,
        events_allowed: eventsAllowed,
        amenities,
        house_rules: houseRules.trim(),
        verified: false,
        status: 'pending',
        photos: uploadedUrls,
        location: {
          lat: resolvedLocation.lat,
          lng: resolvedLocation.lng,
          addressText: resolvedLocation.addressText,
          cep: resolvedLocation.cep,
        },
      });

      if (error) throw error;
      setPublishSuccessMessage('Anuncio enviado para revisao com sucesso. Ele aparecera no app apos aprovacao do admin.');
      setTimeout(() => navigate('/app/profile', { replace: true }), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao publicar anuncio';
      if (message.toLowerCase().includes('bucket')) {
        setErrorMessage(`Bucket ${env.supabaseBucket} nao encontrado. Crie no Supabase Storage.`);
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Host not yet verified — Verification flow ──────────────────
  if (!isVerifiedHost) {
    return (
      <Stack gap="lg" py="md">
        {/* Hero */}
        <div className="announce-hero">
          <div className="announce-hero-icon">
            <Home size={28} />
          </div>
          <div>
            <Title order={2} className="announce-hero-title">Seja um anfitriao AlugaSul</Title>
            <Text c="dimmed" size="sm" mt={2}>
              Anuncie seu imovel, receba hospedes e gere renda com total seguranca.
            </Text>
          </div>
        </div>

        {/* Journey stepper */}
        <Card withBorder radius="xl" p="lg">
          <Stack gap="md">
            <Text fw={700} size="sm">Sua jornada</Text>
            <Stepper active={hostJourneyStep} allowNextStepsSelect={false} iconPosition="left" size="sm">
              <Stepper.Step label="Documentos" description="RG ou CNH" />
              <Stepper.Step label="Analise" description="Ate 24h uteis" />
              <Stepper.Step label="Publicar" description="Cadastre a casa" />
            </Stepper>
          </Stack>
        </Card>

        {/* Pending state */}
        {isPendingHost && !forceDocUpload ? (
          <Card withBorder radius="xl" p="lg" className="announce-pending-card">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <div className="announce-status-icon announce-status-icon--pending">
                  <CheckCircle2 size={20} />
                </div>
                <Stack gap={3}>
                  <Text fw={700}>Documentos recebidos</Text>
                  <Text size="sm" c="dimmed">
                    Analise em andamento. Em breve voce podera cadastrar seu imovel.
                  </Text>
                  {profile?.host_verification_submitted_at ? (
                    <Text size="xs" c="dimmed">
                      Enviado em {formatDate(profile.host_verification_submitted_at)}
                    </Text>
                  ) : null}
                </Stack>
              </Group>
              <Badge color="yellow" variant="light" radius="xl" style={{ flexShrink: 0 }}>Em analise</Badge>
            </Group>

            <Button
              variant="subtle"
              size="xs"
              mt="md"
              onClick={() => { setErrorMessage(''); setDocumentSuccessMessage(''); setForceDocUpload(true); }}
            >
              Reenviar documentos
            </Button>
          </Card>
        ) : null}

        {/* Rejected state */}
        {isRejectedHost && !forceDocUpload ? (
          <Alert color="red" radius="xl" icon={<AlertCircle size={16} />}>
            Seus documentos foram recusados. Envie novas fotos nítidas para continuar.
          </Alert>
        ) : null}

        {/* Document upload form */}
        {showDocumentForm ? (
          <Card withBorder radius="xl" p="lg">
            <Stack gap="lg">

              {/* Form header */}
              <Stack gap={4}>
                <Group gap="sm">
                  <div className="announce-step-badge">
                    <Shield size={15} />
                  </div>
                  <Text fw={700}>Verificacao de identidade</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Envie uma foto da frente e do verso do seu {documentType === 'rg' ? 'RG' : 'CNH'} para validarmos sua conta.
                </Text>
              </Stack>

              {documentSuccessMessage ? (
                <Alert color="teal" radius="xl" icon={<CheckCircle2 size={16} />}>
                  {documentSuccessMessage}
                </Alert>
              ) : null}

              {/* Document type */}
              <Select
                label="Tipo de documento"
                data={[
                  { value: 'rg', label: 'RG — Registro Geral' },
                  { value: 'cnh', label: 'CNH — Carteira de Habilitacao' },
                ]}
                value={documentType}
                onChange={(value) => setDocumentType((value as 'rg' | 'cnh') || 'rg')}
              />

              {/* Dicas rápidas */}
              <div className="announce-tips-row">
                <div className="announce-tip">
                  <Info size={13} style={{ flexShrink: 0, color: '#1f5ed6' }} />
                  <Text size="xs">Foto original da camera — sem print de tela</Text>
                </div>
                <div className="announce-tip">
                  <Info size={13} style={{ flexShrink: 0, color: '#1f5ed6' }} />
                  <Text size="xs">Sem reflexo, sombra ou desfoque</Text>
                </div>
                <div className="announce-tip">
                  <Info size={13} style={{ flexShrink: 0, color: '#1f5ed6' }} />
                  <Text size="xs">JPG, PNG ou WEBP — max 12 MB</Text>
                </div>
              </div>

              {/* File uploads */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="xs">
                  <FileInput
                    label="Frente do documento"
                    value={documentFront}
                    onChange={(file) => onChangeDocumentFile('front', file)}
                    accept="image/*"
                    error={documentFrontError || undefined}
                    required
                  />
                  {documentFrontPreviewUrl ? (
                    <div className="announce-doc-preview-wrap">
                      <img src={documentFrontPreviewUrl} alt="Frente" className="announce-doc-preview" />
                      <button type="button" className="announce-doc-remove" onClick={() => onChangeDocumentFile('front', null)}>
                        ✕
                      </button>
                    </div>
                  ) : null}
                  {documentFront && !documentFrontPreviewUrl ? (
                    <Text size="xs" c="dimmed">{documentFront.name} ({formatFileSize(documentFront.size)})</Text>
                  ) : null}
                </Stack>

                <Stack gap="xs">
                  <FileInput
                    label="Verso do documento"
                    value={documentBack}
                    onChange={(file) => onChangeDocumentFile('back', file)}
                    accept="image/*"
                    error={documentBackError || undefined}
                    required
                  />
                  {documentBackPreviewUrl ? (
                    <div className="announce-doc-preview-wrap">
                      <img src={documentBackPreviewUrl} alt="Verso" className="announce-doc-preview" />
                      <button type="button" className="announce-doc-remove" onClick={() => onChangeDocumentFile('back', null)}>
                        ✕
                      </button>
                    </div>
                  ) : null}
                  {documentBack && !documentBackPreviewUrl ? (
                    <Text size="xs" c="dimmed">{documentBack.name} ({formatFileSize(documentBack.size)})</Text>
                  ) : null}
                </Stack>
              </SimpleGrid>

              {hasDocuments ? (
                <Text size="xs" c="dimmed">
                  Ultimo envio: {submittedDocumentTypeLabel} em{' '}
                  {profile?.host_verification_submitted_at ? formatDate(profile.host_verification_submitted_at) : '—'}
                </Text>
              ) : null}

              <Divider />

              {/* Rules + acceptance */}
              <Stack gap="sm">
                <Text fw={700} size="sm">Regras do anfitriao</Text>
                <div className="announce-rules-list">
                  <div className="announce-rule-item">
                    <ChevronRight size={13} style={{ color: '#1f5ed6', flexShrink: 0 }} />
                    <Text size="sm">Respeitar as regras de condominio e vizinhanca.</Text>
                  </div>
                  <div className="announce-rule-item">
                    <ChevronRight size={13} style={{ color: '#1f5ed6', flexShrink: 0 }} />
                    <Text size="sm">Manter o anuncio atualizado com fotos reais.</Text>
                  </div>
                  <div className="announce-rule-item">
                    <ChevronRight size={13} style={{ color: '#1f5ed6', flexShrink: 0 }} />
                    <Text size="sm">Responder mensagens em tempo razoavel.</Text>
                  </div>
                  <div className="announce-rule-item">
                    <ChevronRight size={13} style={{ color: '#1f5ed6', flexShrink: 0 }} />
                    <Text size="sm">Oferecer check-in claro e seguro ao hospede.</Text>
                  </div>
                </div>

                <Checkbox
                  label="Li e aceito as regras para anunciar no AlugaSul"
                  checked={acceptHostRules}
                  onChange={(event) => setAcceptHostRules(event.currentTarget.checked)}
                />

                <Text size="xs" c="dimmed">
                  Ao enviar, voce concorda com os{' '}
                  <Anchor component={Link} to="/termos-de-uso" fw={700}>Termos de Uso</Anchor>{' '}
                  e com a{' '}
                  <Anchor component={Link} to="/politica-de-privacidade" fw={700}>Politica de Privacidade</Anchor>.
                </Text>
              </Stack>

              {errorMessage ? <Alert color="red" radius="xl">{errorMessage}</Alert> : null}

              <Button
                loading={submittingDocuments}
                disabled={!canSubmitDocuments}
                onClick={() => void submitHostDocuments()}
                radius="xl"
                fullWidth
                leftSection={<FileCheck2 size={16} />}
              >
                Enviar documentos
              </Button>
            </Stack>
          </Card>
        ) : null}

        {/* Benefits strip */}
        {!showDocumentForm ? (
          <div className="announce-benefits-row">
            <div className="announce-benefit">
              <BadgeCheck size={18} style={{ color: '#1f5ed6' }} />
              <Text size="xs" fw={600}>Verificacao segura</Text>
            </div>
            <div className="announce-benefit">
              <Shield size={18} style={{ color: '#1f5ed6' }} />
              <Text size="xs" fw={600}>Protecao garantida</Text>
            </div>
            <div className="announce-benefit">
              <CheckCircle2 size={18} style={{ color: '#1f5ed6' }} />
              <Text size="xs" fw={600}>Suporte dedicado</Text>
            </div>
          </div>
        ) : null}
      </Stack>
    );
  }

  // ── Verified host — Property form ──────────────────────────────
  return (
    <Stack gap="lg" py="md">
      {/* Header */}
      <div className="announce-hero announce-hero--verified">
        <div className="announce-hero-icon announce-hero-icon--verified">
          <BadgeCheck size={26} />
        </div>
        <div>
          <Title order={2} className="announce-hero-title">Cadastrar imovel</Title>
          <Text c="dimmed" size="sm" mt={2}>Preencha as informacoes e publique seu anuncio para revisao.</Text>
        </div>
      </div>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="xl">
          <Stepper active={step} onStepClick={setStep} allowNextStepsSelect iconPosition="left" size="sm">
            <Stepper.Step label="Informacoes" description="Dados e estrutura" icon={<Building2 size={14} />} />
            <Stepper.Step label="Localizacao" description="CEP e endereco" icon={<MapPin size={14} />} />
            <Stepper.Step label="Fotos" description="Galeria do anuncio" icon={<ImagePlus size={14} />} />
          </Stepper>

          {/* ── STEP 0: Informações ── */}
          {step === 0 ? (
            <Stack gap="lg">
              {/* Básico */}
              <Stack gap="sm">
                <Text fw={700} size="sm" className="announce-section-label">Sobre o imovel</Text>
                <TextInput
                  label="Titulo do anuncio"
                  placeholder="Ex: Casa de Praia com 3 quartos em Cassino"
                  value={title}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                  required
                />
                <Textarea
                  label="Descricao"
                  placeholder="Descreva o imovel: diferenciais, vizinhanca, o que tem por perto..."
                  minRows={4}
                  autosize
                  value={description}
                  onChange={(e) => setDescription(e.currentTarget.value)}
                  required
                />
              </Stack>

              {/* Preço */}
              <Stack gap="sm">
                <Text fw={700} size="sm" className="announce-section-label">Preco e tipo</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <NumberInput
                    label="Preco base (R$)"
                    placeholder="0"
                    min={1}
                    value={price}
                    onChange={(value) => setPrice(typeof value === 'number' ? value : '')}
                    required
                  />
                  <MultiSelect
                    label="Tipos de aluguel"
                    placeholder="Selecione um ou mais tipos"
                    data={[
                      { value: 'diaria', label: 'Diaria - por noite' },
                      { value: 'temporada', label: 'Temporada - por periodo' },
                      { value: 'mensal', label: 'Mensal - por mes' },
                    ]}
                    value={rentTypes}
                    onChange={(value) => {
                      const normalized = value.filter(
                        (item): item is RentType => item === 'diaria' || item === 'temporada' || item === 'mensal',
                      );
                      setRentTypes(normalized.length > 0 ? normalized : ['mensal']);
                    }}
                    required
                  />
                </SimpleGrid>
                <Text size="xs" c="dimmed">
                  O primeiro tipo selecionado sera o principal exibido no card.
                </Text>
              </Stack>

              {/* Estrutura */}
              <Stack gap="sm">
                <Text fw={700} size="sm" className="announce-section-label">Estrutura</Text>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                  <NumberInput label="Quartos" min={0} value={bedrooms} onChange={(v) => setBedrooms(Number(v) || 0)} leftSection={<BedDouble size={14} />} />
                  <NumberInput label="Banheiros" min={0} value={bathrooms} onChange={(v) => setBathrooms(Number(v) || 0)} />
                  <NumberInput label="Suites" min={0} value={suites} onChange={(v) => setSuites(Number(v) || 0)} />
                  <NumberInput label="Garagem" min={0} value={garageSpots} onChange={(v) => setGarageSpots(Number(v) || 0)} />
                </SimpleGrid>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <NumberInput label="Hospedes max." min={1} value={guestsCapacity} onChange={(v) => setGuestsCapacity(Number(v) || 1)} />
                  <NumberInput label="Area (m²)" min={0} value={areaM2} onChange={(v) => setAreaM2(Number(v) || 0)} />
                </SimpleGrid>
              </Stack>

              {/* Comodidades */}
              <Stack gap="sm">
                <Text fw={700} size="sm" className="announce-section-label">Comodidades</Text>
                <TextInput
                  placeholder="Buscar comodidade"
                  value={amenitySearch}
                  onChange={(event) => setAmenitySearch(event.currentTarget.value)}
                />
                <Group gap={8} wrap="wrap">
                  {filteredAmenityOptions.map((option) => {
                    const selected = amenities.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`amenity-tag-btn${selected ? ' selected' : ''}`}
                        onClick={() => toggleAmenity(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </Group>
                {amenities.length > 0 ? (
                  <Group gap={6} wrap="wrap">
                    {amenities.map((item) => (
                      <Badge key={item} size="sm" radius="xl" variant="light" color="blue">
                        {getAmenityLabel(item)}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">Nenhuma comodidade selecionada.</Text>
                )}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Switch label="Aceita pets" checked={petFriendly} onChange={(e) => setPetFriendly(e.currentTarget.checked)} />
                  <Switch label="Mobiliado" checked={furnished} onChange={(e) => setFurnished(e.currentTarget.checked)} />
                  <Switch label="Fumantes" checked={smokingAllowed} onChange={(e) => setSmokingAllowed(e.currentTarget.checked)} />
                  <Switch label="Eventos" checked={eventsAllowed} onChange={(e) => setEventsAllowed(e.currentTarget.checked)} />
                </SimpleGrid>
              </Stack>

              {/* Políticas */}
              <Stack gap="sm">
                <Text fw={700} size="sm" className="announce-section-label">Politicas e taxas</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <NumberInput
                    label="Minimo de noites"
                    min={1}
                    value={minimumNights}
                    onChange={(v) => setMinimumNights(Number(v) || 1)}
                    leftSection={<Clock3 size={14} />}
                  />
                  <NumberInput label="Taxa de limpeza (R$)" min={0} value={cleaningFee} onChange={(v) => setCleaningFee(Number(v) || 0)} />
                  <NumberInput label="Caucao (R$)" min={0} value={securityDeposit} onChange={(v) => setSecurityDeposit(Number(v) || 0)} />
                  <SimpleGrid cols={2} spacing="xs">
                    <TextInput label="Check-in" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.currentTarget.value)} />
                    <TextInput label="Check-out" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.currentTarget.value)} />
                  </SimpleGrid>
                </SimpleGrid>
                <Textarea
                  label="Regras da casa"
                  placeholder="Ex: sem festas apos 22h, respeito aos vizinhos..."
                  minRows={2}
                  autosize
                  value={houseRules}
                  onChange={(e) => setHouseRules(e.currentTarget.value)}
                />
              </Stack>
            </Stack>
          ) : null}

          {/* ── STEP 1: Localização ── */}
          {step === 1 ? (
            <Stack gap="md">
              <Text fw={700} size="sm" className="announce-section-label">Endereco do imovel</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="CEP"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(formatCep(e.currentTarget.value))}
                  error={cep && !isValidCep(sanitizeCep(cep)) ? 'CEP invalido — use 8 digitos' : undefined}
                  required
                />
                <TextInput
                  label="Endereco completo"
                  placeholder="Rua, numero, bairro"
                  value={addressText}
                  onChange={(e) => setAddressText(e.currentTarget.value)}
                  required
                />
              </SimpleGrid>
              <Alert color="blue" variant="light" radius="xl" icon={<MapPin size={15} />}>
                O mapa usa CEP + endereco para posicionar seu imovel com precisao.
              </Alert>
            </Stack>
          ) : null}

          {/* ── STEP 2: Fotos ── */}
          {step === 2 ? (
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={700} size="sm" className="announce-section-label">Fotos do imovel</Text>
                <Badge
                  radius="xl"
                  color={photos.length >= 3 ? 'teal' : 'orange'}
                  variant="light"
                  size="sm"
                >
                  {photos.length} foto{photos.length !== 1 ? 's' : ''} {photos.length >= 3 ? '✓' : '(min. 3)'}
                </Badge>
              </Group>

              <FileInput
                placeholder="Toque para selecionar fotos"
                multiple
                accept="image/*"
                leftSection={<ImagePlus size={16} />}
                onChange={onSelectPhotos}
              />

              {photos.length === 0 ? (
                <div className="announce-photos-empty">
                  <ImagePlus size={32} style={{ color: '#94a3b8' }} />
                  <Text size="sm" c="dimmed">Adicione pelo menos 3 fotos do imovel</Text>
                  <Text size="xs" c="dimmed">A primeira foto sera a capa do anuncio</Text>
                </div>
              ) : (
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                  {photos.map((photo, index) => (
                    <div key={photo.id} className="announce-photo-card">
                      <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="announce-photo-img" />
                      <div className="announce-photo-overlay">
                        {index === 0 ? (
                          <Badge color="ocean" size="xs" radius="xl">CAPA</Badge>
                        ) : (
                          <button type="button" className="announce-photo-cover-btn" onClick={() => setCoverPhoto(photo.id)}>
                            <Star size={11} />
                            <span>Capa</span>
                          </button>
                        )}
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="filled"
                          radius="xl"
                          onClick={() => removePhoto(photo.id)}
                        >
                          <Trash2 size={11} />
                        </ActionIcon>
                      </div>
                    </div>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          ) : null}

          {publishSuccessMessage ? <Alert color="teal" radius="xl">{publishSuccessMessage}</Alert> : null}
          {errorMessage ? <Alert color="red" radius="xl">{errorMessage}</Alert> : null}

          {/* Navigation */}
          <Group justify="space-between">
            <Button
              variant="default"
              radius="xl"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0 || loading}
            >
              Voltar
            </Button>

            {step < 2 ? (
              <Button
                radius="xl"
                onClick={() => setStep((v) => Math.min(2, v + 1))}
                disabled={!canGoNext || loading}
              >
                Proximo
              </Button>
            ) : (
              <Button
                radius="xl"
                loading={loading}
                onClick={() => void publishProperty()}
                leftSection={<CheckCircle2 size={16} />}
              >
                Publicar anuncio
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
