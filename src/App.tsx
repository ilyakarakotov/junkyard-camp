import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './data/store'
import TeamSelect from './screens/TeamSelect'
import Award from './screens/Award'
import Confirmation from './screens/Confirmation'
import Standings from './screens/Standings'
import BigScreen from './screens/BigScreen'
import Lab from './screens/Lab'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<TeamSelect />} />
          <Route path="/award/:teamId" element={<Award />} />
          <Route path="/confirm/:eventId" element={<Confirmation />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/display" element={<BigScreen />} />
          <Route path="/lab" element={<Lab />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
