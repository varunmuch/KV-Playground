import { Outlet } from 'react-router-dom';
import { LiveProvider } from '../live/LiveContext';
import { QwenProvider } from '../qwen/QwenContext';
import { Footer } from './Footer';
import { Header } from './Header';
import { ScrollManager } from './ScrollManager';

export function Layout() {
  return (
    <QwenProvider>
      <LiveProvider>
        <div className="app">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <ScrollManager />
          <Header />
          <main id="main">
            <Outlet />
          </main>
          <Footer />
        </div>
      </LiveProvider>
    </QwenProvider>
  );
}
