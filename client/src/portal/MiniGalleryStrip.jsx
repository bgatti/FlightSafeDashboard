import { useState, useEffect, useRef, useMemo } from 'react'
import { GALLERY_GRADIENTS } from './portalConstants'

// Track which image IDs are currently shown across all strips to avoid dupes
let _activeStripImages = new Set()

/**
 * Rotating 3-image gallery strip with crossfade.
 *
 * @param {Array}  gallery  - Full gallery array [{id, alt, category, img?}]
 * @param {string} category - Filter to this category (optional, shows all if omitted)
 */
export function MiniGalleryStrip({ gallery, category }) {
  const seed = useRef(Math.floor(Math.random() * 100))
  const items = useMemo(() => {
    let pool = category ? gallery.filter((g) => g.category === category) : [...gallery]
    if (pool.length < 3) pool = [...gallery]
    pool.sort((a, b) => ((a.id * 7 + seed.current) % 13) - ((b.id * 7 + seed.current) % 13))
    return pool
  }, [gallery, category])

  const [offset, setOffset] = useState(() => seed.current % Math.max(items.length - 2, 1))
  useEffect(() => {
    const id = setInterval(() => setOffset((o) => (o + 1) % Math.max(items.length - 2, 1)), 5000 + seed.current * 50)
    return () => clearInterval(id)
  }, [items.length])

  const candidates = []
  for (let i = 0; candidates.length < 3 && i < items.length; i++) {
    const img = items[(offset + i) % items.length]
    if (!_activeStripImages.has(img.id) || candidates.length + (items.length - i) <= 3) candidates.push(img)
  }
  useEffect(() => {
    const ids = candidates.map((c) => c.id)
    ids.forEach((id) => _activeStripImages.add(id))
    return () => ids.forEach((id) => _activeStripImages.delete(id))
  })

  return (
    <div className="py-6 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-3">
        {candidates.map((img, i) => (
          <div key={`${img.id}-${offset}-${i}`} className="relative aspect-[16/7] rounded-xl overflow-hidden animate-[fadeIn_1s_ease-in-out]">
            {img.img ? (
              <img src={img.img} alt={img.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${GALLERY_GRADIENTS[(img.id - 1 + offset) % GALLERY_GRADIENTS.length]} transition-all duration-1000`}>
                <div className="absolute inset-0 opacity-25">
                  <div className="absolute top-[25%] left-[15%] w-[50%] h-[2px] bg-white/40 rounded-full rotate-[-3deg]" />
                  <div className="absolute top-[45%] left-[25%] w-[35%] h-[1.5px] bg-white/25 rounded-full rotate-[1deg]" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-[10px] font-medium leading-tight">{img.alt}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
