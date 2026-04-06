// Shared TeamSection — used by MileHighGliding, JourneysBoulder, etc.
// Display-only: all data via props, no store imports.

/**
 * @param {object} props
 * @param {Array<{name:string, role:string, bio:string}>} props.staff
 * @param {string} props.brand — company name (used in heading)
 * @param {string} [props.heading] — override section heading
 * @param {string} [props.mission] — mission statement / subtitle
 * @param {string} [props.cols] — grid cols class override (default "md:grid-cols-2")
 * @param {React.ReactNode} [props.children] — extra content below staff grid (e.g. CTA)
 */
export function TeamSection({
  staff = [],
  brand,
  heading,
  mission,
  cols = 'md:grid-cols-2',
  children,
}) {
  return (
    <section id="sec-about" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {heading || (brand ? `About ${brand}` : 'Our Pilots & Instructors')}
          </h2>
          {mission && <p className="text-slate-400 max-w-lg mx-auto">{mission}</p>}
        </div>
        <div className={`grid grid-cols-1 ${cols} gap-5 ${children ? 'mb-10' : ''}`}>
          {staff.map((person) => (
            <div key={person.name} className="bg-surface-card border border-surface-border rounded-2xl p-5 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {person.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <div className="text-white text-sm font-semibold">{person.name}</div>
                <div className="text-sky-400 text-[10px] uppercase tracking-wide mb-1">{person.role}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{person.bio}</div>
              </div>
            </div>
          ))}
        </div>
        {children}
      </div>
    </section>
  )
}
