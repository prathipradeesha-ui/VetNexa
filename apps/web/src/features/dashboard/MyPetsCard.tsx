import { CalendarClock, PawPrint, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { dueLabel } from '../pets/format';
import { PetAvatar } from '../pets/PetAvatar';
import { usePets } from '../pets/usePets';

/** Owner dashboard card: each pet with its next due vaccination, medication or check-up. */
export function MyPetsCard() {
  const pets = usePets();

  return (
    <section className="card" aria-labelledby="my-pets-heading">
      <div className="card-heading-row">
        <h2 id="my-pets-heading" className="card-title">
          <PawPrint size={20} aria-hidden="true" /> My pets
        </h2>
        {pets.isSuccess && pets.data.length > 0 && (
          <Link to="/dashboard/pets" className="card-link">
            View all
          </Link>
        )}
      </div>

      {pets.isPending && <p className="muted">Loading your pets…</p>}
      {pets.isError && <Alert tone="error">{pets.error.message}</Alert>}

      {pets.isSuccess && pets.data.length === 0 && (
        <div className="empty-state">
          <p>You have not added any pets yet.</p>
          <Link to="/dashboard/pets/new" className="btn btn--primary btn--sm">
            <Plus size={16} aria-hidden="true" /> Add your first pet
          </Link>
        </div>
      )}

      {pets.isSuccess && pets.data.length > 0 && (
        <ul className="mini-pet-list">
          {pets.data.map((pet) => (
            <li key={pet.id}>
              <Link to={`/dashboard/pets/${pet.id}`} className="mini-pet">
                <PetAvatar
                  name={pet.name}
                  species={pet.species}
                  photoUrl={pet.photoUrl}
                  size={44}
                />
                <span className="mini-pet__text">
                  <strong>{pet.name}</strong>
                  <span>
                    {pet.nextDue ? (
                      <>
                        <CalendarClock size={14} aria-hidden="true" /> {pet.nextDue.title} ·{' '}
                        {dueLabel(pet.nextDue.date)}
                      </>
                    ) : (
                      'Nothing due'
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
