// Shared InstructorsDisplay — display-only instructor grid used by portal pages.
// No store imports, no API calls. Data comes via props.

import { useState } from 'react'
import { useInstructorStars } from '../hooks/useInstructorStars'

/**
 * @param {object} props
 * @param {Array<{name:string, role:string, bio:string, photo?:string, certifications?:string[], endorsements?:string[]}>} props.instructors
 * @param {string} props.brand — company name
 * @param {object|null} [props.user] — logged-in user (null = visitor)
 * @param {function} [props.onBookInstructor] — (instructor) => void — called on "Book" click
 * @param {string} [props.heading] — section heading override
 * @param {string} [props.subtitle] — section subtitle
 * @param {React.ReactNode} [props.children] — extra content below grid
 */
export function InstructorsDisplay({
  instructors = [],
  brand,
  user,
  onBookInstructor,
  heading,
  subtitle,
  children,
}) {
  const [expanded, setExpanded] = useState(null)
  const [stars, setStar] = useInstructorStars()

  return (
    <section id="sec-instructors" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {heading || (brand ? `${brand} Instructors` : 'Our Instructors')}
          </h2>
          {subtitle && <p className="text-slate-400 max-w-lg mx-auto">{subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {instructors.map((inst) => {
            const open = expanded === inst.name
            const starVal = stars[inst.name] || 0
            return (
              <div key={inst.name}
                onClick={() => setExpanded(open ? null : inst.name)}
                className={`bg-surface-card border border-surface-border rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${open ? 'ring-1 ring-sky-400/30' : ''}`}>

                {/* Photo */}
                {inst.photo && (
                  <div className="h-40 bg-surface">
                    <img src={inst.photo} alt={inst.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-start gap-4 mb-3">
                    {/* Avatar (shown when no photo, or always as small icon) */}
                    {!inst.photo && (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {inst.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-base font-bold">{inst.name}</div>
                      <div className="text-sky-400 text-[10px] uppercase tracking-wide">{inst.role}</div>
                    </div>

                    {/* Star preference rating */}
                    <div className="flex gap-0 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3].map((s) => (
                        <button key={s}
                          onClick={() => setStar(inst.name, starVal === s ? 0 : s)}
                          className={`text-sm leading-none transition-all hover:scale-125 ${s <= starVal ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="text-slate-400 text-xs leading-relaxed">{inst.bio}</div>

                  {/* Certifications & Endorsements — always visible if present */}
                  {inst.certifications?.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-1.5">
                        {inst.certifications.map((cert) => (
                          <span key={cert} className="text-[10px] bg-sky-400/15 text-sky-400 border border-sky-400/20 px-2 py-0.5 rounded-full">{cert}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded: endorsements + details */}
                  {open && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                      {inst.endorsements?.length > 0 && (
                        <div>
                          <h4 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Endorsements & Specialties</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {inst.endorsements.map((end) => (
                              <span key={end} className="text-[10px] bg-emerald-400/15 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded-full">{end}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Book this Instructor — visible to all, active for logged-in */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!user) return
                          onBookInstructor?.(inst)
                          setTimeout(() => document.getElementById('sec-schedule')?.scrollIntoView({ behavior: 'smooth' }), 100)
                        }}
                        className={`mt-2 w-full font-semibold py-2.5 rounded-xl text-sm transition-all border ${
                          user
                            ? 'bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white border-sky-500/30 hover:border-sky-500'
                            : 'bg-slate-500/10 text-slate-500 border-slate-500/20 cursor-not-allowed'
                        }`}>
                        {user ? `Book ${inst.name.split(' ')[0]} →` : 'Log in to Book'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {children}
      </div>
    </section>
  )
}
