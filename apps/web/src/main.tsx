import '@fontsource-variable/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { refreshSavedClinics } from './features/emergency/savedClinics';
import { registerServiceWorker } from './pwa/register';
import { router } from './router';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

// Once the app can work offline, keep a copy of the emergency clinic list on the phone.
registerServiceWorker(undefined, undefined, () => void refreshSavedClinics());
