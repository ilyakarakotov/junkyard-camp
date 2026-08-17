import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './data/auth'
import { StoreProvider } from './data/store'
import SyncChrome from './components/SyncChrome'
import SignIn from './screens/SignIn'
import Menu from './screens/Menu'
import Board from './screens/Board'
import RollCall from './screens/RollCall'
import TeamSheet from './screens/TeamSheet'
import KeyCeremony from './screens/KeyCeremony'
import Standings from './screens/Standings'
import BigScreen from './screens/BigScreen'
import Exports from './screens/Exports'
import AuditLog from './screens/AuditLog'
import Lab from './screens/Lab'

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
                  <Routes>
                    <Route path="/" element={<Board />} />
                    <Route path="/menu" element={<Menu />} />
                    <Route path="/call/:categoryId" element={<RollCall />} />
                    <Route path="/team/:teamId" element={<TeamSheet />} />
                    <Route path="/key/:teamId" element={<KeyCeremony />} />
                    <Route path="/standings" element={<Standings />} />
                    <Route path="/display" element={<BigScreen />} />
                    <Route path="/exports" element={<Exports />} />
                    <Route path="/audit" element={<AuditLog />} />
                    <Route path="/lab" element={<Lab />} />
                  </Routes>
                </StoreProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
