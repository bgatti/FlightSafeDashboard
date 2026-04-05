import { useState } from 'react'

/**
 * Shared login modal for portal pages.
 *
 * @param {string}   title       - Modal heading
 * @param {string}   subtitle    - Description text
 * @param {Array}    personas    - Quick-login test accounts [{id, name, label, ...}] (optional)
 * @param {string}   phone       - Business phone for "new? call us" footer
 * @param {Function} onClose
 * @param {Function} onLogin     - Called with user object on successful login
 */
export function PortalLoginModal({ title = 'Welcome', subtitle, personas = [], phone, onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin({ id: 'custom', name: email.split('@')[0], role: 'renter', label: 'Member', email, aircraft: [], hours: 0 })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
        {subtitle && <p className="text-slate-400 text-xs mb-5">{subtitle}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">Sign In</button>
        </form>

        {personas.length > 0 && (
          <div className="mt-5 pt-4 border-t border-surface-border">
            <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">Quick Login (Testing)</p>
            <div className="space-y-1.5">
              {personas.map((p) => (
                <button key={p.id} onClick={() => onLogin(p)}
                  className="w-full flex items-center justify-between bg-surface border border-surface-border rounded-lg px-3 py-2 text-left hover:border-sky-400/40 transition-colors group">
                  <div>
                    <div className="text-slate-200 text-xs font-medium group-hover:text-white">{p.name}</div>
                    <div className="text-slate-500 text-[10px]">{p.label}</div>
                  </div>
                  <span className="text-sky-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phone && <p className="text-slate-600 text-[10px] text-center mt-3">New? Call {phone} to set up an account</p>}
      </div>
    </div>
  )
}
