import { zodResolver } from '@hookform/resolvers/zod';
import {
  adoptionApplicationSchema,
  APPLICATION_STATUS_LABELS,
  HOME_TYPES,
  SPECIES_LABELS,
  type AdoptionApplicationData,
  type AdoptionApplicationInput,
} from '@vetnexa/shared';
import { ArrowLeft, HeartHandshake } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/useAuth';
import {
  ListingLocation,
  ListingPhoto,
  ListingStatusBadge,
  ListingTraits,
  listingSummary,
} from './ListingBits';
import { useApply, useListing, type ListingDetail } from './useAdoption';
import './adoption.css';

export function AdoptionDetailPage() {
  const { id = '' } = useParams();
  const listing = useListing(id);

  return (
    <div className="container clinic-detail">
      <Link to="/adopt" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> All animals
      </Link>
      {listing.isPending && <PageLoader label="Loading…" />}
      {listing.isError && <Alert tone="error">{listing.error.message}</Alert>}
      {listing.isSuccess && <ListingProfile listing={listing.data} />}
    </div>
  );
}

function ListingProfile({ listing }: { listing: ListingDetail }) {
  return (
    <div className="listing-layout">
      <div>
        <ListingPhoto listing={listing} className="listing-photo--large" />
      </div>
      <div className="listing-layout__info">
        <div className="adopt-card__title">
          <h1>{listing.name}</h1>
          <ListingStatusBadge status={listing.status} />
        </div>
        <p className="lead">{listingSummary(listing) || SPECIES_LABELS[listing.species]}</p>
        <ListingLocation city={listing.city} />
        <ListingTraits listing={listing} />

        <section aria-labelledby="about-heading" className="listing-section">
          <h2 id="about-heading">About {listing.name}</h2>
          <p className="pre-line">{listing.description}</p>
          {listing.healthSummary && (
            <div className="callout">
              <strong>Health</strong>
              <p>{listing.healthSummary}</p>
            </div>
          )}
          {listing.rescuer && (
            <p className="muted">Cared for by {listing.rescuer}, a registered VetNexa rescuer.</p>
          )}
        </section>

        <ApplySection listing={listing} />
      </div>
    </div>
  );
}

function ApplySection({ listing }: { listing: ListingDetail }) {
  const { data: user } = useCurrentUser();
  const location = useLocation();

  if (listing.isMine) {
    return (
      <Alert tone="info">
        This is your listing.{' '}
        <Link to={`/dashboard/listings/${listing.id}`}>Manage it and review applications</Link>.
      </Alert>
    );
  }
  if (listing.myApplication && listing.myApplication.status !== 'WITHDRAWN') {
    return (
      <Alert
        tone="success"
        title={`Application ${APPLICATION_STATUS_LABELS[listing.myApplication.status].toLowerCase()}`}
      >
        You applied to adopt {listing.name}. Follow its progress in{' '}
        <Link to="/dashboard/applications">My applications</Link>.
      </Alert>
    );
  }
  if (!user) {
    return (
      <p className="review-prompt">
        <HeartHandshake size={18} aria-hidden="true" />
        <span>
          Would you like to adopt {listing.name}?{' '}
          <Link to="/login" state={{ from: location.pathname }}>
            Sign in
          </Link>{' '}
          or <Link to="/register">create a free account</Link> to apply.
        </span>
      </p>
    );
  }
  if (!listing.canApply) {
    return (
      <p className="muted review-prompt">Adoption applications are made from pet owner accounts.</p>
    );
  }
  return <ApplicationForm listing={listing} defaultPhone={user.phone ?? ''} />;
}

function ApplicationForm({
  listing,
  defaultPhone,
}: {
  listing: ListingDetail;
  defaultPhone: string;
}) {
  const apply = useApply(listing.id);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdoptionApplicationInput, unknown, AdoptionApplicationData>({
    resolver: zodResolver(adoptionApplicationSchema),
    defaultValues: {
      contactPhone: defaultPhone,
      hasChildren: false,
      hasOtherPets: false,
      message: '',
    },
  });

  return (
    <form
      className="review-form"
      onSubmit={handleSubmit((data) =>
        apply.mutate(data, { onError: (error) => applyServerErrors(error, setError) }),
      )}
      noValidate
    >
      <h2>Apply to adopt {listing.name}</h2>
      <p className="muted">
        The rescuer reads every application and will call you to arrange a meeting.
      </p>
      {apply.isError && !hasFieldErrors(apply.error) && (
        <Alert tone="error">{apply.error.message}</Alert>
      )}
      <div className="field-row">
        <FieldWrapper id="apply-home" label="Your home" error={errors.homeType?.message}>
          <select
            id="apply-home"
            className="select"
            aria-invalid={errors.homeType ? true : undefined}
            {...register('homeType')}
          >
            <option value="">Choose your type of home</option>
            {HOME_TYPES.map((home) => (
              <option key={home} value={home}>
                {home}
              </option>
            ))}
          </select>
        </FieldWrapper>
        <TextField
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          error={errors.contactPhone?.message}
          {...register('contactPhone')}
        />
      </div>
      <div className="checkbox-row">
        <label className="checkbox">
          <input type="checkbox" {...register('hasChildren')} /> Children live in my home
        </label>
        <label className="checkbox">
          <input type="checkbox" {...register('hasOtherPets')} /> I have other pets
        </label>
      </div>
      <FieldWrapper
        id="apply-message"
        label={`Why would you like to adopt ${listing.name}?`}
        error={errors.message?.message}
      >
        <textarea
          id="apply-message"
          className="textarea"
          rows={5}
          placeholder="Tell the rescuer about your home, daily routine and experience with animals."
          aria-invalid={errors.message ? true : undefined}
          {...register('message')}
        />
      </FieldWrapper>
      <div className="form-actions">
        <Button type="submit" loading={apply.isPending} loadingText="Sending…">
          Send application
        </Button>
      </div>
    </form>
  );
}
