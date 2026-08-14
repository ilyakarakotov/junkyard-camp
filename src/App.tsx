import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './data/store'
import Lab from './screens/Lab'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/lab" element={<Lab />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
