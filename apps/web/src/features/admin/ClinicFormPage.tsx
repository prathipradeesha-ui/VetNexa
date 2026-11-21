import { zodResolver } from '@hookform/resolvers/zod';
import { clinicFormSchema, WEEK_DAY_LABELS, WEEK_DAYS, type ClinicFormData } from '@vetnexa/shared';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { useAdminClinic, useSaveClinic, type AdminClinic } from './useAdmin';
import '../pets/pets.css';
import './admin.css';

/** Services are typed one per line (or comma-separated) and sent as a list. */
const formSchema = clinicFormSchema.extend({
  services: z
    .string()
    .transform((text) =>
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(clinicFormSchema.shape.services),
});
type FormInput = z.input<typeof formSchema>;

const emptyHours = Object.fromEntries(
  WEEK_DAYS.map((day) => [day, day === 'sun' ? 'Closed' : '08:00-18:00']),
) as FormInput['openingHours'];

function toFormValues(clinic?: AdminClinic): FormInput {
  if (!clinic) {
    return {
      name: '',
      description: '',
      addressLine: '',
      city: '',
      district: '',
      latitude: '',
      longitude: '',
      phone: '',
      email: '',
      website: '',
      services: '',
      openingHours: emptyHours,
      hasEmergency: false,
      isOpen24Hours: false,
    };
  }
  return {
    name: clinic.name,
    description: clinic.description ?? '',
    addressLine: clinic.addressLine,
    city: clinic.city,
    district: clinic.district,
    latitude: clinic.latitude?.toString() ?? '',
    longitude: clinic.longitude?.toString() ?? '',
    phone: clinic.phone,
    email: clinic.email ?? '',
    website: clinic.website ?? '',
    services: clinic.services.join('\n'),
    openingHours: { ...emptyHours, ...clinic.openingHours } as FormInput['openingHours'],
    hasEmergency: clinic.hasEmergency,
    isOpen24Hours: clinic.isOpen24Hours,
  };
}

export function ClinicFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useAdminClinic(id);
  const save = useSaveClinic(id);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, ClinicFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(),
  });

  useEffect(() => {
    if (existing.data) reset(toFormValues(existing.data));
  }, [existing.data, reset]);

  if (editing && existing.isPending) return <PageLoader label="Loading clinic…" />;
  if (editing && existing.isError) return <Alert tone="error">{existing.error.message}</Alert>;

  return (
    <>
      <Link to="/dashboard/admin/clinics" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to clinics
      </Link>
      <div className="page-header">
        <div>
          <h1>{editing ? `Edit ${existing.data?.name}` : 'Add a clinic'}</h1>
          <p>Details appear in the public clinic directory.</p>
        </div>
        {existing.data?.isActive && (
          <Link to={`/clinics/${existing.data.slug}`} className="btn btn--secondary btn--sm">
            <ExternalLink size={16} aria-hidden="true" /> View public page
          </Link>
        )}
      </div>

      <form
        className="card pet-form"
        noValidate
        onSubmit={handleSubmit((data) =>
          save.mutate(data, {
            onSuccess: () => navigate('/dashboard/admin/clinics'),
            onError: (error) => applyServerErrors(error, setError),
          }),
        )}
      >
        {save.isError && !hasFieldErrors(save.error) && (
          <Alert tone="error">{save.error.message}</Alert>
        )}

        <h2 className="form-section-title">Clinic</h2>
        <TextField label="Name" error={errors.name?.message} {...register('name')} />
        <FieldWrapper
          id="clinic-description"
          label="Description"
          optional
          error={errors.description?.message}
        >
          <textarea
            id="clinic-description"
            className="textarea"
            rows={3}
            {...register('description')}
          />
        </FieldWrapper>

        <h2 className="form-section-title">Location and contact</h2>
        <TextField
          label="Street address"
          error={errors.addressLine?.message}
          {...register('addressLine')}
        />
        <div className="field-row">
          <TextField label="Town or city" error={errors.city?.message} {...register('city')} />
          <TextField label="District" error={errors.district?.message} {...register('district')} />
        </div>
        <div className="field-row">
          <TextField
            label="Latitude"
            optional
            inputMode="decimal"
            hint="For the map link, e.g. 6.9271"
            error={errors.latitude?.message}
            {...register('latitude')}
          />
          <TextField
            label="Longitude"
            optional
            inputMode="decimal"
            hint="e.g. 79.8612"
            error={errors.longitude?.message}
            {...register('longitude')}
          />
        </div>
        <div className="field-row">
          <TextField
            label="Phone"
            type="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <TextField
            label="Email"
            type="email"
            optional
            error={errors.email?.message}
            {...register('email')}
          />
        </div>
        <TextField
          label="Website"
          type="url"
          optional
          placeholder="https://"
          error={errors.website?.message}
          {...register('website')}
        />

        <h2 className="form-section-title">Services and hours</h2>
        <FieldWrapper
          id="clinic-services"
          label="Services"
          hint="One per line, e.g. Vaccination"
          error={errors.services?.message}
        >
          <textarea id="clinic-services" className="textarea" rows={4} {...register('services')} />
        </FieldWrapper>

        <fieldset className="hours-grid">
          <legend className="field__label">Opening hours</legend>
          <p className="field__hint">Use HH:MM-HH:MM (24-hour clock) or "Closed".</p>
          {WEEK_DAYS.map((day) => (
            <TextField
              key={day}
              label={WEEK_DAY_LABELS[day]}
              error={errors.openingHours?.[day]?.message}
              {...register(`openingHours.${day}`)}
            />
          ))}
        </fieldset>

        <label className="pet-form__checkbox admin-checkbox">
          <input type="checkbox" {...register('hasEmergency')} /> Offers emergency care
        </label>
        <label className="pet-form__checkbox admin-checkbox">
          <input type="checkbox" {...register('isOpen24Hours')} /> Open 24 hours
        </label>

        <div className="form-actions">
          <Link to="/dashboard/admin/clinics" className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={save.isPending} loadingText="Saving…">
            {editing ? 'Save changes' : 'Add clinic'}
          </Button>
        </div>
      </form>
    </>
  );
}
