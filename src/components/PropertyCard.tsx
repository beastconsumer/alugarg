import { Badge, Card, Group, Image, Stack, Text, ThemeIcon } from '@mantine/core';
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

  return (
    <motion.div
      className="home-listing-item"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Card component={Link} to={`/app/property/${property.id}`} withBorder radius="xl" p={0} className="home-listing-card">
        <div className="home-listing-image-wrap">
          <Image src={cover} alt={property.title} className="home-listing-image" />
          <Group className="home-listing-overlay-top" justify="space-between" wrap="nowrap">
            <Badge radius="xl" variant="filled" color="gray">
              {property.verified ? 'Preferido dos hospedes' : 'Nova opcao'}
            </Badge>
            <ThemeIcon size={28} radius="xl" color="dark" variant="gradient" gradient={{ from: '#3f3f46', to: '#111827', deg: 135 }}>
              <Heart size={14} />
            </ThemeIcon>
          </Group>
        </div>

        <Stack gap={2} p="xs" className="home-listing-meta">
          <Text fw={700} lineClamp={1}>
            {property.title}
          </Text>

          <Text size="sm" c="dimmed" lineClamp={1}>
            {property.location.addressText || 'Balneario Cassino'}
          </Text>

          <Group gap={5} wrap="nowrap">
            <Text size="sm" fw={600}>
              {formatMoney(property.price)} {getPriceContext(property.rent_type)}
            </Text>
            <Text size="sm" c="dimmed">
              •
            </Text>
            <Group gap={3} wrap="nowrap">
              <Star size={13} fill="currentColor" />
              <Text size="sm" fw={600}>
                {rating}
              </Text>
            </Group>
          </Group>
        </Stack>
      </Card>
    </motion.div>
  );
}
