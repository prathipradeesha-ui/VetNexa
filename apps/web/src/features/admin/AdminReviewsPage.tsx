import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { StarRating } from '../../components/ui/Stars';
import { AdminHeader, formatDay, Pagination } from './AdminBits';
import { useAdminReviews, useModerateReview, type AdminReview } from './useAdmin';
import './admin.css';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Shown' },
  { value: 'REJECTED', label: 'Hidden' },
];

function ReviewItem({ review }: { review: AdminReview }) {
  const moderate = useModerateReview();
  const hidden = review.status === 'REJECTED';
  return (
    <li className={`admin-item${hidden ? ' admin-row--muted' : ''}`}>
      <div className="admin-item__head">
        <div>
          <strong>{review.clinic.name}</strong>
          <span className="admin-sub">
            {review.author.firstName} {review.author.lastName} · {formatDay(review.createdAt)}
          </span>
        </div>
        <span className={hidden ? 'badge badge--neutral' : 'badge'}>
          {hidden ? 'Hidden' : 'Shown'}
        </span>
      </div>
      <StarRating value={review.rating} />
      {review.title && <p className="admin-item__title">{review.title}</p>}
      <p className="pre-line">{review.comment}</p>
      <div className="admin-actions">
        <Button
          size="sm"
          variant={hidden ? 'primary' : 'secondary'}
          loading={moderate.isPending}
          loadingText="Saving…"
          onClick={() =>
            moderate.mutate({ id: review.id, status: hidden ? 'APPROVED' : 'REJECTED' })
          }
        >
          {hidden ? 'Show again' : 'Hide review'}
        </Button>
        {moderate.isError && <Alert tone="error">{moderate.error.message}</Alert>}
      </div>
    </li>
  );
}

export function AdminReviewsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const reviews = useAdminReviews({ status, page });

  return (
    <>
      <AdminHeader
        title="Reviews"
        intro="Reviews appear straight away. Hide ones that are abusive, spam or not about a real visit; ratings update automatically."
      />
      <div className="chip-filters" role="group" aria-label="Filter reviews">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className="toggle-chip"
            aria-pressed={status === filter.value}
            onClick={() => setParams(filter.value ? { status: filter.value } : {})}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="card">
        {reviews.isPending && <PageLoader label="Loading reviews…" />}
        {reviews.isError && <Alert tone="error">{reviews.error.message}</Alert>}
        {reviews.isSuccess && reviews.data.reviews.length === 0 && (
          <div className="empty-state">
            <p>No reviews here.</p>
          </div>
        )}
        {reviews.isSuccess && reviews.data.reviews.length > 0 && (
          <ul className="admin-list">
            {reviews.data.reviews.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </ul>
        )}
      </div>
      {reviews.isSuccess && (
        <Pagination
          info={reviews.data}
          onPage={(n) => setParams({ ...(status && { status }), page: String(n) })}
        />
      )}
    </>
  );
}
