import {
  formatPetAge,
  HEALTH_RECORD_LABELS,
  PET_SEX_LABELS,
  SPECIES_LABELS,
  type PetSex,
} from '@vetnexa/shared';
import { ArrowLeft, Lock, Phone, ShieldAlert } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { formatDate } from '../pets/format';
import { PetAvatar } from '../pets/PetAvatar';
import { RecordTypeIcon } from '../records/RecordTypeIcon';
import { usePatient } from './useConsultations';
import '../pets/pets.css';
import '../records/records.css';
import './consultations.css';

/**
 * The vet's read-only view of a patient: profile, allergies highlighted, and the full history.
 * The API only allows this while the vet has a consultation with the pet.
 */
export function PatientPage() {
  const { petId = '' } = useParams();
  const patient = usePatient(petId);

  if (patient.isPending) return <PageLoader label="Loading patient…" />;
  if (patient.isError) {
    return (
      <>
        <Link to="/dashboard/consultations" className="back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to consultations
        </Link>
        <Alert tone="error">
          {patient.error.message}. Patient records are available while you have a consultation with
          this pet.
        </Alert>
      </>
    );
  }

  const pet = patient.data;
  const allergies = pet.records.filter((record) => record.type === 'ALLERGY');

  return (
    <>
      <button
        type="button"
        className="back-link link-button link-button--primary"
        onClick={() => history.back()}
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </button>

      <section className="card pet-profile">
        <div className="pet-profile__photo">
          <PetAvatar name={pet.name} species={pet.species} photoUrl={pet.photoUrl} size={120} />
        </div>
        <div className="pet-profile__body">
          <div className="pet-profile__header">
            <h1>{pet.name}</h1>
            <span className="badge badge--neutral">
              <Lock size={12} aria-hidden="true" /> Read-only patient view
            </span>
          </div>
          {allergies.length > 0 && (
            <Alert tone="error" title="Allergies">
              {allergies.map((record) => record.title).join(', ')}
            </Alert>
          )}
          <dl className="detail-list">
            <div>
              <dt>Species / breed</dt>
              <dd>
                {SPECIES_LABELS[pet.species]}
                {pet.breed ? `, ${pet.breed}` : ''}
              </dd>
            </div>
            <div>
              <dt>Sex</dt>
              <dd>
                {PET_SEX_LABELS[pet.sex as PetSex]}
                {pet.isNeutered ? ' (neutered)' : ''}
              </dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>
                {formatPetAge(pet.dateOfBirth) ?? <span className="muted">Not recorded</span>}
              </dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>
                {pet.weightKg !== null ? (
                  `${pet.weightKg} kg`
                ) : (
                  <span className="muted">Not recorded</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Microchip</dt>
              <dd>{pet.microchipId ?? <span className="muted">Not recorded</span>}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>
                {pet.owner.name}
                {pet.owner.phone && (
                  <>
                    {' · '}
                    <a href={`tel:${pet.owner.phone}`}>
                      <Phone size={14} aria-hidden="true" /> {pet.owner.phone}
                    </a>
                  </>
                )}
              </dd>
            </div>
          </dl>
          {pet.notes && (
            <div className="callout pet-profile__notes">
              <strong>Owner’s notes</strong>
              <p>{pet.notes}</p>
            </div>
          )}
        </div>
      </section>

      <section className="card timeline-card" aria-labelledby="history-heading">
        <h2 id="history-heading">Medical history</h2>
        {pet.records.length === 0 ? (
          <p className="muted">No health records have been added for {pet.name} yet.</p>
        ) : (
          <ol className="timeline">
            {pet.records.map((record) => (
              <li key={record.id} className="timeline__item">
                <RecordTypeIcon type={record.type} />
                <article className="timeline__body">
                  <header className="timeline__header">
                    <div>
                      <span className="timeline__type">{HEALTH_RECORD_LABELS[record.type]}</span>
                      <h3>{record.title}</h3>
                    </div>
                    <time dateTime={record.recordDate} className="timeline__date">
                      {formatDate(record.recordDate)}
                    </time>
                  </header>
                  {record.description && (
                    <p className="timeline__description pre-line">{record.description}</p>
                  )}
                  <footer className="timeline__footer">
                    <span className="timeline__author">
                      {record.type === 'ALLERGY' && <ShieldAlert size={12} aria-hidden="true" />}
                      Added by {record.canEdit ? 'you' : (record.createdBy?.name ?? 'the owner')}
                      {record.clinicName ? ` · ${record.clinicName}` : ''}
                    </span>
                  </footer>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
