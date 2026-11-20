import {
  ADOPTION_STATUS_LABELS,
  AGE_GROUP_LABELS,
  PET_SEX_LABELS,
  type AdoptionStatus,
} from '@vetnexa/shared';
import {
  Baby,
  Bird,
  Cat,
  Check,
  Dog,
  HeartHandshake,
  MapPin,
  PawPrint,
  Rabbit,
  ShieldCheck,
  Syringe,
  X,
} from 'lucide-react';
import type { Listing } from './useAdoption';
import './adoption.css';

const speciesIcons = { DOG: Dog, CAT: Cat, RABBIT: Rabbit, BIRD: Bird, OTHER: PawPrint };

export function ListingStatusBadge({ status }: { status: AdoptionStatus }) {
  const tone: Record<AdoptionStatus, string> = {
    AVAILABLE: '',
    PENDING: 'badge--warning',
    ADOPTED: 'badge--info',
    WITHDRAWN: 'badge--neutral',
  };
  return <span className={`badge ${tone[status]}`}>{ADOPTION_STATUS_LABELS[status]}</span>;
}

/** Large photo, or a mint panel with the species icon when there is no photo yet. */
export function ListingPhoto({
  listing,
  className = '',
}: {
  listing: Listing;
  className?: string;
}) {
  const SpeciesIcon = speciesIcons[listing.species];
  return listing.photoUrl ? (
    <img
      src={listing.photoUrl}
      alt={`Photo of ${listing.name}`}
      className={`listing-photo ${className}`}
      loading="lazy"
    />
  ) : (
    <span className={`listing-photo listing-photo--empty ${className}`} aria-hidden="true">
      <SpeciesIcon size={48} />
      <span className="listing-photo__caption">Photo coming soon</span>
    </span>
  );
}

export function listingSummary(listing: Listing) {
  return [
    listing.breed,
    listing.sex !== 'UNKNOWN' ? PET_SEX_LABELS[listing.sex] : null,
    AGE_GROUP_LABELS[listing.ageGroup].split(' (')[0],
    listing.size,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Yes / no / unknown facts shown as small chips with icons. */
export function ListingTraits({ listing }: { listing: Listing }) {
  const answer = (value: boolean | null) =>
    value === null ? null : value ? (
      <Check size={14} aria-label="yes" />
    ) : (
      <X size={14} aria-label="no" />
    );
  const traits = [
    { icon: Syringe, label: 'Vaccinated', value: listing.isVaccinated },
    { icon: ShieldCheck, label: 'Spayed / neutered', value: listing.isNeutered },
    { icon: Baby, label: 'Good with children', value: listing.goodWithChildren },
    { icon: HeartHandshake, label: 'Good with other pets', value: listing.goodWithPets },
  ];
  return (
    <ul className="trait-list">
      {traits
        .filter((trait) => trait.value !== null)
        .map(({ icon: Icon, label, value }) => (
          <li key={label} className={value ? 'trait trait--yes' : 'trait trait--no'}>
            <Icon size={14} aria-hidden="true" /> {label} {answer(value)}
          </li>
        ))}
    </ul>
  );
}

export function ListingLocation({ city }: { city: string }) {
  return (
    <span className="listing-location">
      <MapPin size={14} aria-hidden="true" /> {city}
    </span>
  );
}
