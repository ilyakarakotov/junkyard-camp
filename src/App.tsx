import { Suspense, lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './data/auth'
import { StoreProvider } from './data/store'
import SyncChrome from './components/SyncChrome'
import TestModeChrome from './components/TestModeChrome'
import SignIn from './screens/SignIn'
import Menu from './screens/Menu'
import Board from './screens/Board'
import RollCall from './screens/RollCall'
import TeamSheet from './screens/TeamSheet'
import Standings from './screens/Standings'
import BigScreen from './screens/BigScreen'

/*
 * Split off the three routes nobody opens while scoring. Exports and the audit
 * log pull in `xlsx`, which is larger than the rest of the app put together —
 * and §5.6 says the camp has spotty signal, so a helper waiting on morning line
 * up should not be downloading a spreadsheet writer to award a check-in. The
 * lab is a component bench that never ships anywhere useful.
 */
const Exports = lazy(() => import('./screens/Exports'))
const AuditLog = lazy(() => import('./screens/AuditLog'))
const Lab = lazy(() => import('./screens/Lab'))
const TestMode = lazy(() => import('./screens/TestMode'))

/**
 * StoreProvider mounts INSIDE the auth guard: the data layer's first fetch
 * runs only once a session exists, which the authenticated-read RLS policies
 * require. In local-only mode the guard passes straight through.
 */
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <StoreProvider>
                  <SyncChrome />
                  <TestModeChrome />
                  {/* the wall, while a split route arrives — never a spinner */}
                  <Suspense fallback={<div className="min-h-dvh" />}>
                    <Routes>
                      <Route path="/" element={<Board />} />
                      <Route path="/menu" element={<Menu />} />
                      <Route path="/call/:categoryId" element={<RollCall />} />
                      <Route path="/team/:teamId" element={<TeamSheet />} />
                      <Route path="/standings" element={<Standings />} />
                      <Route path="/display" element={<BigScreen />} />
                      <Route path="/exports" element={<Exports />} />
                      <Route path="/audit" element={<AuditLog />} />
                      <Route path="/lab" element={<Lab />} />
                      <Route path="/test" element={<TestMode />} />
                    </Routes>
                  </Suspense>
                </StoreProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
