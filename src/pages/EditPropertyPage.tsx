import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { amenityOptions } from '../lib/propertyCatalog';
import { formatCep, isValidCep, resolveLocationFromCepAddress, sanitizeCep } from '../lib/location';
import { supabase, uploadImageAndGetPublicUrl } from '../lib/supabase';
import { parseProperty, Property, RentType } from '../lib/types';

interface ExistingPhoto {
  id: string;
  type: 'existing';
  url: string;
}

interface NewPhoto {
  id: string;
  type: 'new';
  file: File;
  previewUrl: string;
}

type DraftPhoto = ExistingPhoto | NewPhoto;

const createDrafts = (files: File[]): NewPhoto[] =>
  files.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'new' as const,
    file,
    previewUrl: URL.createObjectURL(file),
  }));

export function EditPropertyPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);

  useEffect(() => {
    return () => {
      draftPhotos.forEach((photo) => {
        if (photo.type === 'new') {
          URL.revokeObjectURL(photo.previewUrl);
        }
      });
    };
  }, [draftPhotos]);

  useEffect(() => {
    const run = async () => {
      if (!id || !user) return;

      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .eq('owner_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Anuncio nao encontrado ou sem permissao para editar.');

        const parsed = parseProperty(data);
        setProperty(parsed);
        setTitle(parsed.title);
        setDescription(parsed.description);
        setPrice(parsed.price);
        setRentType(parsed.rent_type);
        setBedrooms(parsed.bedrooms);
        setBathrooms(parsed.bathrooms);
        setGarageSpots(parsed.garage_spots);
        setGuestsCapacity(parsed.guests_capacity);
        setSuites(parsed.suites);
        setAreaM2(parsed.area_m2);
        setMinimumNights(parsed.minimum_nights);
        setCheckInTime(parsed.check_in_time || '14:00');
        setCheckOutTime(parsed.check_out_time || '11:00');
        setCleaningFee(parsed.cleaning_fee);
        setSecurityDeposit(parsed.security_deposit);
        setPetFriendly(parsed.pet_friendly);
        setFurnished(parsed.furnished);
        setSmokingAllowed(parsed.smoking_allowed);
        setEventsAllowed(parsed.events_allowed);
        setAmenities(parsed.amenities);
        setHouseRules(parsed.house_rules);
        setAddressText(parsed.location.addressText);
        setCep(formatCep(parsed.location.cep || ''));
        setDraftPhotos(
          parsed.photos.map((url) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'existing' as const,
            url,
          })),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar anuncio');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [id, user]);

  const onAddPhotos = (files: File[] | null) => {
    if (!files || files.length === 0) return;
    const drafts = createDrafts(files);
    setDraftPhotos((current) => [...current, ...drafts]);
  };

  const removePhoto = (idToRemove: string) => {
    setDraftPhotos((current) => {
      const selected = current.find((item) => item.id === idToRemove);
      if (selected?.type === 'new') URL.revokeObjectURL(selected.previewUrl);
      return current.filter((item) => item.id !== idToRemove);
    });
  };

  const setAsCover = (idToMove: string) => {
    setDraftPhotos((current) => {
      const index = current.findIndex((item) => item.id === idToMove);
      if (index < 0) return current;
      const clone = [...current];
      const [selected] = clone.splice(index, 1);
      clone.unshift(selected);
      return clone;
    });
  };

  const hasMinimumPhotos = useMemo(() => draftPhotos.length >= 3, [draftPhotos.length]);

  const onSubmit = async () => {
    if (!user || !property) {
      setErrorMessage('Sessao invalida.');
      return;
    }

    if (!hasMinimumPhotos) {
      setErrorMessage('Mantenha ao menos 3 fotos no anuncio.');
      return;
    }

    if (!isValidCep(cep)) {
      setErrorMessage('Informe um CEP valido para posicionar corretamente no mapa.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      const finalUrls: string[] = [];

      for (const [index, photo] of draftPhotos.entries()) {
        if (photo.type === 'existing') {
          finalUrls.push(photo.url);
          continue;
        }

        const path = `${user.id}/properties/${Date.now()}-${index}.jpg`;
        const uploadedUrl = await uploadImageAndGetPublicUrl(photo.file, path);
        finalUrls.push(uploadedUrl);
      }

      const resolvedLocation = await resolveLocationFromCepAddress(cep, addressText);
      if (resolvedLocation.lat === null || resolvedLocation.lng === null) {
        throw new Error('Nao foi possivel localizar este endereco. Confira CEP e endereco.');
      }

      const { error } = await supabase
        .from('properties')
        .update({
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
          photos: finalUrls,
          location: {
            lat: resolvedLocation.lat,
            lng: resolvedLocation.lng,
            addressText: resolvedLocation.addressText,
            cep: resolvedLocation.cep,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', property.id)
        .eq('owner_id', user.id);

      if (error) throw error;
      navigate('/app/profile', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao salvar edicao');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack py="md">
        <Text c="dimmed">Carregando anuncio...</Text>
      </Stack>
    );
  }

  if (!property) {
    return (
      <Stack py="md">
        <Alert color="red">Anuncio nao encontrado.</Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md" py="md">
      <Card withBorder radius="xl" p="lg">
        <Stack gap={6}>
          <Title order={2}>Editar anuncio</Title>
          <Text c="dimmed">Atualize estrutura completa, comodidades premium e regras do imovel.</Text>
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Title order={4}>Dados principais</Title>
          <TextInput label="Titulo" value={title} onChange={(event) => setTitle(event.currentTarget.value)} required />

          <Textarea
            label="Descricao"
            minRows={4}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="Preco"
              min={1}
              value={price}
              onChange={(value) => setPrice(typeof value === 'number' ? value : '')}
              required
            />
            <Select
              label="Tipo"
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
            <NumberInput label="Garagem" min={0} value={garageSpots} onChange={(v) => setGarageSpots(Number(v) || 0)} />
            <NumberInput label="Area (m2)" min={0} value={areaM2} onChange={(v) => setAreaM2(Number(v) || 0)} />
          </SimpleGrid>

          <Title order={4}>Comodidades</Title>
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
            <Switch label="Aceita pet" checked={petFriendly} onChange={(event) => setPetFriendly(event.currentTarget.checked)} />
            <Switch label="Imovel mobiliado" checked={furnished} onChange={(event) => setFurnished(event.currentTarget.checked)} />
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
              <TextInput label="Check-in" type="time" value={checkInTime} onChange={(event) => setCheckInTime(event.currentTarget.value)} />
              <TextInput label="Check-out" type="time" value={checkOutTime} onChange={(event) => setCheckOutTime(event.currentTarget.value)} />
            </SimpleGrid>
          </SimpleGrid>

          <Textarea
            label="Regras da casa"
            minRows={3}
            value={houseRules}
            onChange={(event) => setHouseRules(event.currentTarget.value)}
          />

          <Title order={4}>Localizacao</Title>
          <TextInput
            label="CEP"
            placeholder="00000-000"
            value={cep}
            onChange={(event) => setCep(formatCep(event.currentTarget.value))}
            required
          />

          <TextInput label="Endereco" value={addressText} onChange={(event) => setAddressText(event.currentTarget.value)} required />

          {cep && !isValidCep(sanitizeCep(cep)) ? <Alert color="yellow">CEP invalido. Use 8 digitos.</Alert> : null}

          <Title order={4}>Fotos</Title>
          <FileInput
            label="Adicionar fotos"
            placeholder="Selecione novas fotos"
            multiple
            accept="image/*"
            leftSection={<ImagePlus size={16} />}
            onChange={onAddPhotos}
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {draftPhotos.map((photo, index) => (
              <Card key={photo.id} withBorder radius="lg" p="xs">
                <Stack gap="xs">
                  <img
                    src={photo.type === 'existing' ? photo.url : photo.previewUrl}
                    alt={`Foto ${index + 1}`}
                    className="draft-photo"
                  />
                  <Group justify="space-between" wrap="nowrap">
                    {index === 0 ? (
                      <Badge color="ocean">CAPA</Badge>
                    ) : (
                      <Button variant="light" size="compact-sm" leftSection={<Star size={14} />} onClick={() => setAsCover(photo.id)}>
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

          {!hasMinimumPhotos ? <Alert color="red">O anuncio precisa de no minimo 3 fotos.</Alert> : null}
          {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

          <Group grow>
            <Button variant="default" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void onSubmit()}>
              Salvar alteracoes
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
