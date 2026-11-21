import { Eye, HeartPulse, Lock, Phone, Scale, ShieldCheck, Target, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { site } from '../../config/site';
import '../pages.css';

const values = [
  {
    icon: HeartPulse,
    title: 'Animal welfare first',
    text: 'Every feature is judged by one question: does it help an animal get the right care sooner?',
  },
  {
    icon: ShieldCheck,
    title: 'Safe, honest AI',
    text: 'Our AI supports decisions but never replaces a veterinarian. It shows its confidence and admits uncertainty.',
  },
  {
    icon: Lock,
    title: 'Privacy by design',
    text: 'Medical records are visible only to the owner and the vets they consult. We never sell personal data.',
  },
  {
    icon: Scale,
    title: 'Trust and transparency',
    text: 'Veterinarians are verified before they can see patient records, and clinic reviews are moderated fairly.',
  },
];

export function AboutPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">About VetNexa</span>
          <h1>Connecting everyone who cares for animals</h1>
          <p className="lead">
            VetNexa is an AI-assisted pet healthcare and animal welfare platform. We make it simpler
            for owners to look after their pets, for veterinarians to give informed care, and for
            rescuers to find animals the homes they deserve.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div>
            <h2>
              <Target size={22} className="heading-icon" aria-hidden="true" />
              Our mission
            </h2>
            <p>
              Pet health information is often scattered across paper vaccination cards, phone photos
              and the memories of busy owners. When an animal is hurt, owners rarely know whether it
              needs a vet tonight or can wait. Stray and abandoned animals depend on volunteers who
              struggle to coordinate.
            </p>
            <p>
              VetNexa brings all of this into one secure, easy-to-use platform: organised health
              records, verified veterinarians, a clinic directory, rescue and adoption tools, and
              carefully designed AI that helps people notice problems earlier.
            </p>
          </div>
          <div>
            <h2>
              <Eye size={22} className="heading-icon" aria-hidden="true" />
              Our vision
            </h2>
            <p>
              A future where every dog and cat has a complete health history, every owner can reach
              trustworthy veterinary advice, and no dog or cat in need goes unnoticed.
            </p>
            <div className="callout">
              <strong>About our AI</strong>
              <p>
                VetNexa’s wound assessment is a decision-support prototype. Its performance and
                limitations are evaluated and published, and it always recommends professional
                veterinary attention when a wound may be serious.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="values-heading">
        <div className="container">
          <div className="section__header">
            <span className="eyebrow">What we stand for</span>
            <h2 id="values-heading">Our values</h2>
          </div>
          <div className="value-grid">
            {values.map(({ icon: Icon, title, text }) => (
              <article key={title} className="card value-card">
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="team-heading">
        <div className="container">
          <div className="section__header">
            <span className="eyebrow">The team</span>
            <h2 id="team-heading">Who is behind VetNexa</h2>
          </div>
          <article className="card person-card">
            <span className="person-card__avatar" aria-hidden="true">
              <UserRound size={34} />
            </span>
            <div>
              <h3>{site.owner.name}</h3>
              <p className="person-card__role">{site.owner.role}</p>
              <p>
                {site.owner.name} designed and developed VetNexa, from the platform architecture and
                user experience to the AI wound-assessment model.
              </p>
              <a href={`tel:${site.owner.phoneInternational}`} className="person-card__phone">
                <Phone size={16} aria-hidden="true" /> {site.owner.phone}
              </a>
            </div>
          </article>
          <p className="muted about-contact-line">
            Questions or partnership ideas? <Link to="/contact">Get in touch</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
