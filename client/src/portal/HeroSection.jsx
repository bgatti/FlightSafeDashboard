// Shared HeroSection — used by MileHighGliding, JourneysBoulder, etc.
// Display-only: all data via props, no store imports.

/**
 * @param {object} props
 * @param {string} props.brand — company name
 * @param {string} props.subtitle — tagline / hero heading (supports JSX)
 * @param {object} props.info — { phone, website, address, hours, ... }
 * @param {string} [props.bgGradient] — Tailwind gradient classes for background
 * @param {function} [props.onBook] — primary CTA handler
 * @param {string} [props.bookLabel] — primary CTA button text
 * @param {string} [props.secondaryLabel] — secondary CTA text
 * @param {string} [props.secondaryHref] — secondary CTA link
 * @param {string} [props.tagline] — small text above heading (e.g. "Boulder, Colorado · Est. 1998")
 * @param {string[]} [props.badges] — bottom badges row (e.g. ["12 aircraft", "Mountain flying"])
 * @param {React.ReactNode} [props.backgroundSlot] — custom background (video, SVG, etc.)
 * @param {React.ReactNode} [props.children] — extra content below hero
 */
export function HeroSection({
  brand,
  subtitle,
  info = {},
  bgGradient = 'bg-gradient-to-b from-slate-950 via-blue-950 to-indigo-950',
  onBook,
  bookLabel = 'Book a Discovery Flight',
  secondaryLabel,
  secondaryHref,
  tagline,
  badges = [],
  backgroundSlot,
  children,
}) {
  return (
    <section className="relative min-h-screen flex items-center justify-center">
      {/* Background — either custom slot or gradient */}
      {backgroundSlot || (
        <div className={`absolute inset-0 ${bgGradient}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      <div className="relative z-10 text-center px-6 max-w-3xl">
        {tagline && (
          <div className="text-sky-300/70 text-xs uppercase tracking-[0.4em] mb-3">{tagline}</div>
        )}
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight leading-[1.1]">
          {subtitle}
        </h1>
        {children && <div className="mb-8">{children}</div>}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {onBook ? (
            <button onClick={onBook}
              className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-sky-500/25 hover:shadow-sky-400/30 hover:scale-105">
              {bookLabel}
            </button>
          ) : info.phone ? (
            <a href={`tel:${info.phone.replace(/[^\d]/g, '')}`}
              className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-sky-500/25 hover:shadow-sky-400/30 hover:scale-105">
              {bookLabel}
            </a>
          ) : null}
          {secondaryHref ? (
            <a href={secondaryHref} target={secondaryHref.startsWith('tel:') ? undefined : '_blank'} rel={secondaryHref.startsWith('tel:') ? undefined : 'noopener noreferrer'}
              className="border-2 border-white/30 hover:border-white/60 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all backdrop-blur-sm hover:bg-white/10">
              {secondaryLabel || secondaryHref}
            </a>
          ) : info.phone && onBook ? (
            <a href={`tel:${info.phone.replace(/[^\d]/g, '')}`}
              className="border-2 border-white/30 hover:border-white/60 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all backdrop-blur-sm hover:bg-white/10">
              Call {info.phone}
            </a>
          ) : null}
        </div>
        {badges.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-6 justify-center text-white/50 text-xs">
            {badges.map((b, i) => <span key={i}>{b}</span>)}
          </div>
        )}
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/40">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      </div>
    </section>
  )
}
