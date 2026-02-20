import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
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
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import UseAnimations from 'react-useanimations';
import alertCircleAnimated from 'react-useanimations/lib/alertCircle';
import checkmarkAnimated from 'react-useanimations/lib/checkmark';
import infoAnimated from 'react-useanimations/lib/info';
import { useAuth } from '../state/AuthContext';
import { env } from '../env';
import { formatDate } from '../lib/format';
import { formatCep, isValidCep, resolveLocationFromCepAddress, sanitizeCep } from '../lib/location';
import { uploadImageAndGetPublicUrl, uploadPrivateDocumentAndGetPath, supabase } from '../lib/supabase';
import { amenityOptions } from '../lib/propertyCatalog';
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
  const [rentType, setRentType] = useState<RentType>('mensal');
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
  const [houseRules, setHouseRules] = useState('');

  const [addressText, setAddressText] = useState('');
  const [cep, setCep] = useState('');

  const [photos, setPhotos] = useState<DraftPhoto[]>([]);

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

  const canGoNext = useMemo(() => {
    if (step === 0) {
      return (
        title.trim().length > 3 &&
        Number(price) > 0 &&
        description.trim().length > 10 &&
        guestsCapacity >= 1 &&
        minimumNights >= 1
      );
    }

    if (step === 1) {
      return addressText.trim().length > 5 && isValidCep(cep);
    }

    return true;
  }, [addressText, description, guestsCapacity, minimumNights, price, step, title]);

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
      if (!file) {
        setDocumentFront(null);
        return;
      }
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
    if (!file) {
      setDocumentBack(null);
      return;
    }
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
    if (!user) {
      setErrorMessage('Sessao expirada. Entre novamente.');
      return;
    }

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

    let frontPath = '';
    let backPath = '';

    try {
      const stamp = Date.now();
      frontPath = `${user.id}/host-documents/${stamp}-front.${getFileExtension(documentFront)}`;
      backPath = `${user.id}/host-documents/${stamp}-back.${getFileExtension(documentBack)}`;

      await uploadPrivateDocumentAndGetPath(documentFront, frontPath);
      await uploadPrivateDocumentAndGetPath(documentBack, backPath);

      const { error } = await supabase
        .from('users')
        .update({
          host_verification_status: 'pending',
          host_document_type: documentType,
          host_document_front_path: frontPath,
          host_document_back_path: backPath,
          host_verification_submitted_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setDocumentFront(null);
      setDocumentBack(null);
      if (documentFrontPreviewUrl) {
        URL.revokeObjectURL(documentFrontPreviewUrl);
        setDocumentFrontPreviewUrl('');
      }
      if (documentBackPreviewUrl) {
        URL.revokeObjectURL(documentBackPreviewUrl);
        setDocumentBackPreviewUrl('');
      }
      setDocumentSuccessMessage('Documentos enviados com sucesso. Sua analise ja foi iniciada.');
      setForceDocUpload(false);
      setAcceptHostRules(false);
    } catch (error) {
      if (frontPath || backPath) {
        await supabase.storage
          .from('host-documents')
          .remove([frontPath, backPath].filter(Boolean))
          .catch(() => null);
      }
      const message = error instanceof Error ? error.message : 'Falha ao enviar documentos';
      if (message.toLowerCase().includes('bucket')) {
        setErrorMessage('Bucket host-documents nao encontrado no Supabase Storage.');
      } else if (message.toLowerCase().includes('row level security') || message.toLowerCase().includes('permission')) {
        setErrorMessage('Sem permissao para enviar documentos. Entre novamente e tente de novo.');
      } else if (message.toLowerCase().includes('mime') || message.toLowerCase().includes('content-type')) {
        setErrorMessage('Formato invalido. Envie JPG, PNG ou WEBP com boa qualidade.');
      } else if (message.toLowerCase().includes('network') || message.toLowerCase().includes('failed to fetch')) {
        setErrorMessage('Falha de rede ao enviar documentos. Verifique sua internet e tente novamente.');
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSubmittingDocuments(false);
    }
  };

  const publishProperty = async () => {
    if (!user) {
      setErrorMessage('Sessao expirada. Entre novamente.');
      return;
    }

    if (!isVerifiedHost) {
      setErrorMessage('Aguarde a confirmacao dos documentos antes de anunciar.');
      return;
    }

    if (photos.length < 3) {
      setErrorMessage('Selecione pelo menos 3 fotos.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

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
        rent_type: rentType,
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
      navigate('/app/profile', { replace: true });
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

  if (!isVerifiedHost) {
    return (
      <Stack gap="md" py="md">
        <Card withBorder radius="xl" p="lg" className="host-hero-card">
          <Stack gap={6}>
            <Badge color="dark" variant="light">
              Anfitriao AlugaSul
            </Badge>
            <Title order={2} className="host-hero-title">
              Que legal que voce quer se tornar um anfitriao.
            </Title>
            <Text c="dimmed">
              Vamos seguir um passo a passo simples: enviar documentos, aguardar confirmacao e depois cadastrar sua casa.
            </Text>
          </Stack>
        </Card>

        <Card withBorder radius="xl" p="lg" className="host-onboard-card">
          <Stack gap="lg">
            <Stack gap="xs">
              <Title order={4}>Sua jornada de anfitriao</Title>
              <Text size="sm" c="dimmed">
                Cada etapa libera a proxima. Assim garantimos seguranca e qualidade para todos.
              </Text>
            </Stack>

            <Stepper active={hostJourneyStep} allowNextStepsSelect={false} iconPosition="left">
              <Stepper.Step label="Enviar documentos" description="RG ou CNH frente e verso" />
              <Stepper.Step label="Aguardar confirmacao" description="Analise da equipe" />
              <Stepper.Step label="Cadastrar a casa" description="Complete o anuncio" />
            </Stepper>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.16 }}>
                <Card withBorder radius="lg" p="md" className="host-step-card">
                  <Group gap="sm" wrap="nowrap">
                    <div className="host-step-index">1</div>
                    <div>
                      <Group gap={6} align="center">
                        <UseAnimations animation={checkmarkAnimated} size={16} strokeColor="#0f766e" autoplay />
                        <Text fw={700}>Documento valido</Text>
                      </Group>
                      <Text size="sm" c="dimmed">RG ou CNH com foto legivel.</Text>
                    </div>
                  </Group>
                </Card>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.16 }}>
                <Card withBorder radius="lg" p="md" className="host-step-card">
                  <Group gap="sm" wrap="nowrap">
                    <div className="host-step-index">2</div>
                    <div>
                      <Group gap={6} align="center">
                        <UseAnimations animation={alertCircleAnimated} size={16} strokeColor="#b45309" autoplay />
                        <Text fw={700}>Fotos nitidas</Text>
                      </Group>
                      <Text size="sm" c="dimmed">Sem reflexo, sem cortes e sem filtro.</Text>
                    </div>
                  </Group>
                </Card>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.16 }}>
                <Card withBorder radius="lg" p="md" className="host-step-card">
                  <Group gap="sm" wrap="nowrap">
                    <div className="host-step-index">3</div>
                    <div>
                      <Group gap={6} align="center">
                        <UseAnimations animation={infoAnimated} size={16} strokeColor="#1f5ed6" autoplay />
                        <Text fw={700}>Confirmacao e anuncio</Text>
                      </Group>
                      <Text size="sm" c="dimmed">Validacao em ate 24h uteis.</Text>
                    </div>
                  </Group>
                </Card>
              </motion.div>
            </SimpleGrid>
          </Stack>
        </Card>

        {isPendingHost && !forceDocUpload ? (
          <Card withBorder radius="xl" p="lg" className="host-waiting-card">
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Group gap={8}>
                    <UseAnimations animation={checkmarkAnimated} size={20} strokeColor="#0f766e" autoplay />
                    <Title order={4} className="host-hero-title">
                      Documentos recebidos
                    </Title>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Estamos analisando sua identidade. Em breve liberamos o cadastro do imovel.
                  </Text>
                </Stack>
                <Badge color="yellow" variant="light">
                  Em analise
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Enviado em {profile?.host_verification_submitted_at ? formatDate(profile.host_verification_submitted_at) : 'data indefinida'}.
              </Text>
              <Alert color="blue" variant="light">
                Assim que a verificacao for aprovada, voce podera cadastrar sua casa e publicar o anuncio.
              </Alert>
              <Button
                variant="default"
                onClick={() => {
                  setErrorMessage('');
                  setDocumentSuccessMessage('');
                  setForceDocUpload(true);
                }}
              >
                Reenviar documentos
              </Button>
            </Stack>
          </Card>
        ) : null}

        {showDocumentForm ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
          <Card withBorder radius="xl" p="lg" className="host-onboard-card">
            <Stack gap="lg">
              <Stack gap={6}>
                <Group gap={8}>
                  <UseAnimations animation={alertCircleAnimated} size={20} strokeColor="#1f5ed6" autoplay />
                  <Title order={4}>Antes de anunciar, precisamos validar sua identidade</Title>
                </Group>
                <Text c="dimmed">
                  Isso ajuda a manter a plataforma segura para hospedes e anfitrioes.
                </Text>
              </Stack>

              {isRejectedHost ? (
                <Alert color="red" variant="light">
                  Seus documentos foram recusados. Envie novas fotos nítidas para continuar.
                </Alert>
              ) : null}

              <Card withBorder radius="lg" p="md" className="host-onboard-rules">
                <Stack gap="xs">
                  <Text fw={700}>Regras do anfitriao</Text>
                  <Text size="sm" c="dimmed">
                    Ao anunciar, voce concorda com:
                  </Text>
                  <ul className="host-onboard-list">
                    <li>Respeitar as regras de condominio e vizinhanca.</li>
                    <li>Manter o anuncio atualizado com fotos reais.</li>
                    <li>Responder mensagens em tempo razoavel.</li>
                    <li>Oferecer check-in claro e seguro.</li>
                  </ul>
                </Stack>
              </Card>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Select
                  label="Documento"
                  description="Escolha o documento que voce vai enviar agora."
                  data={[
                    { value: 'rg', label: 'RG' },
                    { value: 'cnh', label: 'CNH' },
                  ]}
                  value={documentType}
                  onChange={(value) => setDocumentType((value as 'rg' | 'cnh') || 'rg')}
                  required
                />

                <Checkbox
                  label="Li e aceito as regras para anunciar"
                  checked={acceptHostRules}
                  onChange={(event) => setAcceptHostRules(event.currentTarget.checked)}
                />
              </SimpleGrid>

              <Text size="xs" c="dimmed">
                Ao enviar documentos, voce concorda com os{' '}
                <Anchor component={Link} to="/termos-de-uso" fw={700}>
                  Termos de Uso
                </Anchor>{' '}
                e com a{' '}
                <Anchor component={Link} to="/politica-de-privacidade" fw={700}>
                  Politica de Privacidade
                </Anchor>
                .
              </Text>

              <Card withBorder radius="lg" p="md" className="host-onboard-rules">
                <Stack gap={4}>
                  <Group gap={8}>
                    <UseAnimations animation={infoAnimated} size={18} strokeColor="#1f5ed6" autoplay />
                    <Text fw={700}>Checklist rapido para aprovacao</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Envie {documentType === 'rg' ? 'RG' : 'CNH'} com boa iluminacao, sem cortes e com dados legiveis.
                  </Text>
                  <ul className="host-onboard-list">
                    <li>Use imagem original da camera, sem print.</li>
                    <li>Evite reflexo, sombra e desfoque.</li>
                    <li>Formato aceito: JPG, PNG ou WEBP.</li>
                    <li>Tamanho maximo por arquivo: 12 MB.</li>
                  </ul>
                </Stack>
              </Card>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <FileInput
                  label="Documento - frente"
                  description="JPG, PNG ou WEBP ate 12 MB."
                  value={documentFront}
                  onChange={(file) => onChangeDocumentFile('front', file)}
                  accept="image/*"
                  required
                />

                <FileInput
                  label="Documento - verso"
                  description="JPG, PNG ou WEBP ate 12 MB."
                  value={documentBack}
                  onChange={(file) => onChangeDocumentFile('back', file)}
                  accept="image/*"
                  required
                />
              </SimpleGrid>

              {(documentFront || documentBack) ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Card withBorder radius="lg" p="md" className="profile-air-list-card">
                    <Stack gap={8}>
                      <Text fw={700}>Frente do documento</Text>
                      {documentFrontPreviewUrl ? (
                        <img src={documentFrontPreviewUrl} alt="Preview documento frente" className="host-document-preview" />
                      ) : null}
                      <Text size="sm" c="dimmed">
                        {documentFront ? `${documentFront.name} (${formatFileSize(documentFront.size)})` : 'Nao selecionado'}
                      </Text>
                      {documentFront ? (
                        <Button variant="default" size="xs" onClick={() => onChangeDocumentFile('front', null)}>
                          Remover frente
                        </Button>
                      ) : null}
                    </Stack>
                  </Card>

                  <Card withBorder radius="lg" p="md" className="profile-air-list-card">
                    <Stack gap={8}>
                      <Text fw={700}>Verso do documento</Text>
                      {documentBackPreviewUrl ? (
                        <img src={documentBackPreviewUrl} alt="Preview documento verso" className="host-document-preview" />
                      ) : null}
                      <Text size="sm" c="dimmed">
                        {documentBack ? `${documentBack.name} (${formatFileSize(documentBack.size)})` : 'Nao selecionado'}
                      </Text>
                      {documentBack ? (
                        <Button variant="default" size="xs" onClick={() => onChangeDocumentFile('back', null)}>
                          Remover verso
                        </Button>
                      ) : null}
                    </Stack>
                  </Card>
                </SimpleGrid>
              ) : null}

              {documentFrontError ? <Alert color="red">{documentFrontError}</Alert> : null}
              {documentBackError ? <Alert color="red">{documentBackError}</Alert> : null}

              {hasDocuments ? (
                <Alert color="gray" variant="light">
                  Ultimo envio: {submittedDocumentTypeLabel} em{' '}
                  {profile?.host_verification_submitted_at ? formatDate(profile.host_verification_submitted_at) : 'data nao registrada'}.
                </Alert>
              ) : null}

              <Alert color="blue" variant="light">
                As imagens serao armazenadas com acesso privado e usadas apenas na validacao do anfitriao.
              </Alert>

              {documentSuccessMessage ? <Alert color="teal">{documentSuccessMessage}</Alert> : null}
              {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                <Button loading={submittingDocuments} disabled={!canSubmitDocuments} onClick={() => void submitHostDocuments()}>
                Enviar documentos e continuar
              </Button>
              </motion.div>
            </Stack>
          </Card>
          </motion.div>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack gap="md" py="md">
      <Card withBorder radius="xl" p="lg">
        <Stack gap={6}>
          <Title order={2}>Anunciar imovel</Title>
          <Text c="dimmed">Fluxo profissional com comodidades, regras e taxas completas.</Text>
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="lg">
          <Stepper active={step} onStepClick={setStep} allowNextStepsSelect iconPosition="left">
            <Stepper.Step label="Info" description="Estrutura e politicas" />
            <Stepper.Step label="Local" description="Endereco e referencia" />
            <Stepper.Step label="Fotos" description="Galeria do anuncio" />
          </Stepper>

          {step === 0 ? (
            <Stack gap="md">
              <Title order={4}>Dados principais</Title>
              <TextInput label="Titulo" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
              <Textarea
                label="Descricao"
                minRows={4}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                required
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <NumberInput
                  label="Preco base"
                  min={1}
                  value={price}
                  onChange={(value) => setPrice(typeof value === 'number' ? value : '')}
                  required
                />
                <Select
                  label="Tipo de aluguel"
                  data={[
                    { value: 'mensal', label: 'Mensal' },
                    { value: 'temporada', label: 'Temporada' },
                    { value: 'diaria', label: 'Diaria' },
                  ]}
                  value={rentType}
                  onChange={(value) => setRentType((value as RentType) || 'mensal')}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <NumberInput label="Quartos" min={0} value={bedrooms} onChange={(v) => setBedrooms(Number(v) || 0)} />
                <NumberInput label="Banheiros" min={0} value={bathrooms} onChange={(v) => setBathrooms(Number(v) || 0)} />
                <NumberInput label="Suites" min={0} value={suites} onChange={(v) => setSuites(Number(v) || 0)} />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <NumberInput
                  label="Capacidade de hospedes"
                  min={1}
                  value={guestsCapacity}
                  onChange={(v) => setGuestsCapacity(Number(v) || 1)}
                />
                <NumberInput
                  label="Vagas de garagem"
                  min={0}
                  value={garageSpots}
                  onChange={(v) => setGarageSpots(Number(v) || 0)}
                />
                <NumberInput label="Area (m2)" min={0} value={areaM2} onChange={(v) => setAreaM2(Number(v) || 0)} />
              </SimpleGrid>

              <Title order={4}>Comodidades estilo hospedagem premium</Title>
              <MultiSelect
                label="Comodidades"
                placeholder="Selecione comodidades"
                searchable
                clearable
                data={amenityOptions}
                value={amenities}
                onChange={setAmenities}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Switch
                  label="Aceita pet"
                  checked={petFriendly}
                  onChange={(event) => setPetFriendly(event.currentTarget.checked)}
                />
                <Switch
                  label="Imovel mobiliado"
                  checked={furnished}
                  onChange={(event) => setFurnished(event.currentTarget.checked)}
                />
                <Switch
                  label="Permite fumar"
                  checked={smokingAllowed}
                  onChange={(event) => setSmokingAllowed(event.currentTarget.checked)}
                />
                <Switch
                  label="Permite eventos"
                  checked={eventsAllowed}
                  onChange={(event) => setEventsAllowed(event.currentTarget.checked)}
                />
              </SimpleGrid>

              <Title order={4}>Politicas e taxas</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <NumberInput
                  label="Minimo de noites"
                  min={1}
                  value={minimumNights}
                  onChange={(v) => setMinimumNights(Number(v) || 1)}
                />
                <NumberInput
                  label="Taxa de limpeza"
                  min={0}
                  value={cleaningFee}
                  onChange={(v) => setCleaningFee(Number(v) || 0)}
                />
                <NumberInput
                  label="Caucao"
                  min={0}
                  value={securityDeposit}
                  onChange={(v) => setSecurityDeposit(Number(v) || 0)}
                />
                <SimpleGrid cols={2} spacing="xs">
                  <TextInput
                    label="Check-in"
                    type="time"
                    value={checkInTime}
                    onChange={(event) => setCheckInTime(event.currentTarget.value)}
                  />
                  <TextInput
                    label="Check-out"
                    type="time"
                    value={checkOutTime}
                    onChange={(event) => setCheckOutTime(event.currentTarget.value)}
                  />
                </SimpleGrid>
              </SimpleGrid>

              <Textarea
                label="Regras da casa"
                minRows={3}
                placeholder="Ex: sem festas apos 22h, respeito aos vizinhos, etc"
                value={houseRules}
                onChange={(event) => setHouseRules(event.currentTarget.value)}
              />
            </Stack>
          ) : null}

          {step === 1 ? (
            <Stack gap="md">
              <TextInput
                label="CEP"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(formatCep(e.currentTarget.value))}
                required
              />

              <TextInput
                label="Endereco de referencia"
                value={addressText}
                onChange={(e) => setAddressText(e.currentTarget.value)}
                placeholder="Rua, numero, bairro"
                required
              />

              <Alert color="blue" variant="light">
                O mapa usa CEP + endereco para posicionar a casa com mais precisao.
              </Alert>

              {cep && !isValidCep(sanitizeCep(cep)) ? <Alert color="yellow">CEP invalido. Use 8 digitos.</Alert> : null}
            </Stack>
          ) : null}

          {step === 2 ? (
            <Stack gap="md">
              <FileInput
                label="Fotos (minimo 3)"
                placeholder="Selecione fotos"
                multiple
                accept="image/*"
                leftSection={<ImagePlus size={16} />}
                onChange={onSelectPhotos}
              />

              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {photos.map((photo, index) => (
                  <Card key={photo.id} withBorder radius="lg" p="xs">
                    <Stack gap="xs">
                      <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="draft-photo" />
                      <Group justify="space-between" wrap="nowrap">
                        {index === 0 ? (
                          <Badge color="ocean">CAPA</Badge>
                        ) : (
                          <Button
                            variant="light"
                            size="compact-sm"
                            leftSection={<Star size={14} />}
                            onClick={() => setCoverPhoto(photo.id)}
                          >
                            Capa
                          </Button>
                        )}

                        <ActionIcon color="red" variant="light" onClick={() => removePhoto(photo.id)}>
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>

              <Text size="sm" c={photos.length >= 3 ? 'teal' : 'red'}>
                Selecionadas: {photos.length} (minimo 3)
              </Text>
            </Stack>
          ) : null}

          {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

          <Group justify="space-between">
            <Button
              variant="default"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0 || loading}
            >
              Voltar
            </Button>

            {step < 2 ? (
              <Button onClick={() => setStep((value) => Math.min(2, value + 1))} disabled={!canGoNext || loading}>
                Proximo
              </Button>
            ) : (
              <Button loading={loading} onClick={() => void publishProperty()}>
                Publicar anuncio
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
