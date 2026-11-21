import { WOUND_CLASS_LABELS } from '@vetnexa/shared';
import { ChevronRight, ScanSearch } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { EmergencyNotice, formatDateTime, percent } from './AssessmentBits';
import { TriageBadge } from './TriageExplanation';
import { useAssessments, useAssessmentStatus } from './useAssessments';
import './assessments.css';

export function AssessmentsPage() {
  const assessments = useAssessments();
  const status = useAssessmentStatus();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Wound check</h1>
          <p>
            A cautious, AI-assisted first look at a skin wound on your dog or cat, with advice on
            how soon to see a vet.
          </p>
        </div>
        <Link to="/dashboard/assessments/new" className="btn btn--primary">
          <ScanSearch size={18} aria-hidden="true" /> New wound check
        </Link>
      </div>

      <EmergencyNotice />

      {status.isSuccess && !status.data.available && (
        <Alert tone="info" title="Wound check is not available right now">
          The AI service is offline or its model is still being prepared. Your earlier results are
          shown below. If you are worried about your pet, please contact a veterinarian.
        </Alert>
      )}

      <div className="card consultation-list">
        {assessments.isPending && <PageLoader label="Loading your wound checks…" />}
        {assessments.isError && <Alert tone="error">{assessments.error.message}</Alert>}
        {assessments.isSuccess && assessments.data.length === 0 && (
          <div className="empty-state">
            <p>You have not checked any wounds yet.</p>
          </div>
        )}
        {assessments.isSuccess && assessments.data.length > 0 && (
          <ul>
            {assessments.data.map((item) => (
              <li key={item.id}>
                <Link to={`/dashboard/assessments/${item.id}`} className="assessment-row">
                  <img src={item.imageUrl} alt="" className="assessment-row__thumb" />
                  <span className="assessment-row__main">
                    <strong>{item.pet.name}</strong>
                    <span>
                      {item.status === 'UNCERTAIN'
                        ? 'Not confident enough to assess'
                        : `${WOUND_CLASS_LABELS[item.predictedClass] ?? item.predictedClass} · ${percent(item.confidence)} confidence`}
                    </span>
                    <span className="assessment-row__date">{formatDateTime(item.createdAt)}</span>
                  </span>
                  <span className="assessment-row__badges">
                    <TriageBadge outcome={item.triage} />
                    {item.demoModel && <span className="badge badge--neutral">Demo model</span>}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="assessment-row__chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
