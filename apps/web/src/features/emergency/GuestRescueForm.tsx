import { zodResolver } from '@hookform/resolvers/zod';
import {
  guestRescueReportSchema,
  RESCUE_URGENCIES,
  RESCUE_URGENCY_LABELS,
  SPECIES,
  SPECIES_LABELS,
  type GuestRescueReportData,
  type GuestRescueReportInput,
} from '@vetnexa/shared';
import { CheckCircle2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { LocationPicker } from '../../components/maps/LocationPicker';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { useGuestRescueReport } from './useEmergency';

/** Report an animal in need without an account; rescuers call the reporter back. */
export function GuestRescueForm() {
  const report = useGuestRescueReport();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<GuestRescueReportInput, unknown, GuestRescueReportData>({
    resolver: zodResolver(guestRescueReportSchema),
    defaultValues: { urgency: 'HIGH' },
  });
  const [latitude, longitude] = useWatch({ control, name: ['latitude', 'longitude'] });

  if (report.isSuccess) {
    return (
      <div className="guest-report-done" role="status">
        <CheckCircle2 size={32} aria-hidden="true" />
        <h3>Thank you. Rescuers can now see your report.</h3>
        <p>
          Your reference number is <strong>{report.data.reference}</strong>. A rescuer may call you
          on the number you gave. If the animal is badly hurt, please also call an emergency clinic.
        </p>
        <p>
          <Link to="/register">Create a free account</Link> to follow your reports and get updates.
        </p>
      </div>
    );
  }

  return (
    <form
      className="guest-report"
      noValidate
      onSubmit={handleSubmit((data) =>
        report.mutate(data, { onError: (error) => applyServerErrors(error, setError) }),
      )}
    >
      {report.isError && !hasFieldErrors(report.error) && (
        <Alert tone="error">{report.error.message}</Alert>
      )}
      <div className="field-row">
        <FieldWrapper id="guest-report-species" label="Animal" error={errors.species?.message}>
          <select id="guest-report-species" className="select" {...register('species')}>
            <option value="">Dog or cat?</option>
            {SPECIES.map((species) => (
              <option key={species} value={species}>
                {SPECIES_LABELS[species]}
              </option>
            ))}
          </select>
        </FieldWrapper>
        <FieldWrapper id="guest-report-urgency" label="How urgent?" error={errors.urgency?.message}>
          <select id="guest-report-urgency" className="select" {...register('urgency')}>
            {RESCUE_URGENCIES.map((urgency) => (
              <option key={urgency} value={urgency}>
                {RESCUE_URGENCY_LABELS[urgency]}
              </option>
            ))}
          </select>
        </FieldWrapper>
      </div>
      <TextField
        label="Short title"
        placeholder="e.g. Injured dog near the bus stand"
        error={errors.title?.message}
        {...register('title')}
      />
      <FieldWrapper
        id="guest-report-description"
        label="What did you see?"
        error={errors.description?.message}
      >
        <textarea
          id="guest-report-description"
          className="textarea"
          rows={3}
          placeholder="Injuries, behaviour, how long it has been there"
          {...register('description')}
        />
      </FieldWrapper>
      <div className="field-row">
        <TextField
          label="Where exactly?"
          placeholder="Landmark, street or building"
          error={errors.locationText?.message}
          {...register('locationText')}
        />
        <TextField label="Town or city" error={errors.city?.message} {...register('city')} />
      </div>
      <FieldWrapper id="guest-report-location" label="Map location" optional>
        <LocationPicker
          value={latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null}
          onChange={(position) => {
            setValue('latitude', position?.lat ?? null);
            setValue('longitude', position?.lng ?? null);
          }}
          privacyNote="The exact spot is shown only to the rescuer who takes this on and to administrators."
        />
      </FieldWrapper>
      <div className="field-row">
        <TextField
          label="Your name"
          autoComplete="name"
          error={errors.reporterName?.message}
          {...register('reporterName')}
        />
        <TextField
          label="Your phone number"
          type="tel"
          autoComplete="tel"
          hint="Shared only with registered rescuers"
          error={errors.contactPhone?.message}
          {...register('contactPhone')}
        />
      </div>
      <Button type="submit" loading={report.isPending} loadingText="Sending…">
        Send report
      </Button>
    </form>
  );
}
