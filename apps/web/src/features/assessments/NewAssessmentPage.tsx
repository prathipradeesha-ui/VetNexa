import { ASSESSABLE_SPECIES } from '@vetnexa/shared';
import { ArrowLeft, Camera, ImageUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper } from '../../components/ui/FormField';
import { PageLoader } from '../../components/ui/PageLoader';
import { ApiError } from '../../lib/api';
import { usePets } from '../pets/usePets';
import { DemoModelNotice, EmergencyNotice } from './AssessmentBits';
import { photoQualityProblems, useAssessmentStatus, useCreateAssessment } from './useAssessments';
import '../pets/pets.css';
import './assessments.css';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

type Errors = Partial<Record<'petId' | 'photo' | 'understood', string>>;

export function NewAssessmentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pets = usePets();
  const status = useAssessmentStatus();
  const create = useCreateAssessment();
  const fileInput = useRef<HTMLInputElement>(null);

  const [petId, setPetId] = useState(params.get('petId') ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const eligiblePets = useMemo(
    () =>
      (pets.data ?? []).filter((pet) =>
        (ASSESSABLE_SPECIES as readonly string[]).includes(pet.species),
      ),
    [pets.data],
  );

  // A local preview of the chosen photo; the URL is released when it changes.
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, photo: 'Please choose a JPG, PNG or WebP image.' }));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrors((e) => ({ ...e, photo: `Photos must be ${MAX_MB} MB or smaller.` }));
      return;
    }
    create.reset();
    setErrors((e) => ({ ...e, photo: undefined }));
    setPhoto(file);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!petId) next.petId = 'Please choose which pet the photo is of';
    if (!photo) next.photo = 'Please add a photo of the wound';
    if (!understood) next.understood = 'Please confirm you understand this is not a diagnosis';
    setErrors(next);
    if (Object.keys(next).length > 0 || !photo) return;

    create.mutate(
      { petId, photo, ownerNotes: notes.trim() || undefined },
      {
        onSuccess: (assessment) => navigate(`/dashboard/assessments/${assessment.id}`),
        onError: (error) => {
          const field = error instanceof ApiError ? error.details?.[0] : undefined;
          if (field?.field === 'petId' || field?.field === 'photo') {
            setErrors({ [field.field]: field.message });
          }
        },
      },
    );
  };

  const qualityProblems = photoQualityProblems(create.error);
  const unavailable = status.isSuccess && !status.data.available;

  return (
    <>
      <Link to="/dashboard/assessments" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>
      <div className="page-header">
        <div>
          <h1>New wound check</h1>
          <p>Upload a clear photo of a skin wound on your dog or cat.</p>
        </div>
      </div>

      <EmergencyNotice />
      {status.data?.available && status.data.demoModel && <DemoModelNotice />}
      {unavailable && (
        <Alert tone="info" title="Wound check is not available right now">
          The AI service is offline or its model is still being prepared. Please try again later, or
          contact a veterinarian if you are worried about your pet.
        </Alert>
      )}

      {pets.isPending && <PageLoader label="Loading your pets…" />}
      {pets.isError && <Alert tone="error">{pets.error.message}</Alert>}

      {pets.isSuccess && eligiblePets.length === 0 && (
        <div className="card empty-state">
          <p>Wound check works for dogs and cats. Add your dog or cat first.</p>
          <Link to="/dashboard/pets/new" className="btn btn--primary">
            Add a pet
          </Link>
        </div>
      )}

      {pets.isSuccess && eligiblePets.length > 0 && (
        <div className="assessment-form-layout">
          <form className="card pet-form" noValidate onSubmit={onSubmit}>
            {qualityProblems && (
              <Alert tone="warning" title="This photo cannot be assessed reliably">
                {qualityProblems.length > 0 ? (
                  <ul className="quality-problems">
                    {qualityProblems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                ) : (
                  'Please take another photo following the tips.'
                )}
              </Alert>
            )}
            {create.isError &&
              !qualityProblems &&
              !(create.error instanceof ApiError && create.error.details?.length) && (
                <Alert tone="error">{create.error.message}</Alert>
              )}

            <FieldWrapper id="assessment-pet" label="Which pet?" error={errors.petId}>
              <select
                id="assessment-pet"
                className="select"
                value={petId}
                onChange={(event) => setPetId(event.target.value)}
                aria-invalid={errors.petId ? true : undefined}
              >
                <option value="">Choose a pet</option>
                {eligiblePets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </FieldWrapper>

            <FieldWrapper
              id="assessment-photo"
              label="Photo of the wound"
              error={errors.photo}
              hint={`JPG, PNG or WebP, up to ${MAX_MB} MB`}
            >
              <input
                ref={fileInput}
                id="assessment-photo"
                type="file"
                accept={TYPES.join(',')}
                className="sr-only"
                onChange={onPhoto}
              />
              <button
                type="button"
                className={`photo-drop${preview ? ' photo-drop--filled' : ''}`}
                onClick={() => fileInput.current?.click()}
                aria-describedby="assessment-photo-hint"
              >
                {preview ? (
                  <img src={preview} alt="Chosen wound photo" />
                ) : (
                  <span className="photo-drop__empty">
                    <ImageUp size={28} aria-hidden="true" />
                    Choose or take a photo
                  </span>
                )}
              </button>
              {preview && (
                <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                  <Camera size={16} aria-hidden="true" /> Change photo
                </Button>
              )}
            </FieldWrapper>

            <FieldWrapper
              id="assessment-notes"
              label="What happened?"
              optional
              hint="For your own records, e.g. when you noticed it"
            >
              <textarea
                id="assessment-notes"
                className="textarea"
                rows={3}
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FieldWrapper>

            <div className="field">
              <label className="pet-form__checkbox">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                  aria-invalid={errors.understood ? true : undefined}
                />
                I understand this is a preliminary AI check from a research prototype, not a
                diagnosis, and that it does not replace a veterinarian.
              </label>
              {errors.understood && <span className="field__error">{errors.understood}</span>}
            </div>

            <div className="form-actions">
              <Link to="/dashboard/assessments" className="btn btn--secondary">
                Cancel
              </Link>
              <Button
                type="submit"
                loading={create.isPending}
                loadingText="Checking photo…"
                disabled={unavailable}
              >
                Check wound
              </Button>
            </div>
          </form>

          <aside className="card photo-tips" aria-labelledby="photo-tips-title">
            <h2 id="photo-tips-title" className="card-title">
              Tips for a good photo
            </h2>
            <ul>
              <li>Use daylight or a bright room; avoid flash glare.</li>
              <li>Hold the phone steady about 15–20 cm away and tap to focus.</li>
              <li>Fill most of the frame with the wound and part the fur around it.</li>
              <li>Only photograph if your pet is calm. Never restrain a pet in pain.</li>
              <li>Photos are stored privately in your account; location data is removed.</li>
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
