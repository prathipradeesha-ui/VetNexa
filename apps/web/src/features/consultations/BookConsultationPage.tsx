import { zodResolver } from '@hookform/resolvers/zod';
import {
  BOOKING_HOURS,
  CONSULTATION_TYPE_LABELS,
  CONSULTATION_TYPES,
  consultationRequestSchema,
  isoToColombo,
  MAX_DAYS_AHEAD,
  type ConsultationRequestData,
  type ConsultationRequestInput,
} from '@vetnexa/shared';
import { ArrowLeft, Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { usePets } from '../pets/usePets';
import { useBookableVets, useRequestConsultation } from './useConsultations';
import '../pets/pets.css';
import './consultations.css';

/** Half-hour slots from 08:00 to 19:30. */
function timeSlots() {
  const slots: string[] = [];
  for (let minutes = 8 * 60; ; minutes += 30) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 ? '30' : '00'}`;
    slots.push(time);
    if (time === BOOKING_HOURS.last) return slots;
  }
}
const slotLabel = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'am' : 'pm'}`;
};

export function BookConsultationPage() {
  const pets = usePets();
  const vets = useBookableVets();

  if (pets.isPending || vets.isPending) return <PageLoader />;
  if (pets.isError) return <Alert tone="error">{pets.error.message}</Alert>;
  if (vets.isError) return <Alert tone="error">{vets.error.message}</Alert>;

  if (pets.data.length === 0) {
    return (
      <div className="card empty-state">
        <p>Add a pet profile before booking a consultation.</p>
        <Link to="/dashboard/pets/new" className="btn btn--primary btn--sm">
          Add a pet
        </Link>
      </div>
    );
  }
  return <BookingForm pets={pets.data} vets={vets.data} />;
}

function BookingForm({
  pets,
  vets,
}: {
  pets: { id: string; name: string }[];
  vets: ReturnType<typeof useBookableVets>['data'] & object;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const book = useRequestConsultation();
  // Date limits for the picker, worked out once when the form opens (Sri Lanka dates).
  const [{ today, lastDay }] = useState(() => ({
    today: isoToColombo(new Date().toISOString()).date,
    lastDay: isoToColombo(new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000).toISOString()).date,
  }));

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ConsultationRequestInput, unknown, ConsultationRequestData>({
    resolver: zodResolver(consultationRequestSchema),
    defaultValues: {
      petId: params.get('petId') ?? (pets.length === 1 ? pets[0]!.id : ''),
      vetId: params.get('vetId') ?? '',
      type: 'IN_PERSON',
      date: '',
      time: '',
      reason: '',
    },
  });

  const onSubmit = (data: ConsultationRequestData) =>
    book.mutate(data, {
      onSuccess: (consultation) =>
        navigate(`/dashboard/consultations/${consultation.id}`, { state: { booked: true } }),
      onError: (error) => applyServerErrors(error, setError),
    });

  // Group vets by clinic for an easier choice.
  const byClinic = new Map<string, typeof vets>();
  for (const vet of vets) {
    const key = vet.clinic ? `${vet.clinic.name}, ${vet.clinic.city}` : 'Independent';
    byClinic.set(key, [...(byClinic.get(key) ?? []), vet]);
  }

  return (
    <>
      <Link to="/dashboard/consultations" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to consultations
      </Link>
      <div className="page-header">
        <div>
          <h1>Book a consultation</h1>
          <p>The veterinarian will confirm your request, usually within a few hours.</p>
        </div>
      </div>

      <form className="card pet-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {book.isError && !hasFieldErrors(book.error) && (
          <Alert tone="error">{book.error.message}</Alert>
        )}

        <div className="field-row">
          <FieldWrapper id="book-pet" label="Pet" error={errors.petId?.message}>
            <select
              id="book-pet"
              className="select"
              aria-invalid={errors.petId ? true : undefined}
              {...register('petId')}
            >
              <option value="">Choose a pet</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper id="book-type" label="Consultation type" error={errors.type?.message}>
            <select id="book-type" className="select" {...register('type')}>
              {CONSULTATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONSULTATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>

        <FieldWrapper id="book-vet" label="Veterinarian" error={errors.vetId?.message}>
          <select
            id="book-vet"
            className="select"
            aria-invalid={errors.vetId ? true : undefined}
            {...register('vetId')}
          >
            <option value="">Choose a veterinarian</option>
            {[...byClinic.entries()].map(([clinic, clinicVets]) => (
              <optgroup key={clinic} label={clinic}>
                {clinicVets.map((vet) => (
                  <option key={vet.id} value={vet.id}>
                    {vet.name}
                    {vet.specialization ? ` — ${vet.specialization}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FieldWrapper>

        <div className="field-row">
          <FieldWrapper id="book-date" label="Date" error={errors.date?.message}>
            <input
              id="book-date"
              type="date"
              className="input"
              min={today}
              max={lastDay}
              aria-invalid={errors.date ? true : undefined}
              {...register('date')}
            />
          </FieldWrapper>
          <FieldWrapper id="book-time" label="Time" error={errors.time?.message}>
            <select
              id="book-time"
              className="select"
              aria-invalid={errors.time ? true : undefined}
              {...register('time')}
            >
              <option value="">Choose a time</option>
              {timeSlots().map((time) => (
                <option key={time} value={time}>
                  {slotLabel(time)}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>
        <p className="field__hint booking-hint">
          <Info size={14} aria-hidden="true" /> Times are Sri Lanka time. Appointments last up to 30
          minutes.
        </p>

        <FieldWrapper id="book-reason" label="Reason for the visit" error={errors.reason?.message}>
          <textarea
            id="book-reason"
            className="textarea"
            rows={4}
            placeholder="Describe the symptoms or what you would like to discuss, e.g. limping on the right hind leg since yesterday"
            aria-invalid={errors.reason ? true : undefined}
            {...register('reason')}
          />
        </FieldWrapper>

        <Alert tone="warning">
          For emergencies such as heavy bleeding, breathing difficulty or collapse, do not wait for
          a booking: <Link to="/clinics?emergency=true">find an emergency clinic</Link> and call
          them now.
        </Alert>

        <div className="form-actions">
          <Link to="/dashboard/consultations" className="btn btn--secondary">
            Cancel
          </Link>
          <Button type="submit" loading={book.isPending} loadingText="Sending request…">
            Request consultation
          </Button>
        </div>
      </form>
    </>
  );
}
