import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { ListingPhoto, ListingStatusBadge, listingSummary } from './ListingBits';
import { useMyListings } from './useAdoption';
import './adoption.css';

/** Rescuer: the animals they have listed, with the number of applications waiting. */
export function MyListingsPage() {
  const listings = useMyListings();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Adoption listings</h1>
          <p>Animals you have rescued and listed for adoption.</p>
        </div>
        <Link to="/dashboard/listings/new" className="btn btn--primary">
          <Plus size={18} aria-hidden="true" /> List an animal
        </Link>
      </div>

      {listings.isPending && <PageLoader />}
      {listings.isError && <Alert tone="error">{listings.error.message}</Alert>}
      {listings.isSuccess && listings.data.length === 0 && (
        <div className="card empty-state">
          <p>You have not listed any animals yet.</p>
        </div>
      )}
      {listings.isSuccess && listings.data.length > 0 && (
        <ul className="adopt-grid">
          {listings.data.map((listing) => (
            <li key={listing.id}>
              <article className="card adopt-card">
                <ListingPhoto listing={listing} />
                <div className="adopt-card__body">
                  <div className="adopt-card__title">
                    <h2>
                      <Link to={`/dashboard/listings/${listing.id}`}>{listing.name}</Link>
                    </h2>
                    <ListingStatusBadge status={listing.status} />
                  </div>
                  <p className="muted adopt-card__summary">{listingSummary(listing)}</p>
                  {listing.openApplications > 0 ? (
                    <span className="badge badge--warning">
                      {listing.openApplications} application
                      {listing.openApplications === 1 ? '' : 's'} to review
                    </span>
                  ) : (
                    <span className="muted">No applications waiting</span>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
