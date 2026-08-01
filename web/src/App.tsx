import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { AppShell } from './components/AppShell';
import { CardSkeleton } from './components/ui';
import Home from './screens/Home';

// Home ships in the entry chunk (it is the first paint on every cold start);
// everything else loads on navigation so a 2G first load stays small.
const Crops = lazy(() => import('./screens/Crops'));
const Assistant = lazy(() => import('./screens/Assistant'));
const Mandi = lazy(() => import('./screens/Mandi'));
const Tools = lazy(() => import('./screens/Tools'));
const Profile = lazy(() => import('./screens/Profile'));
const DiseaseScan = lazy(() => import('./screens/tools/DiseaseScan'));
const VerifyProduct = lazy(() => import('./screens/tools/VerifyProduct'));
const Diversify = lazy(() => import('./screens/tools/Diversify'));
const Schemes = lazy(() => import('./screens/tools/Schemes'));
const Soil = lazy(() => import('./screens/tools/Soil'));
const Expenses = lazy(() => import('./screens/tools/Expenses'));
const Residue = lazy(() => import('./screens/tools/Residue'));
const SOS = lazy(() => import('./screens/tools/SOS'));
const Advisories = lazy(() => import('./screens/tools/Advisories').then((m) => ({ default: m.Advisory })));

function ScreenFallback() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-9 w-2/3" />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={3} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route
              path="*"
              element={
                <Suspense fallback={<ScreenFallback />}>
                  <Routes>
                    <Route path="/crops" element={<Crops />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/mandi" element={<Mandi />} />
                    <Route path="/tools" element={<Tools />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/tools/disease" element={<DiseaseScan />} />
                    <Route path="/tools/verify" element={<VerifyProduct />} />
                    <Route path="/tools/diversify" element={<Diversify />} />
                    <Route path="/tools/schemes" element={<Schemes />} />
                    <Route path="/tools/soil" element={<Soil />} />
                    <Route path="/tools/expenses" element={<Expenses />} />
                    <Route path="/tools/residue" element={<Residue />} />
                    <Route path="/tools/sos" element={<SOS />} />
                    <Route path="/tools/yield" element={<Advisories kind="yield" />} />
                    <Route path="/tools/rotation" element={<Advisories kind="rotation" />} />
                    <Route path="/tools/organic" element={<Advisories kind="organic" />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
