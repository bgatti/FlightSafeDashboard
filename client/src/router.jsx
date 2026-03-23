import { Routes, Route } from 'react-router-dom'
import { SmsOverview } from './pages/SmsOverview'
import { LiveOperations } from './pages/LiveOperations'
import { FlightRiskList } from './pages/FlightRiskList'
import { ComplianceCenter } from './pages/ComplianceCenter'
import { PilotReports } from './pages/PilotReports'
import { Personnel } from './pages/Personnel'
import { AircraftRegistry } from './pages/AircraftRegistry'
import { SafetyComms } from './pages/SafetyComms'
import { FlightPlanning } from './pages/FlightPlanning'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/"            element={<SmsOverview />} />
      <Route path="/live"        element={<LiveOperations />} />
      <Route path="/plan"        element={<FlightPlanning />} />
      <Route path="/flights"     element={<FlightRiskList />} />
      <Route path="/personnel"   element={<Personnel />} />
      <Route path="/aircraft"    element={<AircraftRegistry />} />
      <Route path="/comms"       element={<SafetyComms />} />
      <Route path="/compliance"  element={<ComplianceCenter />} />
      <Route path="/reports"     element={<PilotReports />} />
      <Route path="/settings"    element={<SettingsPlaceholder />} />
    </Routes>
  )
}

function SettingsPlaceholder() {
  return (
    <div className="text-slate-400 text-sm">
      Settings — coming soon
    </div>
  )
}
