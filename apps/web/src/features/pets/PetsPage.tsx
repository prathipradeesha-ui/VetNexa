import { CalendarClock, ChevronRight, ClipboardList, PawPrint, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { daysUntil, dueLabel, petSummaryLine } from './format';
import { PetAvatar } from './PetAvatar';
import { usePets } from './usePets';
import './pets.css';

export function PetsPage() {
  const pets = usePets();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My pets</h1>
          <p>Profiles, photos and health information for each of your pets.</p>
        </div>
        {pets.isSuccess && pets.data.length > 0 && (
          <Link to="/dashboard/pets/new" className="btn btn--primary">
            <Plus size={18} aria-hidden="true" /> Add a pet
          </Link>
        )}
      </div>

      {pets.isPending && <PageLoader label="Loading your pets…" />}
      {pets.isError && <Alert tone="error">{pets.error.message}</Alert>}

      {pets.isSuccess && pets.data.length === 0 && (
        <section className="card pets-empty">
          <span className="pets-empty__icon" aria-hidden="true">
            <PawPrint size={32} />
          </span>
          <h2>Add your first pet</h2>
          <p className="muted">
            Create a profile to keep vaccinations, treatments and vet visits together, and get
            reminders before anything is due.
          </p>
          <Link to="/dashboard/pets/new" className="btn btn--primary">
            <Plus size={18} aria-hidden="true" /> Add a pet
          </Link>
        </section>
      )}

      {pets.isSuccess && pets.data.length > 0 && (
        <ul className="pet-grid">
          {pets.data.map((pet) => {
            const dueIn = pet.nextDue ? daysUntil(pet.nextDue.date) : null;
            const dueClass =
              dueIn === null
                ? ''
                : dueIn < 0
                  ? 'pet-card__due pet-card__due--overdue'
                  : dueIn <= 30
                    ? 'pet-card__due pet-card__due--soon'
                    : 'pet-card__due';
            return (
              <li key={pet.id}>
                <Link to={`/dashboard/pets/${pet.id}`} className="card pet-card">
                  <div className="pet-card__top">
                    <PetAvatar name={pet.name} species={pet.species} photoUrl={pet.photoUrl} />
                    <div className="pet-card__identity">
                      <h2>{pet.name}</h2>
                      <p>{petSummaryLine(pet)}</p>
                    </div>
                    <ChevronRight className="pet-card__chevron" size={20} aria-hidden="true" />
                  </div>
                  <div className="pet-card__meta">
                    <span>
                      <ClipboardList size={16} aria-hidden="true" />
                      {pet.recordCount} health record{pet.recordCount === 1 ? '' : 's'}
                    </span>
                    {pet.nextDue ? (
                      <span className={dueClass}>
                        <CalendarClock size={16} aria-hidden="true" />
                        {pet.nextDue.title}: {dueLabel(pet.nextDue.date)}
                      </span>
                    ) : (
                      <span className="muted">Nothing due</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
