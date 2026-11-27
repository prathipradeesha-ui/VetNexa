import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { daysUntilDate, followUpDueLabel } from '../assessments/FollowUpCard';
import { useFollowUps } from '../assessments/useAssessments';

/**
 * Owner dashboard card: wound follow-ups still to answer, soonest first. Hidden when there are
 * none, so owners who never used the wound check do not see an empty card.
 */
export function WoundFollowUpsCard() {
  const followUps = useFollowUps();
  const open = followUps.data?.filter((f) => !f.completedAt) ?? [];

  if (followUps.isError) return <Alert tone="error">{followUps.error.message}</Alert>;
  if (open.length === 0) return null;

  return (
    <section className="card reminders-card" aria-labelledby="follow-ups-heading">
      <div className="card-heading-row">
        <h2 id="follow-ups-heading" className="card-title">
          <CalendarCheck size={20} aria-hidden="true" /> Wound follow-ups
        </h2>
      </div>
      <ul className="reminder-list">
        {open.map((f) => (
          <li key={f.id}>
            <Link to={`/dashboard/assessments/${f.assessmentId}`} className="reminder">
              <CalendarCheck size={16} aria-hidden="true" />
              <span className="reminder__text">
                <strong>{f.pet.name}: how does the wound look?</strong>
                <span>Tap to answer or check a new photo</span>
              </span>
              <span
                className={
                  daysUntilDate(f.dueAt) <= 0 ? 'badge badge--danger' : 'badge badge--warning'
                }
              >
                {followUpDueLabel(f.dueAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
