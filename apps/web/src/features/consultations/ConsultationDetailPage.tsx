import { zodResolver } from '@hookform/resolvers/zod';
import {
  CONSULTATION_TYPE_LABELS,
  consultationOutcomeSchema,
  formatAppointment,
  formatPetAge,
  isoToColombo,
  type ConsultationOutcomeData,
  type ConsultationOutcomeInput,
} from '@vetnexa/shared';
import { ArrowLeft, ClipboardCheck, FileHeart, Mail, MapPin, Phone, Video } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { formatDate } from '../pets/format';
import { PetAvatar } from '../pets/PetAvatar';
import { StatusBadge } from './ConsultationBits';
import { useConsultation, useConsultationActions, type Consultation } from './useConsultations';
import '../pets/pets.css';
import './consultations.css';

export function ConsultationDetailPage() {
  const { id = '' } = useParams();
  const consultation = useConsultation(id);

  return (
    <>
      <Link to="/dashboard/consultations" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to consultations
      </Link>
      {consultation.isPending && <PageLoader label="Loading consultation…" />}
      {consultation.isError && <Alert tone="error">{consultation.error.message}</Alert>}
      {consultation.isSuccess && <ConsultationDetail consultation={consultation.data} />}
    </>
  );
}

function ConsultationDetail({ consultation }: { consultation: Consultation }) {
  const location = useLocation();
  const booked = (location.state as { booked?: boolean } | null)?.booked;
  const { setStatus } = useConsultationActions(consultation.id);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const { pet, actions } = consultation;
  const age = formatPetAge(pet.dateOfBirth);

  return (
    <>
      {booked && (
        <Alert tone="success" title="Request sent">
          {consultation.vet?.name} will confirm your appointment. You can follow its status here.
        </Alert>
      )}

      <div className="page-header">
        <div>
          <h1>Consultation for {pet.name}</h1>
          <p>{formatAppointment(consultation.scheduledAt)}</p>
        </div>
        <StatusBadge status={consultation.status} />
      </div>

      <div className="consultation-layout">
        <div className="consultation-layout__main">
          <section className="card" aria-labelledby="visit-heading">
            <h2 id="visit-heading" className="card-title">
              Visit details
            </h2>
            <dl className="detail-list">
              <div>
                <dt>Patient</dt>
                <dd className="patient-cell">
                  <PetAvatar
                    name={pet.name}
                    species={pet.species}
                    photoUrl={pet.photoUrl}
                    size={36}
                  />
                  <span>
                    {pet.name}
                    <span className="muted"> {[pet.breed, age].filter(Boolean).join(' · ')}</span>
                  </span>
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>
                  {consultation.type === 'VIDEO' ? (
                    <Video size={16} aria-hidden="true" />
                  ) : (
                    <MapPin size={16} aria-hidden="true" />
                  )}{' '}
                  {CONSULTATION_TYPE_LABELS[consultation.type]}
                </dd>
              </div>
              <div>
                <dt>Veterinarian</dt>
                <dd>{consultation.vet?.name ?? 'Not assigned'}</dd>
              </div>
              {consultation.clinic && (
                <div>
                  <dt>Clinic</dt>
                  <dd>
                    <Link to={`/clinics/${consultation.clinic.slug}`}>
                      {consultation.clinic.name}
                    </Link>
                    , {consultation.clinic.city}
                  </dd>
                </div>
              )}
              <div>
                <dt>Reason</dt>
                <dd className="pre-line">{consultation.reason}</dd>
              </div>
            </dl>
          </section>

          {consultation.status === 'COMPLETED' && (
            <section className="card outcome-card" aria-labelledby="outcome-heading">
              <h2 id="outcome-heading" className="card-title">
                <ClipboardCheck size={20} aria-hidden="true" /> Outcome
              </h2>
              <dl className="detail-list">
                <div>
                  <dt>Findings</dt>
                  <dd className="pre-line">{consultation.diagnosis}</dd>
                </div>
                <div>
                  <dt>Treatment and advice</dt>
                  <dd className="pre-line">{consultation.treatment}</dd>
                </div>
                {consultation.followUpAt && (
                  <div>
                    <dt>Follow-up</dt>
                    <dd>{formatDate(isoToColombo(consultation.followUpAt).date)}</dd>
                  </div>
                )}
              </dl>
              <p className="field__hint">
                This outcome has been added to {pet.name}’s health records.
              </p>
            </section>
          )}

          {consultation.vetNotes && (
            <section className="card" aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="card-title">
                Notes
              </h2>
              <p className="pre-line">{consultation.vetNotes}</p>
            </section>
          )}

          {actions.canComplete && <CompleteForm consultation={consultation} />}
        </div>

        <aside className="consultation-layout__side">
          {consultation.owner && (
            <section className="card" aria-labelledby="owner-heading">
              <h2 id="owner-heading" className="card-title">
                Owner
              </h2>
              <ul className="contact-list">
                <li>
                  <Phone size={18} aria-hidden="true" />
                  <div>
                    <strong>{consultation.owner.name}</strong>
                    {consultation.owner.phone ? (
                      <a href={`tel:${consultation.owner.phone}`}>{consultation.owner.phone}</a>
                    ) : (
                      <span>No phone number</span>
                    )}
                  </div>
                </li>
                <li>
                  <Mail size={18} aria-hidden="true" />
                  <div>
                    <a href={`mailto:${consultation.owner.email}`}>{consultation.owner.email}</a>
                  </div>
                </li>
              </ul>
            </section>
          )}

          {(actions.canConfirm || actions.canCancel || actions.canViewPatient) && (
            <section className="card consultation-actions" aria-labelledby="actions-heading">
              <h2 id="actions-heading" className="card-title">
                Actions
              </h2>
              {setStatus.isError && <Alert tone="error">{setStatus.error.message}</Alert>}
              {actions.canViewPatient && (
                <Link
                  to={`/dashboard/patients/${pet.id}`}
                  className="btn btn--secondary btn--block"
                >
                  <FileHeart size={18} aria-hidden="true" /> View {pet.name}’s health history
                </Link>
              )}
              {actions.canConfirm && (
                <Button
                  block
                  onClick={() => setStatus.mutate({ status: 'CONFIRMED' })}
                  loading={setStatus.isPending && setStatus.variables?.status === 'CONFIRMED'}
                >
                  Confirm appointment
                </Button>
              )}
              {actions.canCancel && !cancelling && (
                <Button variant="ghost" block onClick={() => setCancelling(true)}>
                  {actions.canConfirm ? 'Decline request' : 'Cancel appointment'}
                </Button>
              )}
              {cancelling && (
                <div className="cancel-box">
                  <label htmlFor="cancel-note" className="field__label">
                    Reason{' '}
                    <span className="field__optional">(optional, shared with the other party)</span>
                  </label>
                  <textarea
                    id="cancel-note"
                    className="textarea"
                    rows={2}
                    value={cancelNote}
                    onChange={(event) => setCancelNote(event.target.value)}
                  />
                  <div className="form-actions">
                    <Button variant="secondary" size="sm" onClick={() => setCancelling(false)}>
                      Keep it
                    </Button>
                    <Button
                      size="sm"
                      className="btn--danger"
                      loading={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate(
                          { status: 'CANCELLED', note: cancelNote.trim() || undefined },
                          { onSuccess: () => setCancelling(false) },
                        )
                      }
                    >
                      Confirm cancellation
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

/** The vet's form for recording the outcome. Saving also adds a health record for the pet. */
function CompleteForm({ consultation }: { consultation: Consultation }) {
  const { complete } = useConsultationActions(consultation.id);
  const today = isoToColombo(new Date().toISOString()).date;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ConsultationOutcomeInput, unknown, ConsultationOutcomeData>({
    resolver: zodResolver(consultationOutcomeSchema),
    defaultValues: { diagnosis: '', treatment: '', vetNotes: '', followUpDate: '' },
  });

  return (
    <form
      className="card"
      aria-labelledby="complete-heading"
      onSubmit={handleSubmit((data) =>
        complete.mutate(data, { onError: (error) => applyServerErrors(error, setError) }),
      )}
      noValidate
    >
      <h2 id="complete-heading" className="card-title">
        <ClipboardCheck size={20} aria-hidden="true" /> Record the outcome
      </h2>
      <p className="muted">
        Saving completes the consultation and adds a record to {consultation.pet.name}’s health
        history that the owner can read but not change.
      </p>
      {complete.isError && !hasFieldErrors(complete.error) && (
        <Alert tone="error">{complete.error.message}</Alert>
      )}
      <FieldWrapper
        id="outcome-diagnosis"
        label="Findings / diagnosis"
        error={errors.diagnosis?.message}
      >
        <textarea
          id="outcome-diagnosis"
          className="textarea"
          rows={3}
          aria-invalid={errors.diagnosis ? true : undefined}
          {...register('diagnosis')}
        />
      </FieldWrapper>
      <FieldWrapper
        id="outcome-treatment"
        label="Treatment and advice"
        error={errors.treatment?.message}
      >
        <textarea
          id="outcome-treatment"
          className="textarea"
          rows={3}
          aria-invalid={errors.treatment ? true : undefined}
          {...register('treatment')}
        />
      </FieldWrapper>
      <div className="field-row">
        <TextField
          label="Follow-up date"
          type="date"
          optional
          min={today}
          hint="Creates a reminder for the owner"
          error={errors.followUpDate?.message}
          {...register('followUpDate')}
        />
      </div>
      <FieldWrapper
        id="outcome-notes"
        label="Additional notes for the owner"
        optional
        error={errors.vetNotes?.message}
      >
        <textarea id="outcome-notes" className="textarea" rows={2} {...register('vetNotes')} />
      </FieldWrapper>
      <div className="form-actions">
        <Button type="submit" loading={complete.isPending} loadingText="Saving…">
          Complete consultation
        </Button>
      </div>
    </form>
  );
}
