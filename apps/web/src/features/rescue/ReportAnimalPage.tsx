import { zodResolver } from '@hookform/resolvers/zod';
import {
  RESCUE_URGENCIES,
  RESCUE_URGENCY_LABELS,
  rescueReportSchema,
  SPECIES,
  SPECIES_LABELS,
  type RescueReportData,
  type RescueReportInput,
} from '@vetnexa/shared';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/useAuth';
import { useCreateReport } from './useRescue';
import '../pets/pets.css';
import './rescue.css';

export function ReportAnimalPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const create = useCreateReport();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RescueReportInput, unknown, RescueReportData>({
    resolver: zodResolver(rescueReportSchema),
    defaultValues: { urgency: 'MEDIUM', city: user?.city ?? '', contactPhone: user?.phone ?? '' },
  });

  return (
    <>
      <Link to="/dashboard/rescue" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>
      <div className="page-header">
        <div>
          <h1>Report an animal in need</h1>
          <p>Registered rescuers nearby will see your report and contact you.</p>
        </div>
      </div>
      <Alert tone="warning">
        If the animal is badly hurt, call a nearby emergency clinic as well —{' '}
        <Link to="/clinics?emergency=true">find one here</Link>. Do not put yourself in danger
        approaching a frightened or aggressive animal.
      </Alert>
      <form
        className="card pet-form"
        noValidate
        onSubmit={handleSubmit((data) =>
          create.mutate(data, {
            onSuccess: (report) =>
              navigate(`/dashboard/rescue/${report.id}`, { state: { created: true } }),
            onError: (error) => applyServerErrors(error, setError),
          }),
        )}
      >
        {create.isError && !hasFieldErrors(create.error) && (
          <Alert tone="error">{create.error.message}</Alert>
        )}
        <div className="field-row">
          <FieldWrapper id="report-species" label="Animal" error={errors.species?.message}>
            <select
              id="report-species"
              className="select"
              aria-invalid={errors.species ? true : undefined}
              {...register('species')}
            >
              <option value="">Choose the type of animal</option>
              {SPECIES.map((species) => (
                <option key={species} value={species}>
                  {SPECIES_LABELS[species]}
                </option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper
            id="report-urgency"
            label="How urgent is it?"
            error={errors.urgency?.message}
          >
            <select id="report-urgency" className="select" {...register('urgency')}>
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
          placeholder="e.g. Injured puppy near the bus stand"
          error={errors.title?.message}
          {...register('title')}
        />
        <FieldWrapper
          id="report-description"
          label="What did you see?"
          error={errors.description?.message}
        >
          <textarea
            id="report-description"
            className="textarea"
            rows={4}
            placeholder="Condition of the animal, injuries, behaviour, how long it has been there"
            aria-invalid={errors.description ? true : undefined}
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
        <div className="field-row">
          <TextField
            label="Phone number for rescuers"
            type="tel"
            optional
            hint="Shared only with registered rescuers"
            error={errors.contactPhone?.message}
            {...register('contactPhone')}
          />
        </div>
        <p className="field__hint">You can add a photo on the next page.</p>
        <div className="form-actions">
          <Link to="/dashboard/rescue" className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={create.isPending} loadingText="Sending report…">
            Send report
          </Button>
        </div>
      </form>
    </>
  );
}
