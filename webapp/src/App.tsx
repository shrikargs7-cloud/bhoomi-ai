import React, { Suspense, lazy } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BhoomiProvider } from './context/BhoomiContext';
import { BhoomiShell } from './components/BhoomiShell';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const TitleReportPage = lazy(() => import('./pages/TitleReportPage').then((m) => ({ default: m.TitleReportPage })));
const OwnershipPage = lazy(() => import('./pages/OwnershipPage').then((m) => ({ default: m.OwnershipPage })));
const GisPage = lazy(() => import('./pages/GisPage').then((m) => ({ default: m.GisPage })));
const ValuationPage = lazy(() => import('./pages/ValuationPage').then((m) => ({ default: m.ValuationPage })));

const RouteFallback: React.FC = () => (
  <div className="mx-auto max-w-7xl px-6 py-12 text-center text-xs font-semibold text-slate-500">
    Loading BhoomiAI workspace module...
  </div>
);

const RouterImpl = import.meta.env.VITE_STATIC_DEMO === 'true' ? HashRouter : BrowserRouter;

export const App: React.FC = () => {
  return (
    <RouterImpl>
      <BhoomiProvider>
        <BhoomiShell>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Primary BhoomiAI Routes */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/title-report" element={<TitleReportPage />} />
              <Route path="/ownership" element={<OwnershipPage />} />
              <Route path="/gis" element={<GisPage />} />
              <Route path="/valuation" element={<ValuationPage />} />

              {/* Legacy / Aliased Routes mapped cleanly to live functional pages */}
              <Route path="/oxland" element={<DashboardPage />} />
              <Route path="/rundocs" element={<DocumentsPage />} />
              <Route path="/reveal-title" element={<TitleReportPage />} />
              <Route path="/treemonk" element={<OwnershipPage />} />
              <Route path="/cadaster" element={<GisPage />} />
              <Route path="/simple-cma" element={<ValuationPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BhoomiShell>
      </BhoomiProvider>
    </RouterImpl>
  );
};

export default App;
