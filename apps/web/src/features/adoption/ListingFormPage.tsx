import { zodResolver } from '@hookform/resolvers/zod';
import {
  adoptionListingSchema,
  AGE_GROUP_LABELS,
  AGE_GROUPS,
  ANIMAL_SIZES,
  PET_SEX,
  PET_SEX_LABELS,
  SPECIES,
  SPECIES_LABELS,
  type AdoptionListingData,
  type AdoptionListingInput,
} from '@vetnexa/shared';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { useApplicationsFor, useSaveListing, type Listing } from './useAdoption';
import '../pets/pets.css';

export function ListingFormPage() {
  const { id } = useParams();
  if (!id) return <ListingForm />;
  return <EditListing id={id} />;
}

function EditListing({ id }: { id: string }) {
  const data = useApplicationsFor(id); // returns the listing for its rescuer
  if (data.isPending) return <PageLoader />;
  if (data.isError) return <Alert tone="error">{data.error.message}</Alert>;
  return <ListingForm listing={data.data.listing} />;
}

const yesNo = (value: boolean | null | undefined) =>
  value === true ? 'yes' : value === false ? 'no' : '';

function ListingForm({ listing }: { listing?: Listing }) {
  const navigate = useNavigate();
  const save = useSaveListing(listing?.id);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdoptionListingInput, unknown, AdoptionListingData>({
    resolver: zodResolver(adoptionListingSchema),
    defaultValues: {
      name: listing?.name ?? '',
      species: listing?.species ?? ('' as AdoptionListingInput['species']),
      breed: listing?.breed ?? '',
      sex: listing?.sex ?? 'UNKNOWN',
      ageGroup: listing?.ageGroup ?? ('' as AdoptionListingInput['ageGroup']),
      size: (listing?.size ?? '') as AdoptionListingInput['size'],
      city: listing?.city ?? '',
      description: listing?.description ?? '',
      healthSummary: listing?.healthSummary ?? '',
      isVaccinated: listing?.isVaccinated ?? false,
      isNeutered: listing?.isNeutered ?? false,
      goodWithChildren: yesNo(listing?.goodWithChildren),
      goodWithPets: yesNo(listing?.goodWithPets),
    },
  });
  const backTo = listing ? `/dashboard/listings/${listing.id}` : '/dashboard/listings';

  const select = (
    id: string,
    label: string,
    field: keyof AdoptionListingInput,
    options: [string, string][],
    error?: string,
  ) => (
    <FieldWrapper id={id} label={label} error={error}>
      <select
        id={id}
        className="select"
        aria-invalid={error ? true : undefined}
        {...register(field)}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
  const tri: [string, string][] = [
    ['', 'Not sure yet'],
    ['yes', 'Yes'],
    ['no', 'No'],
  ];

  return (
    <>
      <Link to={backTo} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>
      <div className="page-header">
        <div>
          <h1>{listing ? `Edit ${listing.name}` : 'List an animal for adoption'}</h1>
          <p>Honest, detailed listings help animals find the right home faster.</p>
        </div>
      </div>
      <form
        className="card pet-form"
        noValidate
        onSubmit={handleSubmit((data) =>
          save.mutate(data, {
            onSuccess: (saved) =>
              navigate(`/dashboard/listings/${saved.id}`, { state: { saved: true } }),
            onError: (error) => applyServerErrors(error, setError),
          }),
        )}
      >
        {save.isError && !hasFieldErrors(save.error) && (
          <Alert tone="error">{save.error.message}</Alert>
        )}
        <div className="field-row">
          <TextField label="Name" error={errors.name?.message} {...register('name')} />
          {select(
            'listing-species',
            'Species',
            'species',
            [
              ['', 'Choose a species'],
              ...SPECIES.map((s) => [s, SPECIES_LABELS[s]] as [string, string]),
            ],
            errors.species?.message,
          )}
        </div>
        <div className="field-row">
          <TextField label="Breed" optional error={errors.breed?.message} {...register('breed')} />
          {select(
            'listing-sex',
            'Sex',
            'sex',
            PET_SEX.map((s) => [s, PET_SEX_LABELS[s]]),
          )}
        </div>
        <div className="field-row">
          {select(
            'listing-age',
            'Age group',
            'ageGroup',
            [
              ['', 'Choose an age group'],
              ...AGE_GROUPS.map((a) => [a, AGE_GROUP_LABELS[a]] as [string, string]),
            ],
            errors.ageGroup?.message,
          )}
          {select('listing-size', 'Size', 'size', [
            ['', 'Not specified'],
            ...ANIMAL_SIZES.map((s) => [s, s] as [string, string]),
          ])}
        </div>
        <div className="field-row">
          <TextField label="Town or city" error={errors.city?.message} {...register('city')} />
        </div>
        <FieldWrapper
          id="listing-description"
          label="Personality and story"
          error={errors.description?.message}
        >
          <textarea
            id="listing-description"
            className="textarea"
            rows={5}
            aria-invalid={errors.description ? true : undefined}
            {...register('description')}
          />
        </FieldWrapper>
        <FieldWrapper
          id="listing-health"
          label="Health summary"
          optional
          error={errors.healthSummary?.message}
        >
          <textarea
            id="listing-health"
            className="textarea"
            rows={3}
            placeholder="Vaccinations, treatments, ongoing care needs"
            {...register('healthSummary')}
          />
        </FieldWrapper>
        <div className="checkbox-row">
          <label className="checkbox">
            <input type="checkbox" {...register('isVaccinated')} /> Vaccinated
          </label>
          <label className="checkbox">
            <input type="checkbox" {...register('isNeutered')} /> Spayed or neutered
          </label>
        </div>
        <div className="field-row">
          {select('listing-children', 'Good with children?', 'goodWithChildren', tri)}
          {select('listing-pets', 'Good with other pets?', 'goodWithPets', tri)}
        </div>
        <div className="form-actions">
          <Link to={backTo} className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={save.isPending} loadingText="Saving…">
            {listing ? 'Save changes' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </>
  );
}
