// Shared TrainingSection — display-only training programs & rates.
// No store imports, no API calls. Data comes via props.

import { fmt$ } from './portalConstants'

/**
 * @param {object} props
 * @param {Array<{id:string, name:string, desc:string}>} props.programs — training programs
 * @param {object} props.rates — instruction rates { primary: {label, rate}, advanced: {label, rate}, specialty: {label, rate} }
 * @param {string} props.brand — company name
 * @param {object} [props.membership] — { standard: {monthly, annual}, discounted: {monthly, note} }
 * @param {object} [props.insurance] — { note, liability, medical, physicalDamage, providers: [{name, url}] }
 * @param {string} [props.heading] — section heading override
 * @param {string} [props.subtitle] — section subtitle
 * @param {function} [props.onSelectProgram] — callback(program) when a program card is clicked
 */
export function TrainingSection({
  programs = [],
  rates = {},
  brand,
  membership,
  insurance,
  heading = 'Flight Training',
  subtitle = 'Private through Commercial, Instrument, Multi-Engine, Mountain Flying, and more',
  onSelectProgram,
}) {
  const rateEntries = [rates.primary, rates.advanced, rates.specialty].filter(Boolean)

  return (
    <section id="sec-training" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/50 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{heading}</h2>
          <p className="text-slate-400">{subtitle}</p>
        </div>

        {/* Instruction rates */}
        {rateEntries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {rateEntries.map((r) => (
              <div key={r.label} onClick={() => onSelectProgram?.({ id: r.label.toLowerCase().replace(/\s+/g, '-'), name: r.label, desc: `Instruction at $${r.rate}/hr`, rate: r.rate })}
                className={`bg-surface-card border border-surface-border rounded-2xl p-6 text-center transition-colors ${onSelectProgram ? 'cursor-pointer hover:border-sky-400/30 group' : ''}`}>
                <div className="text-sky-400 font-bold text-3xl">${r.rate}<span className="text-sky-400/50 text-base font-normal">/hr</span></div>
                <div className="text-white text-sm font-semibold">{r.label}</div>
                {onSelectProgram && <div className="text-sky-400/0 group-hover:text-sky-400/60 text-[10px] mt-1 transition-colors">Click to get started →</div>}
              </div>
            ))}
          </div>
        )}

        {/* Programs grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programs.map((pgm) => (
            <div key={pgm.id} onClick={() => onSelectProgram?.(pgm)}
              className={`bg-surface-card border border-surface-border rounded-2xl p-5 transition-colors ${onSelectProgram ? 'cursor-pointer hover:border-sky-400/30 group' : 'hover:border-sky-400/30'}`}>
              <h3 className="text-white text-sm font-bold mb-1 group-hover:text-sky-300 transition-colors">{pgm.name}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{pgm.desc}</p>
              {onSelectProgram && <div className="text-sky-400/0 group-hover:text-sky-400/60 text-[10px] mt-2 transition-colors">Learn more →</div>}
            </div>
          ))}
        </div>

        {/* Membership & insurance */}
        {(membership || insurance) && (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {membership && (
              <div className="bg-gradient-to-r from-sky-900/50 to-indigo-900/50 border border-sky-400/20 rounded-2xl p-8">
                <h3 className="text-white text-xl font-bold mb-4">Membership</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sky-400 font-bold text-2xl">${membership.standard.monthly}<span className="text-sky-400/50 text-sm">/mo</span></div>
                    <div className="text-slate-300 text-xs">Standard · or ${membership.standard.annual}/yr</div>
                  </div>
                  {membership.discounted && (
                    <div>
                      <div className="text-green-400 font-bold text-2xl">${membership.discounted.monthly}<span className="text-green-400/50 text-sm">/mo</span></div>
                      <div className="text-slate-300 text-xs">Discounted</div>
                      {membership.discounted.note && <div className="text-slate-500 text-[10px] mt-1">{membership.discounted.note}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
            {insurance && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-8">
                <h3 className="text-white text-xl font-bold mb-3">Renter's Insurance</h3>
                {insurance.note && <p className="text-slate-400 text-xs mb-3">{insurance.note}</p>}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center"><div className="text-white font-bold">${insurance.liability / 1000}K</div><div className="text-slate-500 text-[10px]">Liability</div></div>
                  <div className="text-center"><div className="text-white font-bold">${insurance.medical / 1000}K</div><div className="text-slate-500 text-[10px]">Medical</div></div>
                  <div className="text-center"><div className="text-white font-bold">${insurance.physicalDamage / 1000}K</div><div className="text-slate-500 text-[10px]">Physical Dmg</div></div>
                </div>
                {insurance.providers && (
                  <div className="flex flex-wrap gap-2">
                    {insurance.providers.map((p) => (
                      <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-lg px-3 py-1.5 transition-colors hover:bg-sky-400/10">{p.name} ↗</a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
