import { Routes, Route, Navigate } from 'react-router-dom'
import { SmsOverview } from './pages/SmsOverview'
import { Flights } from './pages/Flights'
import { ComplianceCenter } from './pages/ComplianceCenter'
import { PilotReports } from './pages/PilotReports'
import { Personnel } from './pages/Personnel'
import { AircraftRegistry } from './pages/AircraftRegistry'
import { SafetyComms } from './pages/SafetyComms'
import { FlightPlanning } from './pages/FlightPlanning'
import { Maintenance } from './maintenance/Maintenance'
import { FBO } from './fbo/FBO'
import { Sim } from './sim/Sim'
import { POS } from './pos/POS'
import { BusinessPnL } from './business/BusinessPnL'
import { Management } from './management/Management'
import { Leases } from './leases/Leases'
import { Training } from './training/Training'
import { GliderOps } from './glider/GliderOps'
import { SkydivingOps } from './skydiving/SkydivingOps'
import { MileHiSkydiving } from './skydiving/MileHiSkydiving'
import { MileHighGliding } from './glider/MileHighGliding'
import { JourneysBoulder } from './glider/JourneysBoulder'
import { Clients } from './pages/Clients'
import { Settings } from './pages/Settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/"            element={<SmsOverview />} />
      <Route path="/flights"     element={<Flights />} />
      <Route path="/live"        element={<Navigate to="/flights" replace />} />
      <Route path="/plan"        element={<FlightPlanning />} />
      <Route path="/personnel"   element={<Navigate to="/management" replace />} />
      <Route path="/aircraft"    element={<Navigate to="/management" replace />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="/fbo"         element={<FBO />} />
      <Route path="/pos"         element={<POS />} />
      <Route path="/business"    element={<BusinessPnL />} />
      <Route path="/management"  element={<Management />} />
      <Route path="/leases"      element={<Leases />} />
      <Route path="/training"    element={<Training />} />
      <Route path="/glider-ops"  element={<GliderOps />} />
      <Route path="/skydiving"   element={<SkydivingOps />} />
      <Route path="/mile-hi-skydiving" element={<MileHiSkydiving />} />
      <Route path="/mile-high-gliding" element={<MileHighGliding />} />
      <Route path="/journeys-boulder" element={<JourneysBoulder />} />
      <Route path="/clients"     element={<Navigate to="/management" replace />} />
      <Route path="/sim"         element={<Sim />} />
      <Route path="/comms"       element={<Navigate to="/" replace />} />
      <Route path="/compliance"  element={<Navigate to="/" replace />} />
      <Route path="/reports"     element={<PilotReports />} />
      <Route path="/settings"    element={<Settings />} />
    </Routes>
  )
}
