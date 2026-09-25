// Static color mapping for tags — Tailwind v4 purges dynamic class names
// so we must use complete class names, not template strings like `bg-${color}-50`
export const TAG_COLOR_CLASSES: Record<string, {
  badge: string
  buttonSelected: string
  buttonUnselected: string
}> = {
  blue: {
    badge: 'bg-blue-50 border-blue-200 text-blue-700',
    buttonSelected: 'bg-blue-500 text-white border-blue-500',
    buttonUnselected: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  },
  red: {
    badge: 'bg-red-50 border-red-200 text-red-700',
    buttonSelected: 'bg-red-500 text-white border-red-500',
    buttonUnselected: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
  },
  green: {
    badge: 'bg-green-50 border-green-200 text-green-700',
    buttonSelected: 'bg-green-500 text-white border-green-500',
    buttonUnselected: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  },
  amber: {
    badge: 'bg-amber-50 border-amber-200 text-amber-700',
    buttonSelected: 'bg-amber-500 text-white border-amber-500',
    buttonUnselected: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
  },
  violet: {
    badge: 'bg-violet-50 border-violet-200 text-violet-700',
    buttonSelected: 'bg-violet-500 text-white border-violet-500',
    buttonUnselected: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
  },
  cyan: {
    badge: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    buttonSelected: 'bg-cyan-500 text-white border-cyan-500',
    buttonUnselected: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
  },
  indigo: {
    badge: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    buttonSelected: 'bg-indigo-500 text-white border-indigo-500',
    buttonUnselected: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
  },
  sky: {
    badge: 'bg-sky-50 border-sky-200 text-sky-700',
    buttonSelected: 'bg-sky-500 text-white border-sky-500',
    buttonUnselected: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
  },
  teal: {
    badge: 'bg-teal-50 border-teal-200 text-teal-700',
    buttonSelected: 'bg-teal-500 text-white border-teal-500',
    buttonUnselected: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100',
  },
  rose: {
    badge: 'bg-rose-50 border-rose-200 text-rose-700',
    buttonSelected: 'bg-rose-500 text-white border-rose-500',
    buttonUnselected: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
  },
}

export function getTagColorClasses(color: string) {
  return TAG_COLOR_CLASSES[color] || TAG_COLOR_CLASSES.blue
}
