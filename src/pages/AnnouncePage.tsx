import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { env } from '../env';
import { uploadImageAndGetPublicUrl, supabase } from '../lib/supabase';
import { RentType } from '../lib/types';

interface DraftPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const createPhotoDrafts = (files: FileList): DraftPhoto[] =>
  Array.from(files).map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));

export function AnnouncePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const [photos, setPhotos] = useState<DraftPhoto[]>([]);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

  const onSelectPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const drafts = createPhotoDrafts(fileList);
    setPhotos((current) => [...current, ...drafts]);
    event.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((photo) => photo.id !== id);
    });
  };

  const setCoverPhoto = (id: string) => {
    setPhotos((current) => {
      const idx = current.findIndex((photo) => photo.id === id);
      if (idx < 0) {
        return current;
      }
      const clone = [...current];
      const [selected] = clone.splice(idx, 1);
      clone.unshift(selected);
      return clone;
    });
  };

  const canGoNext = useMemo(() => {
    if (step === 0) {
      return title.trim().length > 2 && Number(price) > 0 && description.trim().length > 10;
    }
    if (step === 1) {
      return addressText.trim().length > 5;
    }
    return true;
  }, [addressText, description, price, step, title]);

  const publishProperty = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      setErrorMessage('Sessao expirada. Entre novamente.');
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

      const lat = Number(latText);
      const lng = Number(lngText);

      const { error } = await supabase.from('properties').insert({
        owner_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        rent_type: rentType,
        bedrooms,
        bathrooms,
        garage_spots: garageSpots,
        pet_friendly: petFriendly,
        verified: false,
        status: 'pending',
        photos: uploadedUrls,
        location: {
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          addressText: addressText.trim(),
        },
      });

      if (error) {
        throw error;
      }

      navigate('/app/profile', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao publicar anuncio';
      if (message.toLowerCase().includes('bucket')) {
        setErrorMessage(
          `Bucket ${env.supabaseBucket} nao encontrado. Crie o bucket no Supabase Storage.`,
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="screen content-page">
      <header className="page-header">
        <div>
          <h1>Anunciar imovel</h1>
          <p className="muted">Wizard em 3 etapas com moderacao automatica.</p>
        </div>
      </header>

      <section className="card">
        <div className="wizard-steps">
          <span className={step === 0 ? 'active' : ''}>1. Info</span>
          <span className={step === 1 ? 'active' : ''}>2. Local</span>
          <span className={step === 2 ? 'active' : ''}>3. Fotos</span>
        </div>

        <form className="stack gap-16" onSubmit={publishProperty}>
          {step === 0 && (
            <>
              <label className="field">
                <span>Titulo</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>

              <label className="field">
                <span>Descricao</span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                />
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
                  <span>Tipo de aluguel</span>
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
                  <input
                    type="number"
                    min={0}
                    value={bedrooms}
                    onChange={(event) => setBedrooms(Number(event.target.value))}
                  />
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
                  <span>Vagas de garagem</span>
                  <input
                    type="number"
                    min={0}
                    value={garageSpots}
                    onChange={(event) => setGarageSpots(Number(event.target.value))}
                  />
                </label>
              </div>

              <label className="check-line">
                <input
                  type="checkbox"
                  checked={petFriendly}
                  onChange={(event) => setPetFriendly(event.target.checked)}
                />
                Aceita pet
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label className="field">
                <span>Endereco de referencia</span>
                <input
                  value={addressText}
                  onChange={(event) => setAddressText(event.target.value)}
                  placeholder="Rua, numero, bairro"
                  required
                />
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

              <p className="muted">
                Sem API de mapas paga: o endereco digitado ja e salvo e usado na busca e no Google Maps.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <label className="field">
                <span>Fotos (minimo 3)</span>
                <input type="file" accept="image/*" multiple onChange={onSelectPhotos} />
              </label>

              <div className="photo-grid">
                {photos.map((photo, index) => (
                  <article key={photo.id} className="photo-item">
                    <img src={photo.previewUrl} alt={`Foto ${index + 1}`} />
                    <div className="photo-actions">
                      {index === 0 ? (
                        <span className="chip chip-soft">CAPA</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline small"
                          onClick={() => setCoverPhoto(photo.id)}
                        >
                          Capa
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger small"
                        onClick={() => removePhoto(photo.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {errorMessage && <p className="alert error">{errorMessage}</p>}

          <div className="wizard-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0 || loading}
            >
              Voltar
            </button>

            {step < 2 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep((value) => Math.min(2, value + 1))}
                disabled={!canGoNext || loading}
              >
                Proximo
              </button>
            ) : (
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Publicando...' : 'Publicar anuncio'}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}

