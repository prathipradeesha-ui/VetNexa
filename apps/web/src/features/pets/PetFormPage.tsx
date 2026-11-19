import { zodResolver } from '@hookform/resolvers/zod';
import {
  PET_SEX,
  PET_SEX_LABELS,
  petSchema,
  SPECIES,
  SPECIES_LABELS,
  type PetData,
  type PetInput,
} from '@vetnexa/shared';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { usePet, useSavePet, type Pet } from './usePets';
import './pets.css';

/** Route wrapper: loads the pet when editing, then shows the form. */
export function PetFormPage() {
  const { petId } = useParams();
  if (!petId) return <PetForm />;
  return <EditPet petId={petId} />;
}

function EditPet({ petId }: { petId: string }) {
  const pet = usePet(petId);
  if (pet.isPending) return <PageLoader label="Loading pet…" />;
  if (pet.isError) return <Alert tone="error">{pet.error.message}</Alert>;
  return <PetForm pet={pet.data} />;
}

/** Converts a stored pet into form values (inputs hold strings, so blanks are ''). */
function toFormValues(pet?: Pet): PetInput {
  return {
    name: pet?.name ?? '',
    species: pet?.species ?? ('' as PetInput['species']),
    breed: pet?.breed ?? '',
    sex: pet?.sex ?? 'UNKNOWN',
    dateOfBirth: pet?.dateOfBirth ?? '',
    weightKg: pet?.weightKg?.toString() ?? '',
    color: pet?.color ?? '',
    microchipId: pet?.microchipId ?? '',
    isNeutered: pet?.isNeutered ?? false,
    notes: pet?.notes ?? '',
  };
}

function PetForm({ pet }: { pet?: Pet }) {
  const navigate = useNavigate();
  const save = useSavePet(pet?.id);
  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PetInput, unknown, PetData>({
    resolver: zodResolver(petSchema),
    defaultValues: toFormValues(pet),
  });

  const onSubmit = (data: PetData) =>
    save.mutate(data, {
      onSuccess: (saved) =>
        navigate(`/dashboard/pets/${saved.id}`, { state: { saved: pet ? 'updated' : 'created' } }),
      onError: (error) => applyServerErrors(error, setError),
    });

  const backTo = pet ? `/dashboard/pets/${pet.id}` : '/dashboard/pets';

  return (
    <>
      <Link to={backTo} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> {pet ? `Back to ${pet.name}` : 'Back to my pets'}
      </Link>
      <div className="page-header">
        <div>
          <h1>{pet ? `Edit ${pet.name}` : 'Add a pet'}</h1>
          <p>Only the name and species are required. You can add the rest later.</p>
        </div>
      </div>

      <form className="card pet-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {save.isError && !hasFieldErrors(save.error) && (
          <Alert tone="error">{save.error.message}</Alert>
        )}

        <h2 className="form-section-title">Basic details</h2>
        <div className="field-row">
          <TextField label="Name" error={errors.name?.message} {...register('name')} />
          <FieldWrapper id="pet-species" label="Species" error={errors.species?.message}>
            <select
              id="pet-species"
              className="select"
              aria-invalid={errors.species ? true : undefined}
              {...register('species')}
            >
              <option value="">Choose a species</option>
              {SPECIES.map((species) => (
                <option key={species} value={species}>
                  {SPECIES_LABELS[species]}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>
        <div className="field-row">
          <TextField
            label="Breed"
            optional
            placeholder="e.g. Labrador Retriever"
            error={errors.breed?.message}
            {...register('breed')}
          />
          <FieldWrapper id="pet-sex" label="Sex" error={errors.sex?.message}>
            <select id="pet-sex" className="select" {...register('sex')}>
              {PET_SEX.map((sex) => (
                <option key={sex} value={sex}>
                  {PET_SEX_LABELS[sex]}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>
        <div className="field-row">
          <TextField
            label="Date of birth"
            type="date"
            optional
            max={today}
            hint="An approximate date is fine for rescued pets"
            error={errors.dateOfBirth?.message}
            {...register('dateOfBirth')}
          />
          <TextField
            label="Weight (kg)"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            optional
            error={errors.weightKg?.message}
            {...register('weightKg')}
          />
        </div>

        <h2 className="form-section-title">Identification</h2>
        <div className="field-row">
          <TextField
            label="Colour and markings"
            optional
            placeholder="e.g. Golden, white chest"
            error={errors.color?.message}
            {...register('color')}
          />
          <TextField
            label="Microchip number"
            optional
            inputMode="numeric"
            placeholder="15-digit number"
            error={errors.microchipId?.message}
            {...register('microchipId')}
          />
        </div>
        <label className="checkbox pet-form__checkbox">
          <input type="checkbox" {...register('isNeutered')} />
          Spayed or neutered
        </label>

        <FieldWrapper id="pet-notes" label="Notes" optional error={errors.notes?.message}>
          <textarea
            id="pet-notes"
            className="textarea"
            rows={4}
            placeholder="Allergies, diet, behaviour or anything a vet should know"
            {...register('notes')}
          />
        </FieldWrapper>

        <div className="form-actions">
          <Link to={backTo} className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={save.isPending} loadingText="Saving…">
            {pet ? 'Save changes' : 'Add pet'}
          </Button>
        </div>
      </form>
    </>
  );
}
