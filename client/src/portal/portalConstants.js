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
// Uses thumb.php API (more reliable than hash-based /thumb/ paths)
const wm = (f) => `https://commons.wikimedia.org/w/thumb.php?width=400&f=${encodeURIComponent(f)}`
export const AIRCRAFT_TYPE_PHOTOS = {
  // ── Multi-engine / turboprop ──
  'Beechcraft Baron': wm('Beechcraft_Baron_58_(D-IBBA)_02.jpg'),
  'Baron 58':         wm('Beechcraft_Baron_58_(D-IBBA)_02.jpg'),
  'Cessna 208':       wm('Cessna208FedEx.jpg'),
  'Piper PA-34':      wm('Piper_PA-34-200T_Seneca_II,_Aeroclub_Barcelona-Sabadell_JP6311561.jpg'),
  'Seneca':           wm('Piper_PA-34-200T_Seneca_II,_Aeroclub_Barcelona-Sabadell_JP6311561.jpg'),
  // ── Powered singles ──
  'Cessna 150':      wm('Cessna_150M_(cropped).jpg'),
  'Diamond DA20':    wm('Diamond_DA20_(8735090139).jpg'),
  'Cessna 172':      wm('Cessna_172S_Skyhawk_SP,_Private_JP6817606.jpg'),
  'Cessna 172P':     wm('Cessna_172S_Skyhawk_SP,_Private_JP6817606.jpg'),
  'Cessna 172N':     wm('Cessna_172S_Skyhawk_SP,_Private_JP6817606.jpg'),
  'Cessna 172G':     wm('Cessna_172S_Skyhawk_SP,_Private_JP6817606.jpg'),
  'Cessna 172S':     wm('Cessna_172S_Skyhawk_SP,_Private_JP6817606.jpg'),
  'Cessna 182':      wm('Cessna182t_skylane_n2231f_cotswoldairshow_2010_arp.jpg'),
  'Citabria':        wm('Citabria_7GCBC.jpg'),
  'Pipistrel Alpha': wm('F-WLAB_Pipistrel_Alpha_Electro_3_(cropped)_2.jpg'),
  'Pipistrel Virus': wm('G-PIVI_Pipistrel_Virus_SW127.jpg'),
  'Piper Cherokee':  wm('Piper_PA-28-140_Cherokee_(D-EHMM)_05.jpg'),
  // ── Gliders ──
  'Schweizer SGS 2-32': wm('Schweizer2-32-01.JPG'),
  'Schweizer SGS 2-33': wm('Schweizer_SGS_2-33A_N17968.jpg'),
  'Schweizer SGS 1-34': wm('Schweizer_SGS_1-34.jpg'),
  'Grob G 103':         wm('Grob_G103_Twin_Astir_(5718084287).jpg'),
  'Grob G103':          wm('Grob_G103_Twin_Astir_(5718084287).jpg'),
  // ── Tow planes ──
  'Piper PA-25':     wm('Piper_PA-25-235_Pawnee_C,_PH-BEW,_Belgian_Air_Forse_Days_2018.JPG'),
  'PA-25':           wm('Piper_PA-25-235_Pawnee_C,_PH-BEW,_Belgian_Air_Forse_Days_2018.JPG'),
  'Pawnee':          wm('Piper_PA-25-235_Pawnee_C,_PH-BEW,_Belgian_Air_Forse_Days_2018.JPG'),
  'Piper PA-18':     wm('Piper_PA-18_Super_Cub_(VH-HFT)_at_the_2013_Australian_International_Airshow.jpg'),
  'Super Cub':       wm('Piper_PA-18_Super_Cub_(VH-HFT)_at_the_2013_Australian_International_Airshow.jpg'),
}

/** Look up type photo by makeModel string (fuzzy match on type prefix) */
export function getAircraftPhoto(makeModel) {
  if (!makeModel) return null
  for (const [key, url] of Object.entries(AIRCRAFT_TYPE_PHOTOS)) {
    if (makeModel.includes(key)) return url
  }
  return null
}
