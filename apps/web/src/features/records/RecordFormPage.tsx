import { zodResolver } from '@hookform/resolvers/zod';
import {
  HEALTH_RECORD_LABELS,
  HEALTH_RECORD_TYPES,
  healthRecordSchema,
  RECURRING_RECORD_TYPES,
  type HealthRecordData,
  type HealthRecordInput,
} from '@vetnexa/shared';
import { ArrowLeft } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { usePet } from '../pets/usePets';
import { useRecords, useSaveRecord, type HealthRecord } from './useRecords';
import '../pets/pets.css';

/** Route wrapper for adding a record, or editing one (loaded from the pet's record list). */
export function RecordFormPage() {
  const { petId = '', recordId } = useParams();
  const pet = usePet(petId);
  const records = useRecords(petId);

  if (pet.isPending || (recordId && records.isPending)) return <PageLoader />;
  if (pet.isError) return <Alert tone="error">{pet.error.message}</Alert>;

  const record = recordId ? records.data?.find((r) => r.id === recordId) : undefined;
  if (recordId && !record) return <Alert tone="error">Health record not found.</Alert>;
  if (record && !record.canEdit) {
    return (
      <Alert tone="warning">
        This record was added by a veterinarian and can only be changed by them.
      </Alert>
    );
  }

  return <RecordForm petId={petId} petName={pet.data.name} record={record} />;
}

function toFormValues(record?: HealthRecord): HealthRecordInput {
  return {
    type: record?.type ?? ('' as HealthRecordInput['type']),
    title: record?.title ?? '',
    description: record?.description ?? '',
    recordDate: record?.recordDate ?? new Date().toISOString().slice(0, 10),
    nextDueDate: record?.nextDueDate ?? '',
    vetName: record?.vetName ?? '',
    clinicName: record?.clinicName ?? '',
  };
}

function RecordForm({
  petId,
  petName,
  record,
}: {
  petId: string;
  petName: string;
  record?: HealthRecord;
}) {
  const navigate = useNavigate();
  const save = useSaveRecord(petId, record?.id);
  const today = new Date().toISOString().slice(0, 10);
  const backTo = `/dashboard/pets/${petId}`;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<HealthRecordInput, unknown, HealthRecordData>({
    resolver: zodResolver(healthRecordSchema),
    defaultValues: toFormValues(record),
  });
  const type = useWatch({ control, name: 'type' });
  const suggestsDueDate = RECURRING_RECORD_TYPES.includes(type);

  const onSubmit = (data: HealthRecordData) =>
    save.mutate(data, {
      onSuccess: () => navigate(backTo, { state: { saved: 'record' } }),
      onError: (error) => applyServerErrors(error, setError),
    });

  return (
    <>
      <Link to={backTo} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to {petName}
      </Link>
      <div className="page-header">
        <div>
          <h1>{record ? 'Edit health record' : `Add a health record for ${petName}`}</h1>
          <p>Record vaccinations, treatments, check-ups, medication, allergies and surgeries.</p>
        </div>
      </div>

      <form className="card pet-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {save.isError && !hasFieldErrors(save.error) && (
          <Alert tone="error">{save.error.message}</Alert>
        )}

        <div className="field-row">
          <FieldWrapper id="record-type" label="Type" error={errors.type?.message}>
            <select
              id="record-type"
              className="select"
              aria-invalid={errors.type ? true : undefined}
              {...register('type')}
            >
              <option value="">Choose a type</option>
              {HEALTH_RECORD_TYPES.map((value) => (
                <option key={value} value={value}>
                  {HEALTH_RECORD_LABELS[value]}
                </option>
              ))}
            </select>
          </FieldWrapper>
          <TextField
            label="Title"
            placeholder="e.g. Anti-rabies vaccine"
            error={errors.title?.message}
            {...register('title')}
          />
        </div>

        <div className="field-row">
          <TextField
            label="Date"
            type="date"
            max={today}
            error={errors.recordDate?.message}
            {...register('recordDate')}
          />
          <TextField
            label="Next due"
            type="date"
            optional
            min={today}
            hint={
              suggestsDueDate
                ? 'Add the booster or repeat date to get a reminder'
                : 'Only needed if this has to be repeated'
            }
            error={errors.nextDueDate?.message}
            {...register('nextDueDate')}
          />
        </div>

        <div className="field-row">
          <TextField
            label="Veterinarian"
            optional
            placeholder="e.g. Dr. Ruwan Senanayake"
            error={errors.vetName?.message}
            {...register('vetName')}
          />
          <TextField
            label="Clinic"
            optional
            error={errors.clinicName?.message}
            {...register('clinicName')}
          />
        </div>

        <FieldWrapper
          id="record-description"
          label="Details"
          optional
          error={errors.description?.message}
        >
          <textarea
            id="record-description"
            className="textarea"
            rows={4}
            placeholder="Dosage, batch number, the vet's advice or anything else worth keeping"
            {...register('description')}
          />
        </FieldWrapper>

        <div className="form-actions">
          <Link to={backTo} className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={save.isPending} loadingText="Saving…">
            {record ? 'Save changes' : 'Add record'}
          </Button>
        </div>
      </form>
    </>
  );
}
