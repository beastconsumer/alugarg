import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
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

export function AnnouncePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [documentType, setDocumentType] = useState<'rg' | 'cnh'>('rg');
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
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

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

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

  const submitHostDocuments = async () => {
    if (!user) {
      setErrorMessage('Sessao expirada. Entre novamente.');
      return;
    }

    if (!documentFront || !documentBack) {
      setErrorMessage('Envie frente e verso do documento.');
      return;
    }

    if (!acceptHostRules) {
      setErrorMessage('Voce precisa aceitar as regras para se tornar anfitriao.');
      return;
    }

    setSubmittingDocuments(true);
    setErrorMessage('');

    try {
      const stamp = Date.now();
      const frontPath = `${user.id}/host-documents/${stamp}-front.${getFileExtension(documentFront)}`;
      const backPath = `${user.id}/host-documents/${stamp}-back.${getFileExtension(documentBack)}`;

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
      setForceDocUpload(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar documentos';
      if (message.toLowerCase().includes('bucket')) {
        setErrorMessage('Bucket host-documents nao encontrado no Supabase Storage.');
      } else if (message.toLowerCase().includes('row level security') || message.toLowerCase().includes('permission')) {
        setErrorMessage('Sem permissao para enviar documentos. Entre novamente e tente de novo.');
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
              Anfitriao Aluga Aluga
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
              <Card withBorder radius="lg" p="md" className="host-step-card">
                <Group gap="sm" wrap="nowrap">
                  <div className="host-step-index">1</div>
                  <div>
                    <Text fw={700}>Documento valido</Text>
                    <Text size="sm" c="dimmed">RG ou CNH com foto legivel.</Text>
                  </div>
                </Group>
              </Card>
              <Card withBorder radius="lg" p="md" className="host-step-card">
                <Group gap="sm" wrap="nowrap">
                  <div className="host-step-index">2</div>
                  <div>
                    <Text fw={700}>Fotos nítidas</Text>
                    <Text size="sm" c="dimmed">Sem reflexo, sem cortes e sem filtro.</Text>
                  </div>
                </Group>
              </Card>
              <Card withBorder radius="lg" p="md" className="host-step-card">
                <Group gap="sm" wrap="nowrap">
                  <div className="host-step-index">3</div>
                  <div>
                    <Text fw={700}>Confirmacao e anuncio</Text>
                    <Text size="sm" c="dimmed">Validacao em ate 24h uteis.</Text>
                  </div>
                </Group>
              </Card>
            </SimpleGrid>
          </Stack>
        </Card>

        {isPendingHost && !forceDocUpload ? (
          <Card withBorder radius="xl" p="lg" className="host-waiting-card">
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Title order={4} className="host-hero-title">
                    Documentos recebidos
                  </Title>
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
              <Button variant="default" onClick={() => setForceDocUpload(true)}>
                Reenviar documentos
              </Button>
            </Stack>
          </Card>
        ) : null}

        {showDocumentForm ? (
          <Card withBorder radius="xl" p="lg" className="host-onboard-card">
            <Stack gap="lg">
              <Stack gap={6}>
                <Title order={4}>Antes de anunciar, precisamos validar sua identidade</Title>
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

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <FileInput
                  label="Documento - frente"
                  value={documentFront}
                  onChange={setDocumentFront}
                  accept="image/*"
                  required
                />

                <FileInput
                  label="Documento - verso"
                  value={documentBack}
                  onChange={setDocumentBack}
                  accept="image/*"
                  required
                />
              </SimpleGrid>

              <Alert color="blue" variant="light">
                As imagens serao salvas no Supabase Storage para validacao de anfitriao.
              </Alert>

              {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

              <Button loading={submittingDocuments} onClick={() => void submitHostDocuments()}>
                Enviar documentos e continuar
              </Button>
            </Stack>
          </Card>
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
