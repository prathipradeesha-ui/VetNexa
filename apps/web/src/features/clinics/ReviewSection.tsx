import { zodResolver } from '@hookform/resolvers/zod';
import { reviewSchema, type ReviewData, type ReviewInput } from '@vetnexa/shared';
import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextField } from '../../components/ui/FormField';
import { StarInput, StarRating } from '../../components/ui/Stars';
import { applyServerErrors, hasFieldErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/useAuth';
import { useSaveReview, type ClinicDetail } from './useClinics';

const reviewDate = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

/** Rating summary, the viewer's own review form, and the list of reviews. */
export function ReviewSection({ clinic }: { clinic: ClinicDetail }) {
  const { data: user } = useCurrentUser();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const canReview = user && (user.role === 'OWNER' || user.role === 'RESCUER');
  const maxCount = Math.max(1, ...clinic.ratingDistribution.map((row) => row.count));

  return (
    <section className="card" id="reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Reviews</h2>

      {clinic.reviewCount > 0 && (
        <div className="rating-summary">
          <div className="rating-summary__score">
            <strong>{clinic.averageRating.toFixed(1)}</strong>
            <StarRating value={clinic.averageRating} size={18} />
            <span className="muted">
              {clinic.reviewCount} review{clinic.reviewCount === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="rating-bars" aria-label="Rating breakdown">
            {clinic.ratingDistribution.map((row) => (
              <li key={row.stars}>
                <span>{row.stars} ★</span>
                <span className="rating-bars__track" aria-hidden="true">
                  <span style={{ width: `${(row.count / maxCount) * 100}%` }} />
                </span>
                <span className="sr-only">
                  {row.stars} stars: {row.count} review{row.count === 1 ? '' : 's'}
                </span>
                <span aria-hidden="true">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Who can write a review */}
      {!user && (
        <p className="review-prompt">
          <MessageSquarePlus size={18} aria-hidden="true" />
          <span>
            Visited this clinic?{' '}
            <Link to="/login" state={{ from: location.pathname }}>
              Sign in
            </Link>{' '}
            to share your experience.
          </span>
        </p>
      )}
      {user && !canReview && (
        <p className="muted review-prompt">
          Reviews are written by pet owners and rescuers to keep them independent.
        </p>
      )}
      {canReview && (clinic.myReview === null || editing) && (
        <ReviewForm
          slug={clinic.slug}
          existing={clinic.myReview}
          onDone={() => setEditing(false)}
        />
      )}
      {canReview && clinic.myReview && !editing && (
        <div className="review-prompt review-prompt--mine">
          <span>You reviewed this clinic ({clinic.myReview.rating} stars).</span>
          <button
            type="button"
            className="link-button link-button--primary"
            onClick={() => setEditing(true)}
          >
            Edit your review
          </button>
        </div>
      )}

      {clinic.reviews.length === 0 ? (
        <p className="muted">No reviews yet. Be the first to review {clinic.name}.</p>
      ) : (
        <ul className="review-list">
          {clinic.reviews.map((review) => (
            <li key={review.id} className="review">
              <div className="review__header">
                <StarRating value={review.rating} size={15} />
                {review.title && <strong>{review.title}</strong>}
              </div>
              <p>{review.comment}</p>
              <span className="review__meta">
                {review.author}
                {review.isMine && ' (you)'} · {reviewDate.format(new Date(review.createdAt))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewForm({
  slug,
  existing,
  onDone,
}: {
  slug: string;
  existing: ClinicDetail['myReview'];
  onDone: () => void;
}) {
  const { save, remove } = useSaveReview(slug);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReviewInput, unknown, ReviewData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: existing?.rating,
      title: existing?.title ?? '',
      comment: existing?.comment ?? '',
    },
  });

  const onSubmit = (data: ReviewData) =>
    save.mutate(data, {
      onSuccess: onDone,
      onError: (error) => applyServerErrors(error, setError),
    });

  return (
    <form className="review-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h3>{existing ? 'Edit your review' : 'Write a review'}</h3>
      {save.isError && !hasFieldErrors(save.error) && (
        <Alert tone="error">{save.error.message}</Alert>
      )}
      <Controller
        control={control}
        name="rating"
        render={({ field, fieldState }) => (
          <StarInput
            value={field.value === undefined ? undefined : Number(field.value)}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <TextField
        label="Headline"
        optional
        placeholder="e.g. Calm and caring at midnight"
        error={errors.title?.message}
        {...register('title')}
      />
      <FieldWrapper id="review-comment" label="Your review" error={errors.comment?.message}>
        <textarea
          id="review-comment"
          className="textarea"
          rows={4}
          placeholder="What went well? Was anything difficult? Other owners will find this helpful."
          aria-invalid={errors.comment ? true : undefined}
          {...register('comment')}
        />
      </FieldWrapper>
      <div className="form-actions">
        {existing && (
          <>
            <button
              type="button"
              className="link-button"
              onClick={() => remove.mutate(undefined, { onSuccess: onDone })}
              disabled={remove.isPending}
            >
              Delete review
            </button>
            <Button variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          </>
        )}
        <Button type="submit" loading={save.isPending} loadingText="Posting…">
          {existing ? 'Update review' : 'Post review'}
        </Button>
      </div>
    </form>
  );
}
