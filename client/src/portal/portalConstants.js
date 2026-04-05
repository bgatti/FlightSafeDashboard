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
