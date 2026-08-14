import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './data/store'
import Board from './screens/Board'
import RollCall from './screens/RollCall'
import TeamSheet from './screens/TeamSheet'
import KeyCeremony from './screens/KeyCeremony'
import Standings from './screens/Standings'
import BigScreen from './screens/BigScreen'
import Lab from './screens/Lab'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="/call/:categoryId" element={<RollCall />} />
          <Route path="/team/:teamId" element={<TeamSheet />} />
          <Route path="/key/:teamId" element={<KeyCeremony />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/display" element={<BigScreen />} />
          <Route path="/lab" element={<Lab />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
