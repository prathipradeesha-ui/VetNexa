import { ROLE_LABELS, USER_ROLES } from '@vetnexa/shared';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { useCurrentUser } from '../auth/useAuth';
import { AdminHeader, formatDay, Pagination } from './AdminBits';
import { useAdminUsers, useSetUserStatus, type AdminUser } from './useAdmin';
import './admin.css';

function UserRow({ user, isMe }: { user: AdminUser; isMe: boolean }) {
  const setStatus = useSetUserStatus();
  const [confirming, setConfirming] = useState(false);
  const suspended = user.status === 'SUSPENDED';
  const canChange = !isMe && user.role !== 'ADMIN';

  return (
    <tr className={suspended ? 'admin-row--muted' : undefined}>
      <td>
        <strong>
          {user.firstName} {user.lastName}
        </strong>
        <span className="admin-sub">{user.email}</span>
      </td>
      <td>
        {ROLE_LABELS[user.role]}
        {user.vetProfile && (
          <span className="admin-sub">
            Licence {user.vetProfile.licenseNumber} ·{' '}
            {user.vetProfile.isVerified ? 'verified' : 'not verified'}
          </span>
        )}
        {user.role === 'OWNER' && (
          <span className="admin-sub">
            {user.petCount} {user.petCount === 1 ? 'pet' : 'pets'}
          </span>
        )}
      </td>
      <td>
        {formatDay(user.createdAt)}
        <span className="admin-sub">
          {user.lastLoginAt ? `Last sign-in ${formatDay(user.lastLoginAt)}` : 'Never signed in'}
        </span>
      </td>
      <td>
        <span className={suspended ? 'badge badge--danger' : 'badge'}>
          {suspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="admin-actions">
        {!canChange ? (
          <span className="admin-sub">{isMe ? 'You' : 'Administrator'}</span>
        ) : confirming ? (
          <span className="admin-confirm">
            {suspended ? 'Reactivate?' : 'Suspend this account?'}
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className={suspended ? undefined : 'btn--danger'}
              loading={setStatus.isPending}
              loadingText="Saving…"
              onClick={() =>
                setStatus.mutate(
                  { id: user.id, status: suspended ? 'ACTIVE' : 'SUSPENDED' },
                  { onSuccess: () => setConfirming(false) },
                )
              }
            >
              Confirm
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
            {suspended ? 'Reactivate' : 'Suspend'}
          </Button>
        )}
        {setStatus.isError && <Alert tone="error">{setStatus.error.message}</Alert>}
      </td>
    </tr>
  );
}

export function AdminUsersPage() {
  const { data: me } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const role = params.get('role') ?? '';
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const [search, setSearch] = useState(q);
  const users = useAdminUsers({ q, role, status, page });

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    update({ q: search.trim() });
  };

  return (
    <>
      <AdminHeader title="Users" intro="Find accounts and suspend or reactivate them." />

      <form className="admin-filters" onSubmit={onSearch} role="search">
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <input
          id="user-search"
          className="input"
          placeholder="Name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          <Search size={16} aria-hidden="true" /> Search
        </Button>
        <label className="sr-only" htmlFor="user-role">
          Role
        </label>
        <select
          id="user-role"
          className="select"
          value={role}
          onChange={(event) => update({ role: event.target.value })}
        >
          <option value="">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="user-status">
          Status
        </label>
        <select
          id="user-status"
          className="select"
          value={status}
          onChange={(event) => update({ status: event.target.value })}
        >
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </form>

      <div className="card admin-table-card">
        {users.isPending && <PageLoader label="Loading users…" />}
        {users.isError && <Alert tone="error">{users.error.message}</Alert>}
        {users.isSuccess && users.data.users.length === 0 && (
          <div className="empty-state">
            <p>No users match these filters.</p>
          </div>
        )}
        {users.isSuccess && users.data.users.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((user) => (
                  <UserRow key={user.id} user={user} isMe={user.id === me?.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {users.isSuccess && (
        <Pagination info={users.data} onPage={(n) => update({ page: String(n) })} />
      )}
    </>
  );
}
