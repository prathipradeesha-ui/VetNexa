import { HeartPulse, Megaphone, MessageCircleQuestion, ScanSearch, Siren } from 'lucide-react';
import { Link } from 'react-router';
import { useCurrentUser } from '../auth/useAuth';
import { EmergencyClinics } from './EmergencyClinics';
import { GuestRescueForm } from './GuestRescueForm';
import { GuestWoundCheck } from './GuestWoundCheck';
import '../../pages/pages.css';
import '../pets/pets.css';
import './emergency.css';

const FIRST_STEPS = [
  'Keep yourself safe. Injured animals may bite, even pets that are usually gentle.',
  'Press a clean cloth firmly on any bleeding and keep pressing.',
  'Keep the animal calm, still and warm (or cool if it is overheated).',
  'Do not give food, drink or human medicines.',
  'Call a clinic before you travel so they can prepare.',
];

/** Essential help for emergencies, without signing in. */
export function EmergencyPage() {
  const { data: user } = useCurrentUser();

  return (
    <>
      <section className="page-hero emergency-hero">
        <div className="container">
          <span className="eyebrow">
            <Siren size={16} aria-hidden="true" /> Emergency help, no account needed
          </span>
          <h1>Is your dog or cat in danger?</h1>
          <p className="lead">
            Find the nearest emergency clinic, check a wound with your phone camera, or report an
            animal in need. Everything on this page works without signing in.
          </p>
          <nav className="emergency-jump" aria-label="Emergency options">
            <a href="#emergency-clinics-title" className="btn btn--primary">
              <Siren size={18} aria-hidden="true" /> Nearest clinic
            </a>
            <a href="#wound-check-title" className="btn btn--secondary">
              <ScanSearch size={18} aria-hidden="true" /> Check a wound
            </a>
            <a href="#report-title" className="btn btn--secondary">
              <Megaphone size={18} aria-hidden="true" /> Report an animal
            </a>
          </nav>
        </div>
      </section>

      <section className="section">
        <div className="container emergency-layout">
          <div className="emergency-layout__main">
            <EmergencyClinics />

            <section className="card emergency-section" aria-labelledby="wound-check-title">
              <h2 id="wound-check-title" className="card-title">
                <ScanSearch size={20} aria-hidden="true" /> Check a wound with your camera
              </h2>
              <p className="field__hint">
                A quick, cautious first look at a wound or skin problem, combining your photo with
                what you tell us. It is not a diagnosis.
              </p>
              <GuestWoundCheck />
            </section>

            <section className="card emergency-section" aria-labelledby="report-title">
              <h2 id="report-title" className="card-title">
                <Megaphone size={20} aria-hidden="true" /> Report an animal in need
              </h2>
              <p className="field__hint">
                For injured or abandoned dogs and cats that are not yours. Registered rescuers
                nearby will see your report.
              </p>
              <GuestRescueForm />
            </section>
          </div>

          <aside className="emergency-layout__side">
            <section className="card" aria-labelledby="first-steps-title">
              <h2 id="first-steps-title" className="card-title">
                <HeartPulse size={20} aria-hidden="true" /> First steps
              </h2>
              <ol className="first-steps">
                {FIRST_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <Link to="/assistant" className="btn btn--secondary btn--sm">
                <MessageCircleQuestion size={16} aria-hidden="true" /> Ask the pet-care assistant
              </Link>
            </section>
            {!user && (
              <section className="card emergency-account">
                <h2 className="card-title">Save time next time</h2>
                <p>
                  With a free account you can keep your pets' health records, save wound checks and
                  book consultations.
                </p>
                <div className="emergency-account__buttons">
                  <Link to="/register" className="btn btn--primary btn--sm">
                    Create an account
                  </Link>
                  <Link to="/login" className="btn btn--ghost btn--sm">
                    Sign in
                  </Link>
                </div>
              </section>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
