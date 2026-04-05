import { useState, useMemo } from 'react'
import { GALLERY_GRADIENTS } from './portalConstants'

/**
 * Filterable gallery grid.
 *
 * @param {Array}  gallery - [{id, alt, category, img?}]
 * @param {string} title   - Section heading (default: 'Gallery')
 */
export function GalleryGrid({ gallery, title = 'Gallery' }) {
  const [filter, setFilter] = useState('all')
  const cats = useMemo(() => ['all', ...new Set(gallery.map((g) => g.category))], [gallery])
  const filtered = filter === 'all' ? gallery : gallery.filter((g) => g.category === filter)

  return (
    <section id="sec-gallery" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h2>
        </div>
        <div className="flex gap-2 justify-center mb-6">
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors capitalize ${
                filter === c ? 'bg-sky-500 text-white' : 'bg-surface-card border border-surface-border text-slate-400 hover:text-white'
              }`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <div key={img.id} className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer">
              {img.img ? (
                <img src={img.img} alt={img.alt} loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${GALLERY_GRADIENTS[(img.id - 1) % GALLERY_GRADIENTS.length]} transition-transform group-hover:scale-110 duration-500`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-xs font-medium">{img.alt}</p>
                <span className="text-white/50 text-[10px] capitalize">{img.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
