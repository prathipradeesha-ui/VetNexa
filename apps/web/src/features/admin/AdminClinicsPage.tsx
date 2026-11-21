import { Plus, Search, Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { AdminHeader } from './AdminBits';
import { useAdminClinics, useSetClinicActive, type AdminClinic } from './useAdmin';
import './admin.css';

function ClinicRow({ clinic }: { clinic: AdminClinic }) {
  const setActive = useSetClinicActive();
  return (
    <tr className={clinic.isActive ? undefined : 'admin-row--muted'}>
      <td>
        <strong>{clinic.name}</strong>
        <span className="admin-sub">
          {clinic.city}, {clinic.district} · {clinic.phone}
        </span>
      </td>
      <td>
        {clinic.isOpen24Hours ? (
          <span className="badge badge--info">24 hours</span>
        ) : clinic.hasEmergency ? (
          <span className="badge badge--info">Emergency</span>
        ) : (
          <span className="admin-sub">Standard hours</span>
        )}
      </td>
      <td>
        <span className="admin-rating">
          <Star size={14} aria-hidden="true" /> {clinic.averageRating.toFixed(1)}
        </span>
        <span className="admin-sub">
          {clinic.reviewCount} {clinic.reviewCount === 1 ? 'review' : 'reviews'}
        </span>
      </td>
      <td>
        <span className={clinic.isActive ? 'badge' : 'badge badge--neutral'}>
          {clinic.isActive ? 'Listed' : 'Hidden'}
        </span>
      </td>
      <td className="admin-actions">
        <Link to={`/dashboard/admin/clinics/${clinic.id}`} className="btn btn--secondary btn--sm">
          Edit
        </Link>
        <Button
          size="sm"
          variant="ghost"
          loading={setActive.isPending}
          loadingText="Saving…"
          onClick={() => setActive.mutate({ id: clinic.id, isActive: !clinic.isActive })}
        >
          {clinic.isActive ? 'Hide' : 'List again'}
        </Button>
        {setActive.isError && <Alert tone="error">{setActive.error.message}</Alert>}
      </td>
    </tr>
  );
}

export function AdminClinicsPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const clinics = useAdminClinics(q);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setQ(search.trim());
  };

  return (
    <>
      <AdminHeader
        title="Clinics"
        intro="Keep the clinic directory accurate. Hidden clinics disappear from public search."
      />
      <div className="admin-filters">
        <form className="admin-filters__search" onSubmit={onSearch} role="search">
          <label className="sr-only" htmlFor="clinic-search">
            Search clinics
          </label>
          <input
            id="clinic-search"
            className="input"
            placeholder="Clinic name or city"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="secondary">
            <Search size={16} aria-hidden="true" /> Search
          </Button>
        </form>
        <Link to="/dashboard/admin/clinics/new" className="btn btn--primary">
          <Plus size={18} aria-hidden="true" /> Add clinic
        </Link>
      </div>

      <div className="card admin-table-card">
        {clinics.isPending && <PageLoader label="Loading clinics…" />}
        {clinics.isError && <Alert tone="error">{clinics.error.message}</Alert>}
        {clinics.isSuccess && clinics.data.length === 0 && (
          <div className="empty-state">
            <p>No clinics found.</p>
          </div>
        )}
        {clinics.isSuccess && clinics.data.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Clinic</th>
                  <th scope="col">Hours</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Directory</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clinics.data.map((clinic) => (
                  <ClinicRow key={clinic.id} clinic={clinic} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
