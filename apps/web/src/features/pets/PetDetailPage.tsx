import { formatPetAge, PET_SEX_LABELS, SPECIES_LABELS } from '@vetnexa/shared';
import { ArrowLeft, Camera, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { HealthTimeline } from '../records/HealthTimeline';
import { formatDate } from './format';
import { PetAvatar } from './PetAvatar';
import { useDeletePet, usePet, usePetPhoto, type Pet } from './usePets';
import './pets.css';

const MAX_PHOTO_MB = 5;

export function PetDetailPage() {
  const { petId = '' } = useParams();
  const pet = usePet(petId);

  if (pet.isPending) return <PageLoader label="Loading pet…" />;
  if (pet.isError) {
    return (
      <>
        <Link to="/dashboard/pets" className="back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to my pets
        </Link>
        <Alert tone="error">{pet.error.message}</Alert>
      </>
    );
  }
  return <PetDetail pet={pet.data} />;
}

function PetDetail({ pet }: { pet: Pet }) {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { saved?: 'created' | 'updated' | 'record' } | null)?.saved;
  const { upload, remove } = usePetPhoto(pet.id);
  const deletePet = useDeletePet();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    // Quick checks in the browser for instant feedback; the server checks again.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`Photos must be ${MAX_PHOTO_MB} MB or smaller.`);
      return;
    }
    setPhotoError(null);
    upload.mutate(file, {
      onError: (error) => setPhotoError(error.message),
    });
  };

  const onDelete = () =>
    deletePet.mutate(pet.id, {
      onSuccess: () => navigate('/dashboard/pets', { replace: true }),
    });

  const details: [string, string | null][] = [
    ['Species', SPECIES_LABELS[pet.species]],
    ['Breed', pet.breed],
    ['Sex', PET_SEX_LABELS[pet.sex]],
    [
      'Date of birth',
      pet.dateOfBirth ? `${formatDate(pet.dateOfBirth)} (${formatPetAge(pet.dateOfBirth)})` : null,
    ],
    ['Weight', pet.weightKg !== null ? `${pet.weightKg} kg` : null],
    ['Colour', pet.color],
    ['Microchip', pet.microchipId],
    ['Spayed / neutered', pet.isNeutered ? 'Yes' : 'No'],
  ];

  return (
    <>
      <Link to="/dashboard/pets" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to my pets
      </Link>

      {saved && (
        <Alert tone="success">
          {saved === 'created'
            ? `${pet.name} has been added.`
            : saved === 'record'
              ? 'Health record saved.'
              : 'Changes saved.'}
        </Alert>
      )}

      <section className="card pet-profile">
        <div className="pet-profile__photo">
          <PetAvatar name={pet.name} species={pet.species} photoUrl={pet.photoUrl} size={140} />
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="pet-photo"
            onChange={onFileChosen}
            aria-label={`Upload a photo of ${pet.name}`}
            aria-describedby="pet-photo-help"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInput.current?.click()}
            loading={upload.isPending}
            loadingText="Uploading…"
          >
            <Camera size={16} aria-hidden="true" /> {pet.photoUrl ? 'Change photo' : 'Add photo'}
          </Button>
          {pet.photoUrl && (
            <button
              type="button"
              className="link-button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove photo
            </button>
          )}
          <span id="pet-photo-help" className="field__hint">
            JPG, PNG or WebP, up to {MAX_PHOTO_MB} MB
          </span>
        </div>

        <div className="pet-profile__body">
          <div className="pet-profile__header">
            <h1>{pet.name}</h1>
            <Link to={`/dashboard/pets/${pet.id}/edit`} className="btn btn--secondary btn--sm">
              <Pencil size={16} aria-hidden="true" /> Edit details
            </Link>
          </div>
          {photoError && <Alert tone="error">{photoError}</Alert>}

          <dl className="detail-list">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? <span className="muted">Not recorded</span>}</dd>
              </div>
            ))}
          </dl>

          {pet.notes && (
            <div className="callout pet-profile__notes">
              <strong>Notes</strong>
              <p>{pet.notes}</p>
            </div>
          )}
        </div>
      </section>

      <HealthTimeline petId={pet.id} petName={pet.name} />

      <section className="card danger-zone" aria-labelledby="delete-heading">
        <h2 id="delete-heading">Delete {pet.name}’s profile</h2>
        <p className="muted">
          This permanently removes the profile, photo and all health records. It cannot be undone.
        </p>
        {deletePet.isError && <Alert tone="error">{deletePet.error.message}</Alert>}
        {confirmingDelete ? (
          <div className="danger-zone__confirm" role="group" aria-label="Confirm deletion">
            <span>Are you sure you want to delete {pet.name}?</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
              Keep profile
            </Button>
            <Button
              size="sm"
              className="btn--danger"
              onClick={onDelete}
              loading={deletePet.isPending}
              loadingText="Deleting…"
            >
              Yes, delete permanently
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={16} aria-hidden="true" /> Delete profile
          </Button>
        )}
      </section>
    </>
  );
}
