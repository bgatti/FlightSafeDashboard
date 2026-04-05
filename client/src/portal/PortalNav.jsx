import { useState } from 'react'

/**
 * Shared top navigation for full-screen portal pages.
 *
 * @param {string}   brand       - Business name displayed at left
 * @param {string}   phone       - Phone number for call link
 * @param {string[]} navItems    - Section ids for nav buttons
 * @param {Object}   navLabels   - id → display label mapping (optional)
 * @param {Object|null} user     - Logged-in user object (null = anonymous)
 * @param {Function} onSection   - Called with section id when nav button clicked
 * @param {Function} onLoginClick
 * @param {Function} onLogout
 */
export function PortalNav({ brand, phone, navItems = [], navLabels = {}, user, onSection, onLoginClick, onLogout }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight">{brand}</span>
          <div className="hidden md:flex items-center gap-4">
            {navItems.map((s) => (
              <button key={s} onClick={() => onSection(s)}
                className="text-white/70 hover:text-white text-xs uppercase tracking-wide transition-colors">
                {navLabels[s] || s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {phone && (
            <a href={`tel:${phone.replace(/[^\d]/g, '')}`}
              className="text-white/70 hover:text-white text-xs transition-colors hidden sm:block">
              {phone}
            </a>
          )}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sky-300 text-xs hidden sm:block">{user.name}</span>
              {user.label && <span className="text-slate-500 text-[10px] hidden lg:block">({user.label})</span>}
              <button onClick={onLogout} className="text-white/60 hover:text-white text-xs underline">Sign out</button>
            </div>
          ) : (
            <button onClick={onLoginClick}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-1.5 rounded-lg border border-white/20 transition-all">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
