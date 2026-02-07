export interface AmenityOption {
  value: string;
  label: string;
}

export const amenityOptions: AmenityOption[] = [
  { value: 'piscina', label: 'Piscina' },
  { value: 'sala_jogos', label: 'Sala de jogos' },
  { value: 'banheira', label: 'Banheira' },
  { value: 'churrasqueira', label: 'Churrasqueira' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'ar_condicionado', label: 'Ar-condicionado' },
  { value: 'cozinha_completa', label: 'Cozinha completa' },
  { value: 'smart_tv', label: 'Smart TV' },
  { value: 'maquina_lavar', label: 'Maquina de lavar' },
  { value: 'secadora', label: 'Secadora' },
  { value: 'varanda', label: 'Varanda' },
  { value: 'vista_mar', label: 'Vista para o mar' },
  { value: 'academia', label: 'Academia' },
  { value: 'area_gourmet', label: 'Area gourmet' },
  { value: 'aquecimento_agua', label: 'Aquecimento de agua' },
  { value: 'portaria_24h', label: 'Portaria 24h' },
  { value: 'acessibilidade', label: 'Acessibilidade' },
  { value: 'berco', label: 'Berco' },
  { value: 'cadeira_bebe', label: 'Cadeira para bebe' },
  { value: 'escritorio', label: 'Espaco de trabalho' },
];

const amenityLabelMap = new Map(amenityOptions.map((item) => [item.value, item.label]));

export const getAmenityLabel = (value: string): string => {
  return amenityLabelMap.get(value) ?? value.replaceAll('_', ' ');
};

