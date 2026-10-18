import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { NotFoundPage } from './pages/NotFound';

// Each page is downloaded only when it is first opened.
const LearnPage = lazy(() => import('./pages/learn/LearnPage').then((m) => ({ default: m.LearnPage })));
const BenchmarksPage = lazy(() => import('./pages/benchmarks/BenchmarksPage').then((m) => ({ default: m.BenchmarksPage })));

export function App() {
  return (
    <Suspense fallback={<p className="container muted">Loading…</p>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LearnPage />} />
          <Route path="benchmarks" element={<BenchmarksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
