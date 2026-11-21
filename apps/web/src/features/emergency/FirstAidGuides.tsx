import { BookOpen } from 'lucide-react';
import { FIRST_AID_GUIDES, type FirstAidGuide } from './firstAid';

const URGENT_HEADINGS = ['Get help now if'];

function Guide({ guide }: { guide: FirstAidGuide }) {
  return (
    <details className="first-aid-guide">
      <summary>{guide.title}</summary>
      <div className="first-aid-guide__body">
        {guide.sections.map((section) => (
          <div
            key={section.heading}
            className={
              URGENT_HEADINGS.includes(section.heading)
                ? 'first-aid-guide__section first-aid-guide__section--urgent'
                : 'first-aid-guide__section'
            }
          >
            <h4>{section.heading}</h4>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets.length > 0 && (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {guide.sources.length > 0 && (
          <p className="first-aid-guide__sources">Based on: {guide.sources.join('; ')}</p>
        )}
      </div>
    </details>
  );
}

/** First-aid guides for common emergencies. Built into the app, so they work offline too. */
export function FirstAidGuides() {
  return (
    <section className="card" aria-labelledby="first-aid-guides-title">
      <h2 id="first-aid-guides-title" className="card-title">
        <BookOpen size={20} aria-hidden="true" /> First-aid guides
      </h2>
      <p className="field__hint">
        Works without internet. General first aid only: always contact a veterinarian.
      </p>
      <div className="first-aid-guides">
        {FIRST_AID_GUIDES.map((guide) => (
          <Guide key={guide.id} guide={guide} />
        ))}
      </div>
    </section>
  );
}
