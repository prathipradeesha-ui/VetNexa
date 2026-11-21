import type { Species } from '@vetnexa/shared';
import { Cat, Dog } from 'lucide-react';

const speciesIcons = { DOG: Dog, CAT: Cat };

interface PetAvatarProps {
  name: string;
  species: Species;
  photoUrl: string | null;
  size?: number;
}

/** The pet's photo, or a species icon on a mint circle when no photo has been added. */
export function PetAvatar({ name, species, photoUrl, size = 64 }: PetAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Photo of ${name}`}
        width={size}
        height={size}
        className="pet-avatar pet-avatar--photo"
        loading="lazy"
      />
    );
  }
  const Icon = speciesIcons[species];
  return (
    <span className="pet-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.48)} />
    </span>
  );
}
