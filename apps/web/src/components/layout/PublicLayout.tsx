import { Outlet } from 'react-router';
import { AppStatus } from '../../pwa/AppStatus';
import { ChatLauncher } from './ChatLauncher';
import { Footer } from './Footer';
import { Header } from './Header';
import './layout.css';

/** Wraps all public pages with the header and footer. */
export function PublicLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <AppStatus />
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ChatLauncher />
    </>
  );
}
