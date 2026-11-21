import type React from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration, type RouteObject } from 'react-router';
import { PublicLayout } from './components/layout/PublicLayout';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AboutPage } from './pages/about/AboutPage';
import { HomePage } from './pages/home/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteError } from './pages/RouteError';

/*
 * Pages with forms and the signed-in area are loaded on demand ("code splitting"), so the
 * home page downloads only what it needs. Each `lazy` import becomes a separate file.
 */
const lazyPage =
  <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] });

/** All application routes. Exported separately so tests can build a memory router from them. */
export const routes: RouteObject[] = [
  {
    // Root: scrolls to the top on every page change (and restores position on Back).
    element: (
      <>
        <ScrollRestoration />
        <Outlet />
      </>
    ),
    // Any page that fails (including one whose code cannot be downloaded) shows this instead.
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/about', element: <AboutPage /> },
          {
            path: '/clinics',
            lazy: lazyPage(() => import('./features/clinics/ClinicsPage'), 'ClinicsPage'),
          },
          {
            path: '/adopt',
            lazy: lazyPage(() => import('./features/adoption/AdoptPage'), 'AdoptPage'),
          },
          {
            path: '/adopt/:id',
            lazy: lazyPage(
              () => import('./features/adoption/AdoptionDetailPage'),
              'AdoptionDetailPage',
            ),
          },
          {
            path: '/clinics/:slug',
            lazy: lazyPage(() => import('./features/clinics/ClinicDetailPage'), 'ClinicDetailPage'),
          },
          {
            // Essential help without an account: clinics, wound check, rescue report.
            path: '/emergency',
            lazy: lazyPage(() => import('./features/emergency/EmergencyPage'), 'EmergencyPage'),
          },
          {
            path: '/assistant',
            lazy: lazyPage(() => import('./features/assistant/AssistantPage'), 'AssistantPage'),
          },
          {
            path: '/contact',
            lazy: lazyPage(() => import('./pages/contact/ContactPage'), 'ContactPage'),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '/login', lazy: lazyPage(() => import('./features/auth/LoginPage'), 'LoginPage') },
      {
        path: '/register',
        lazy: lazyPage(() => import('./features/auth/RegisterPage'), 'RegisterPage'),
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            lazy: lazyPage(() => import('./components/layout/AppLayout'), 'AppLayout'),
            children: [
              {
                path: '/dashboard',
                lazy: lazyPage(() => import('./features/dashboard/DashboardPage'), 'DashboardPage'),
              },
              {
                element: <ProtectedRoute roles={['OWNER', 'VET']} />,
                children: [
                  {
                    path: '/dashboard/consultations',
                    lazy: lazyPage(
                      () => import('./features/consultations/ConsultationsPage'),
                      'ConsultationsPage',
                    ),
                  },
                  {
                    path: '/dashboard/consultations/:id',
                    lazy: lazyPage(
                      () => import('./features/consultations/ConsultationDetailPage'),
                      'ConsultationDetailPage',
                    ),
                  },
                ],
              },
              {
                path: '/dashboard/assistant',
                lazy: lazyPage(
                  () => import('./features/assistant/AssistantPage'),
                  'DashboardAssistantPage',
                ),
              },
              {
                // Any signed-in user can report an animal; the board adapts to the role.
                path: '/dashboard/rescue',
                lazy: lazyPage(() => import('./features/rescue/RescuePage'), 'RescuePage'),
              },
              {
                path: '/dashboard/rescue/new',
                lazy: lazyPage(
                  () => import('./features/rescue/ReportAnimalPage'),
                  'ReportAnimalPage',
                ),
              },
              {
                path: '/dashboard/rescue/:id',
                lazy: lazyPage(
                  () => import('./features/rescue/RescueDetailPage'),
                  'RescueDetailPage',
                ),
              },
              {
                element: <ProtectedRoute roles={['RESCUER', 'ADMIN']} />,
                children: [
                  {
                    path: '/dashboard/listings',
                    lazy: lazyPage(
                      () => import('./features/adoption/MyListingsPage'),
                      'MyListingsPage',
                    ),
                  },
                  {
                    path: '/dashboard/listings/new',
                    lazy: lazyPage(
                      () => import('./features/adoption/ListingFormPage'),
                      'ListingFormPage',
                    ),
                  },
                  {
                    path: '/dashboard/listings/:id',
                    lazy: lazyPage(
                      () => import('./features/adoption/ListingManagePage'),
                      'ListingManagePage',
                    ),
                  },
                  {
                    path: '/dashboard/listings/:id/edit',
                    lazy: lazyPage(
                      () => import('./features/adoption/ListingFormPage'),
                      'ListingFormPage',
                    ),
                  },
                ],
              },
              {
                // Administration: the API enforces the same ADMIN-only rule on every route.
                element: <ProtectedRoute roles={['ADMIN']} />,
                children: [
                  {
                    path: '/dashboard/admin',
                    lazy: lazyPage(
                      () => import('./features/admin/AdminStatsPage'),
                      'AdminStatsPage',
                    ),
                  },
                  {
                    path: '/dashboard/admin/users',
                    lazy: lazyPage(
                      () => import('./features/admin/AdminUsersPage'),
                      'AdminUsersPage',
                    ),
                  },
                  {
                    path: '/dashboard/admin/vets',
                    lazy: lazyPage(() => import('./features/admin/AdminVetsPage'), 'AdminVetsPage'),
                  },
                  {
                    path: '/dashboard/admin/clinics',
                    lazy: lazyPage(
                      () => import('./features/admin/AdminClinicsPage'),
                      'AdminClinicsPage',
                    ),
                  },
                  {
                    path: '/dashboard/admin/clinics/new',
                    lazy: lazyPage(
                      () => import('./features/admin/ClinicFormPage'),
                      'ClinicFormPage',
                    ),
                  },
                  {
                    path: '/dashboard/admin/clinics/:id',
                    lazy: lazyPage(
                      () => import('./features/admin/ClinicFormPage'),
                      'ClinicFormPage',
                    ),
                  },
                  {
                    path: '/dashboard/admin/reviews',
                    lazy: lazyPage(
                      () => import('./features/admin/AdminReviewsPage'),
                      'AdminReviewsPage',
                    ),
                  },
                  {
                    path: '/dashboard/admin/messages',
                    lazy: lazyPage(
                      () => import('./features/admin/AdminMessagesPage'),
                      'AdminMessagesPage',
                    ),
                  },
                ],
              },
              {
                element: <ProtectedRoute roles={['VET']} />,
                children: [
                  {
                    path: '/dashboard/patients/:petId',
                    lazy: lazyPage(
                      () => import('./features/consultations/PatientPage'),
                      'PatientPage',
                    ),
                  },
                ],
              },
              {
                // Pet owners only; the API enforces the same rule.
                element: <ProtectedRoute roles={['OWNER']} />,
                children: [
                  {
                    path: '/dashboard/pets',
                    lazy: lazyPage(() => import('./features/pets/PetsPage'), 'PetsPage'),
                  },
                  {
                    path: '/dashboard/pets/new',
                    lazy: lazyPage(() => import('./features/pets/PetFormPage'), 'PetFormPage'),
                  },
                  {
                    path: '/dashboard/pets/:petId',
                    lazy: lazyPage(() => import('./features/pets/PetDetailPage'), 'PetDetailPage'),
                  },
                  {
                    path: '/dashboard/pets/:petId/edit',
                    lazy: lazyPage(() => import('./features/pets/PetFormPage'), 'PetFormPage'),
                  },
                  {
                    path: '/dashboard/assessments',
                    lazy: lazyPage(
                      () => import('./features/assessments/AssessmentsPage'),
                      'AssessmentsPage',
                    ),
                  },
                  {
                    path: '/dashboard/assessments/new',
                    lazy: lazyPage(
                      () => import('./features/assessments/NewAssessmentPage'),
                      'NewAssessmentPage',
                    ),
                  },
                  {
                    path: '/dashboard/assessments/:id',
                    lazy: lazyPage(
                      () => import('./features/assessments/AssessmentResultPage'),
                      'AssessmentResultPage',
                    ),
                  },
                  {
                    path: '/dashboard/applications',
                    lazy: lazyPage(
                      () => import('./features/adoption/MyApplicationsPage'),
                      'MyApplicationsPage',
                    ),
                  },
                  {
                    path: '/dashboard/consultations/new',
                    lazy: lazyPage(
                      () => import('./features/consultations/BookConsultationPage'),
                      'BookConsultationPage',
                    ),
                  },
                  {
                    path: '/dashboard/pets/:petId/records/new',
                    lazy: lazyPage(
                      () => import('./features/records/RecordFormPage'),
                      'RecordFormPage',
                    ),
                  },
                  {
                    path: '/dashboard/pets/:petId/records/:recordId/edit',
                    lazy: lazyPage(
                      () => import('./features/records/RecordFormPage'),
                      'RecordFormPage',
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
