import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
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

const createDrafts = (files: FileList): NewPhoto[] =>
  Array.from(files).map((file) => ({
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
  const [price, setPrice] = useState('');
  const [rentType, setRentType] = useState<RentType>('mensal');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [garageSpots, setGarageSpots] = useState(0);
  const [petFriendly, setPetFriendly] = useState(false);
  const [addressText, setAddressText] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
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
      if (!id || !user) {
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .eq('owner_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Anuncio nao encontrado ou sem permissao para editar.');
        }

        const parsed = parseProperty(data);
        setProperty(parsed);
        setTitle(parsed.title);
        setDescription(parsed.description);
        setPrice(String(parsed.price));
        setRentType(parsed.rent_type);
        setBedrooms(parsed.bedrooms);
        setBathrooms(parsed.bathrooms);
        setGarageSpots(parsed.garage_spots);
        setPetFriendly(parsed.pet_friendly);
        setAddressText(parsed.location.addressText);
        setLatText(parsed.location.lat?.toString() ?? '');
        setLngText(parsed.location.lng?.toString() ?? '');
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

  const onAddPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const drafts = createDrafts(fileList);
    setDraftPhotos((current) => [...current, ...drafts]);
    event.target.value = '';
  };

  const removePhoto = (idToRemove: string) => {
    setDraftPhotos((current) => {
      const selected = current.find((item) => item.id === idToRemove);
      if (selected?.type === 'new') {
        URL.revokeObjectURL(selected.previewUrl);
      }
      return current.filter((item) => item.id !== idToRemove);
    });
  };

  const setAsCover = (idToMove: string) => {
    setDraftPhotos((current) => {
      const index = current.findIndex((item) => item.id === idToMove);
      if (index < 0) {
        return current;
      }

      const clone = [...current];
      const [selected] = clone.splice(index, 1);
      clone.unshift(selected);
      return clone;
    });
  };

  const hasMinimumPhotos = useMemo(() => draftPhotos.length >= 3, [draftPhotos.length]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !property) {
      setErrorMessage('Sessao invalida.');
      return;
    }

    if (!hasMinimumPhotos) {
      setErrorMessage('Mantenha ao menos 3 fotos no anuncio.');
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

      const lat = Number(latText);
      const lng = Number(lngText);

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
          pet_friendly: petFriendly,
          photos: finalUrls,
          location: {
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            addressText: addressText.trim(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', property.id)
        .eq('owner_id', user.id);

      if (error) {
        throw error;
      }

      navigate('/app/profile', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao salvar edicao');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="screen content-page">
        <p className="muted">Carregando anuncio...</p>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="screen content-page">
        <p className="alert error">Anuncio nao encontrado.</p>
      </main>
    );
  }

  return (
    <main className="screen content-page">
      <header className="page-header">
        <h1>Editar anuncio</h1>
      </header>

      <section className="card">
        <form className="stack gap-12" onSubmit={onSubmit}>
          <label className="field">
            <span>Titulo</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>

          <label className="field">
            <span>Descricao</span>
            <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} required />
          </label>

          <div className="inline-grid two">
            <label className="field">
              <span>Preco</span>
              <input
                type="number"
                min={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={rentType} onChange={(event) => setRentType(event.target.value as RentType)}>
                <option value="mensal">Mensal</option>
                <option value="temporada">Temporada</option>
                <option value="diaria">Diaria</option>
              </select>
            </label>
          </div>

          <div className="inline-grid three">
            <label className="field">
              <span>Quartos</span>
              <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Banheiros</span>
              <input
                type="number"
                min={0}
                value={bathrooms}
                onChange={(event) => setBathrooms(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Garagem</span>
              <input
                type="number"
                min={0}
                value={garageSpots}
                onChange={(event) => setGarageSpots(Number(event.target.value))}
              />
            </label>
          </div>

          <label className="check-line">
            <input type="checkbox" checked={petFriendly} onChange={(event) => setPetFriendly(event.target.checked)} />
            Aceita pet
          </label>

          <label className="field">
            <span>Endereco</span>
            <input value={addressText} onChange={(event) => setAddressText(event.target.value)} required />
          </label>

          <div className="inline-grid two">
            <label className="field">
              <span>Latitude (opcional)</span>
              <input value={latText} onChange={(event) => setLatText(event.target.value)} />
            </label>
            <label className="field">
              <span>Longitude (opcional)</span>
              <input value={lngText} onChange={(event) => setLngText(event.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>Adicionar fotos</span>
            <input type="file" accept="image/*" multiple onChange={onAddPhotos} />
          </label>

          <div className="photo-grid">
            {draftPhotos.map((photo, index) => (
              <article className="photo-item" key={photo.id}>
                <img src={photo.type === 'existing' ? photo.url : photo.previewUrl} alt={`Foto ${index + 1}`} />
                <div className="photo-actions">
                  {index === 0 ? (
                    <span className="chip chip-soft">CAPA</span>
                  ) : (
                    <button type="button" className="btn btn-outline small" onClick={() => setAsCover(photo.id)}>
                      Capa
                    </button>
                  )}
                  <button type="button" className="btn btn-danger small" onClick={() => removePhoto(photo.id)}>
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!hasMinimumPhotos && <p className="alert error">O anuncio precisa de no minimo 3 fotos.</p>}
          {errorMessage && <p className="alert error">{errorMessage}</p>}

          <div className="inline-grid two">
            <button className="btn btn-outline" type="button" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

