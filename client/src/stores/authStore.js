import { create } from 'zustand'
import { mockPersonnel, mockCertificates, hasActiveIA, activeCertsForPerson } from '../mocks/personnel'

// Personnel who can log in as maintenance (department === 'Maintenance')
const MAINTENANCE_PERSONNEL = mockPersonnel.filter((p) => p.department === 'Maintenance')

// Default persona — dispatcher (no maintenance privileges)
const DEFAULT_USER = { name: 'Alex Torres', role: 'dispatcher', personnelId: null }

export const useAuthStore = create((set, get) => ({
  user: DEFAULT_USER,

  /** Log in as a maintenance person by personnel ID */
  loginAs(personnelId) {
    const person = mockPersonnel.find((p) => p.id === personnelId)
    if (!person) return
    set({
      user: {
        name: person.name,
        role: person.role === 'mechanic' ? 'maintenance' : person.role,
        personnelId: person.id,
        certType: person.certType,
        canReturnToService: person.canReturnToService,
        certificateNumber: person.certificateNumber,
      },
    })
  },

  /** Log out back to default dispatcher */
  logout() {
    set({ user: DEFAULT_USER })
  },

  /** Get the current user's active certificates */
  getActiveCerts() {
    const { user } = get()
    if (!user.personnelId) return []
    return activeCertsForPerson(user.personnelId)
  },

  /** Check if current user holds active IA */
  hasIA() {
    const { user } = get()
    if (!user.personnelId) return false
    return hasActiveIA(user.personnelId)
  },

  /** Check if current user is maintenance role */
  isMaintenance() {
    const { user } = get()
    return user.role === 'maintenance'
  },
}))

/** Convenience: all loginable maintenance personnel */
export { MAINTENANCE_PERSONNEL }
