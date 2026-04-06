// Shared FBOSection — display-only FBO services & fuel pricing.
// No store imports, no API calls. Data comes via props.

/**
 * @param {object} props
 * @param {string[]} props.services — FBO service descriptions
 * @param {object} props.fuel — { brand, types: [{type, selfServe, fullServe, unit}] }
 * @param {string} props.brand — company name
 * @param {object} [props.info] — contact info { address, phone, email, hours, radioFreq, groundTransport, maintenancePhone }
 * @param {object} [props.maintenance] — maintenance info lines (rendered as children if provided)
 * @param {React.ReactNode} [props.children] — extra content below
 */
export function FBOSection({
  services = [],
  fuel = {},
  brand,
  info = {},
  children,
}) {
  return (
    <section id="sec-fbo" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">FBO Services & Fuel</h2>
          <p className="text-slate-400">{fuel.brand} fuels · Heated hangars · Full-service maintenance</p>
        </div>

        {/* Fuel prices */}
        {fuel.types && fuel.types.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {fuel.types.map((f) => (
              <div key={f.type} className="bg-surface-card border border-surface-border rounded-2xl p-6 text-center">
                <div className="text-white text-lg font-bold mb-2">{f.type}</div>
                {f.selfServe && <div className="text-green-400 font-bold text-2xl">${f.selfServe}<span className="text-green-400/50 text-sm">/{f.unit}</span></div>}
                {f.selfServe && <div className="text-slate-500 text-xs">Self-serve</div>}
                {f.fullServe && <div className={`${f.selfServe ? 'text-sky-400 text-sm mt-1' : 'text-sky-400 font-bold text-2xl'}`}>${f.fullServe}/{f.unit} full-serve</div>}
              </div>
            ))}
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
            {services.map((svc) => (
              <div key={svc} className="flex items-start gap-3 text-sm">
                <span className="text-sky-400 mt-0.5">+</span>
                <span className="text-slate-300">{svc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Contact cards */}
        {(info.phone || info.address) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
              <h3 className="text-white font-bold text-lg mb-3">FBO & Flight School</h3>
              <div className="space-y-1.5 text-sm text-slate-300">
                {info.address && <div>{info.address}</div>}
                {info.phone && <div>Phone: <span className="text-sky-400">{info.phone}</span></div>}
                {info.email && <div>Email: <span className="text-sky-400">{info.email}</span></div>}
                {info.hours && <div>Hours: {info.hours}</div>}
                {info.radioFreq && <div>UNICOM: {info.radioFreq}</div>}
                {info.groundTransport && <div className="text-slate-500 text-xs mt-2">{info.groundTransport}</div>}
              </div>
            </div>
            {info.maintenancePhone && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
                <h3 className="text-white font-bold text-lg mb-3">Aircraft Maintenance</h3>
                <div className="space-y-1.5 text-sm text-slate-300">
                  <div>Phone: <span className="text-sky-400">{info.maintenancePhone}</span></div>
                  <div>A&P, IA, Rotax iRMT Series 9 certified</div>
                  <div>ROTAX Independent Repair Centre (iRC)</div>
                  <div>SLSA maintenance and repair</div>
                  <div>Annual, 100-hr, conditional & pre-buy inspections</div>
                  <div className="text-slate-500 text-xs mt-2">EV charging available (Class II)</div>
                </div>
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
