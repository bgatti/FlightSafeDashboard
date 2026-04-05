/**
 * Shared 3-column footer for portal pages.
 *
 * @param {string}   brand       - Business name
 * @param {string}   address     - Physical address
 * @param {string}   airport     - Airport identifier
 * @param {string}   hours       - Business hours
 * @param {Array}    contactLines - [{label, value}] e.g. [{label:'Phone', value:'(303) 527-1122'}]
 * @param {Array}    socialLinks  - [{label, url}]
 * @param {Array}    resources    - [{label, url}] for resource links column
 * @param {string}   copyright   - Copyright line
 */
export function PortalFooter({ brand, address, airport, hours, contactLines = [], socialLinks = [], resources = [], copyright }) {
  return (
    <footer className="bg-surface-card border-t border-surface-border py-12 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h4 className="text-white font-bold text-lg mb-2">{brand}</h4>
          <p className="text-slate-400 text-sm leading-relaxed">{address}</p>
          {airport && <p className="text-slate-400 text-sm">{airport}</p>}
          {hours && <p className="text-slate-400 text-sm mt-2">{hours}</p>}
        </div>
        <div>
          <h4 className="text-white font-bold mb-2">Contact</h4>
          {contactLines.map((c, i) => (
            <p key={i} className="text-slate-300 text-sm">{c.label ? `${c.label}: ` : ''}{c.value}</p>
          ))}
          {socialLinks.length > 0 && (
            <div className="flex gap-3 mt-3">
              {socialLinks.map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">{l.label}</a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-white font-bold mb-2">Resources</h4>
          <div className="space-y-1">
            {resources.map((r) => (
              <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 text-sm block transition-colors">{r.label} ↗</a>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-surface-border text-center text-slate-600 text-xs">
        {copyright || `© ${new Date().getFullYear()} ${brand}`}
      </div>
    </footer>
  )
}
