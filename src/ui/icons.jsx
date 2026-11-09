// Iconos sencillos del menú (trazos, heredan el color del texto).

function Svg({ children }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const HomeIcon = () => (
  <Svg>
    <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </Svg>
)

export const CalendarIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
)

export const HistoryIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)

export const ChartIcon = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
  </Svg>
)

export const DumbbellIcon = () => (
  <Svg>
    <path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12" />
  </Svg>
)

export const SlidersIcon = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
)
