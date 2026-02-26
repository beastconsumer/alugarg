import { useState } from 'react';
import { Badge, Card, Group, Image, Stack, Text } from '@mantine/core';
import { motion } from 'framer-motion';
import { Heart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import { Property } from '../lib/types';

const getRating = (seed: string): string => {
  const total = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rating = 4.6 + (total % 5) * 0.1;
  return rating.toFixed(2).replace('.', ',');
};

const getPriceContext = (rentType: Property['rent_type']): string => {
  if (rentType === 'diaria') return 'por noite';
  if (rentType === 'temporada') return 'por temporada';
  return 'por mes';
};

export function PropertyCard({ property }: { property: Property }) {
  const cover = property.photos[0] || '/background.png';
  const rating = getRating(property.id);
  const [saved, setSaved] = useState(false);
  const [imgSrc, setImgSrc] = useState(cover);

  return (
    <motion.div
      className="home-listing-item"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Card component={Link} to={`/app/property/${property.id}`} withBorder radius="xl" p={0} className="home-listing-card">
        <div className="home-listing-image-wrap">
          <Image
            src={imgSrc}
            alt={property.title}
            className="home-listing-image"
            onError={() => setImgSrc('/background.png')}
          />
          <Group className="home-listing-overlay-top" justify="space-between" wrap="nowrap">
            <Badge
              radius="xl"
              variant="filled"
              color={property.verified ? 'brandNavy' : 'gray'}
            >
              {property.verified ? 'Preferido dos hospedes' : 'Nova opcao'}
            </Badge>
            <button
              type="button"
              aria-label={saved ? 'Remover dos salvos' : 'Salvar imovel'}
              className={`property-heart-btn${saved ? ' saved' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSaved((prev) => !prev);
              }}
            >
              <Heart size={14} color="white" fill={saved ? 'white' : 'none'} />
            </button>
          </Group>
        </div>

        <Stack gap={3} p="sm" className="home-listing-meta">
          <Text fw={700} lineClamp={1}>
            {property.title}
          </Text>

          <Text size="sm" c="dimmed" lineClamp={1}>
            {property.location.addressText || 'Balneario Cassino'}
          </Text>

          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="sm" fw={800} c="dark">
              {formatMoney(property.price)}{' '}
              <Text span fw={400} c="dimmed" size="xs">{getPriceContext(property.rent_type)}</Text>
            </Text>
            <Group gap={3} wrap="nowrap" style={{ color: '#1f5ed6' }}>
              <Star size={12} fill="currentColor" />
              <Text size="sm" fw={700}>
                {rating}
              </Text>
            </Group>
          </Group>
        </Stack>
      </Card>
    </motion.div>
  );
}
