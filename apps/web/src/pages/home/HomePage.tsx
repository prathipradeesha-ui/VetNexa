import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Camera,
  ClipboardList,
  HeartHandshake,
  Hospital,
  LayoutDashboard,
  MapPin,
  PawPrint,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';
import { HeroPreview } from './HeroPreview';
import './home.css';

const audiences = [
  {
    icon: PawPrint,
    title: 'Pet owners',
    text: 'Keep every vaccination, treatment and vet visit in one place, with reminders before anything is due.',
  },
  {
    icon: Stethoscope,
    title: 'Veterinarians',
    text: 'See a patient’s history before the consultation and record treatment notes owners can follow.',
  },
  {
    icon: Hospital,
    title: 'Clinics',
    text: 'Show your services, opening hours and emergency availability to owners searching nearby.',
  },
  {
    icon: HeartHandshake,
    title: 'Rescuers and adopters',
    text: 'Report animals in danger, list rescued animals for adoption and find them caring homes.',
  },
];

const features = [
  {
    icon: ClipboardList,
    title: 'Pet profiles',
    text: 'Breed, age, weight, microchip, allergies and photos for every pet you own.',
  },
  {
    icon: Syringe,
    title: 'Health records',
    text: 'A clear timeline of vaccinations, treatments, surgeries and medication.',
  },
  {
    icon: Camera,
    title: 'AI wound assessment',
    text: 'Upload a photo of a dog or cat wound for a preliminary assessment and next steps.',
  },
  {
    icon: CalendarCheck,
    title: 'Consultations',
    text: 'Request in-person or video consultations with verified veterinarians.',
  },
  {
    icon: MapPin,
    title: 'Clinic discovery',
    text: 'Find clinics by city and service, see opening hours and read honest reviews.',
  },
  {
    icon: HeartHandshake,
    title: 'Rescue and adoption',
    text: 'Urgent rescue reports and adoption listings managed by registered rescuers.',
  },
  {
    icon: Bot,
    title: 'Pet-care assistant',
    text: 'Ask everyday questions about feeding, grooming, vaccination and behaviour.',
  },
  {
    icon: LayoutDashboard,
    title: 'Role-based dashboards',
    text: 'Owners, vets, rescuers and administrators each see exactly what they need.',
  },
];

const steps = [
  {
    title: 'Take a clear photo',
    text: 'Photograph the wound in good light. VetNexa checks the image is sharp and bright enough to assess.',
  },
  {
    title: 'Get a preliminary assessment',
    text: 'The model suggests the most likely wound type and how urgent it may be, with its confidence shown plainly.',
  },
  {
    title: 'Know what to do next',
    text: 'You receive first-aid guidance and, when needed, a recommendation to see a vet with nearby clinics listed.',
  },
];

export function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__content">
            <span className="eyebrow">Pet healthcare and animal welfare</span>
            <h1 className="hero__title">
              Every pet’s health,
              <br />
              <span className="hero__title-accent">connected in one place.</span>
            </h1>
            <p className="lead hero__lead">
              VetNexa brings pet owners, veterinarians, clinics and rescuers together. Keep health
              records organised, spot problems earlier with AI-supported guidance, and reach the
              right vet when it matters.
            </p>
            <div className="hero__actions">
              <Link to="/register" className="btn btn--primary">
                Create a free account <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="btn btn--secondary">
                See how it works
              </a>
            </div>
            <ul className="hero__points">
              <li>
                <ShieldCheck size={18} aria-hidden="true" /> Verified veterinarians only
              </li>
              <li>
                <Users size={18} aria-hidden="true" /> Built for owners, vets and rescuers
              </li>
            </ul>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* ── Who it is for ── */}
      <section className="section" aria-labelledby="audiences-heading">
        <div className="container">
          <div className="section__header">
            <span className="eyebrow">One platform, four communities</span>
            <h2 id="audiences-heading">Designed around everyone who cares for animals</h2>
          </div>
          <div className="audience-grid">
            {audiences.map(({ icon: Icon, title, text }) => (
              <article key={title} className="audience-card">
                <span className="icon-tile">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="section section--tint" aria-labelledby="features-heading">
        <div className="container">
          <div className="section__header section__header--center">
            <span className="eyebrow">Features</span>
            <h2 id="features-heading">Everything a pet’s care journey needs</h2>
            <p className="muted">
              From the first vaccination to finding a forever home, each module works with the
              others so information is entered once and used everywhere.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="feature-card">
                <Icon size={22} className="feature-card__icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI assessment ── */}
      <section id="how-it-works" className="section" aria-labelledby="ai-heading">
        <div className="container ai-grid">
          <div>
            <span className="eyebrow">AI wound assessment</span>
            <h2 id="ai-heading">Earlier answers when your pet is hurt</h2>
            <p className="muted">
              Not sure if a cut or sore needs a vet tonight or can wait until morning? VetNexa’s
              image model gives a quick, cautious first opinion for dogs and cats.
            </p>
            <ol className="steps">
              {steps.map((step, index) => (
                <li key={step.title} className="steps__item">
                  <span className="steps__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside className="safety-card" aria-labelledby="safety-heading">
            <ShieldCheck size={28} aria-hidden="true" />
            <h3 id="safety-heading">Decision support, not a diagnosis</h3>
            <p>
              The assessment is a research prototype designed to support, never replace, a
              veterinarian. Every result shows how confident the model is, and when it is unsure it
              says so instead of guessing.
            </p>
            <ul>
              <li>Moderate or severe results always recommend a vet visit</li>
              <li>Blurry or dark photos are rejected rather than misread</li>
              <li>Model accuracy and limitations are published openly</li>
            </ul>
          </aside>
        </div>
      </section>

      {/* ── Call to action ── */}
      <section className="cta-band">
        <div className="container cta-band__inner">
          <div>
            <h2>Give your pets a complete health record today</h2>
            <p>Free for pet owners. Veterinarians and rescuers join after a quick verification.</p>
          </div>
          <div className="cta-band__actions">
            <Link to="/register" className="btn btn--light">
              Create a free account
            </Link>
            <Link to="/register?role=VET" className="cta-band__link">
              I’m a veterinarian <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
