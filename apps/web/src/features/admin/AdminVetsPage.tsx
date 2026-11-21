import { PendingVetsCard } from '../dashboard/PendingVetsCard';
import { AdminHeader } from './AdminBits';
import '../dashboard/dashboard.css';
import './admin.css';

export function AdminVetsPage() {
  return (
    <>
      <AdminHeader
        title="Vet verification"
        intro="Check each licence number with the Sri Lanka Veterinary Council before approving."
      />
      <PendingVetsCard />
    </>
  );
}
