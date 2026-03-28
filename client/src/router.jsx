import { Routes, Route, Navigate } from 'react-router-dom'
import { SmsOverview } from './pages/SmsOverview'
import { Flights } from './pages/Flights'
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
      <Route path="/flights"     element={<Flights />} />
      <Route path="/live"        element={<Navigate to="/flights" replace />} />
      <Route path="/plan"        element={<FlightPlanning />} />
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
