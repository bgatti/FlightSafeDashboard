// Shared constants for portal components

export const GALLERY_GRADIENTS = [
  'from-sky-600 to-blue-800', 'from-amber-500 to-orange-700', 'from-emerald-500 to-teal-700',
  'from-purple-500 to-indigo-700', 'from-rose-500 to-pink-700', 'from-cyan-500 to-sky-700',
  'from-blue-500 to-indigo-800', 'from-teal-400 to-emerald-700', 'from-indigo-500 to-purple-800',
  'from-sky-400 to-blue-700', 'from-amber-400 to-red-600', 'from-green-500 to-teal-800',
  'from-blue-400 to-sky-800', 'from-violet-500 to-purple-700', 'from-orange-400 to-amber-700',
  'from-cyan-400 to-blue-700',
]

export const STATUS_COLOR = {
  airworthy:   { bg: 'bg-green-400/15', border: 'border-green-400/30', text: 'text-green-400', dot: 'bg-green-400', label: 'Airworthy' },
  maintenance: { bg: 'bg-amber-400/15', border: 'border-amber-400/30', text: 'text-amber-400', dot: 'bg-amber-400', label: 'In Maintenance' },
  grounded:    { bg: 'bg-red-400/15',   border: 'border-red-400/30',   text: 'text-red-400',   dot: 'bg-red-400',   label: 'Grounded' },
}

export const fmt$ = (n) => n != null ? `$${n}` : 'Call'

// Aircraft type photos — Wikimedia Commons CC-licensed thumbnails
const WM = 'https://upload.wikimedia.org/wikipedia/commons/thumb'
export const AIRCRAFT_TYPE_PHOTOS = {
  // ── Powered singles ──
  'Cessna 150':      `${WM}/5/55/Cessna_150M_%28cropped%29.jpg/400px-Cessna_150M_%28cropped%29.jpg`,
  'Diamond DA20':    `${WM}/1/1e/Diamond_DA20_%288735090139%29.jpg/400px-Diamond_DA20_%288735090139%29.jpg`,
  'Cessna 172':      `${WM}/b/b0/Cessna_172S_Skyhawk_SP%2C_Private_JP6817606.jpg/400px-Cessna_172S_Skyhawk_SP%2C_Private_JP6817606.jpg`,
  'Cessna 182':      `${WM}/1/13/Cessna182t_skylane_n2231f_cotswoldairshow_2010_arp.jpg/400px-Cessna182t_skylane_n2231f_cotswoldairshow_2010_arp.jpg`,
  'Citabria':        `${WM}/0/03/Citabria_7GCBC.jpg/400px-Citabria_7GCBC.jpg`,
  'Pipistrel Alpha': `${WM}/9/9c/F-WLAB_Pipistrel_Alpha_Electro_3_%28cropped%29_2.jpg/400px-F-WLAB_Pipistrel_Alpha_Electro_3_%28cropped%29_2.jpg`,
  'Pipistrel Virus': `${WM}/e/eb/G-PIVI_Pipistrel_Virus_SW127.jpg/400px-G-PIVI_Pipistrel_Virus_SW127.jpg`,
  'Piper Cherokee':  `${WM}/5/53/Piper_PA-28-140_Cherokee_%28D-EHMM%29_05.jpg/400px-Piper_PA-28-140_Cherokee_%28D-EHMM%29_05.jpg`,
  // ── Gliders ──
  'Schweizer SGS 2-32': `${WM}/2/2b/Schweizer_SGS_2-32_%28N32GG%29.jpg/400px-Schweizer_SGS_2-32_%28N32GG%29.jpg`,
  'Schweizer SGS 2-33': `${WM}/7/73/Schweizer_SGS_2-33A_%28N57835%29_01.jpg/400px-Schweizer_SGS_2-33A_%28N57835%29_01.jpg`,
  'Schweizer SGS 1-34': `${WM}/a/a1/Schweizer_SGS_1-34.jpg/400px-Schweizer_SGS_1-34.jpg`,
  'Grob G 103':         `${WM}/4/40/Grob_g103a_twin_ii_acro_d-3686_arp.jpg/400px-Grob_g103a_twin_ii_acro_d-3686_arp.jpg`,
  // ── Tow planes ──
  'Piper PA-25':     `${WM}/3/32/Piper.pa25.pawnee.g-bdpb.arp.jpg/400px-Piper.pa25.pawnee.g-bdpb.arp.jpg`,
  'PA-25':           `${WM}/3/32/Piper.pa25.pawnee.g-bdpb.arp.jpg/400px-Piper.pa25.pawnee.g-bdpb.arp.jpg`,
  'Pawnee':          `${WM}/3/32/Piper.pa25.pawnee.g-bdpb.arp.jpg/400px-Piper.pa25.pawnee.g-bdpb.arp.jpg`,
  'Piper PA-18':     `${WM}/7/71/Piper_PA-18-150_Super_Cub_%28D-EFHK%29_02.jpg/400px-Piper_PA-18-150_Super_Cub_%28D-EFHK%29_02.jpg`,
  'Super Cub':       `${WM}/7/71/Piper_PA-18-150_Super_Cub_%28D-EFHK%29_02.jpg/400px-Piper_PA-18-150_Super_Cub_%28D-EFHK%29_02.jpg`,
}

/** Look up type photo by makeModel string (fuzzy match on type prefix) */
export function getAircraftPhoto(makeModel) {
  if (!makeModel) return null
  for (const [key, url] of Object.entries(AIRCRAFT_TYPE_PHOTOS)) {
    if (makeModel.includes(key)) return url
  }
  return null
}
