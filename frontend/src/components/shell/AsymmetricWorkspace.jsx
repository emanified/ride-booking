/**
 * Edge-to-edge immersive canvas + floating inspector stack.
 */

export function ImmersiveMapCanvas({ label = 'Telemetry', children }) {
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#f5f5f7]"
      style={{ zIndex: 0 }}
    >
      <div className="absolute top-[-15%] left-[5%] w-[55%] h-[55%] rounded-full bg-yellow-400/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[5%] w-[45%] h-[45%] rounded-full bg-zinc-300/40 blur-[120px] pointer-events-none" />
      <div className="absolute top-[35%] right-[25%] w-[30%] h-[30%] rounded-full bg-yellow-300/8 blur-[100px] pointer-events-none" />

      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-600/80">Live canvas</p>
        <p className="text-sm font-semibold text-zinc-500 mt-1">{label}</p>
      </div>

      {/* Map + overlays — full area, pointer events on by default */}
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}

export function GlassHud({ children, className = '', position = 'top-left' }) {
  const pos = {
    'top-left': 'top-6 left-6 mt-14',
    'top-right': 'top-6 right-[420px]',
    'bottom-left': 'fixed bottom-24 left-6',
    'bottom-center': 'fixed bottom-24 left-1/2 -translate-x-1/2',
  }
  return (
    <div
      className={`panel-enter z-10 ${pos[position]} max-w-[min(calc(100vw-3rem),520px)] bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-lg ${className}`}
    >
      {children}
    </div>
  )
}

export function FloatingInspectorPane({ children, className = '', wide = false }) {
  return (
    <div
      className={`fixed z-20 top-4 ${
        wide ? 'left-4 right-4' : 'right-4 w-[min(calc(100vw-2rem),400px)]'
      } ${className}`}
      style={{ bottom: '5.5rem' }}
    >
      <div
        className={`h-full overflow-y-auto scrollbar-thin mx-auto w-full ${
          wide
            ? 'max-w-[1280px] grid grid-cols-1 lg:grid-cols-2 gap-4 content-start'
            : 'flex flex-col gap-2'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export function InspectorModule({ title, subtitle, children, footer, className = '' }) {
  return (
    <div
      className={`panel-enter flex flex-col bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg overflow-hidden ${className}`}
    >
      {(title || subtitle) && (
        <div className="px-5 py-3 border-b border-zinc-200/60 shrink-0">
          {title && <h2 className="text-sm font-bold text-zinc-900">{title}</h2>}
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="flex flex-col p-4 overflow-y-auto scrollbar-thin">
        {children}
      </div>
      {footer && <div className="px-5 py-3 border-t border-zinc-200/60 shrink-0">{footer}</div>}
    </div>
  )
}

export default function AsymmetricWorkspace({ mapLabel, mapOverlay, inspector, wide = false }) {
  return (
    <div className="relative w-full h-[100svh]">
      <ImmersiveMapCanvas label={mapLabel}>{mapOverlay}</ImmersiveMapCanvas>
      <FloatingInspectorPane wide={wide}>{inspector}</FloatingInspectorPane>
    </div>
  )
}

const PANEL_WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

export function FloatingPanel({ children, width = 'md', className = '' }) {
  return (
    <div
      className={`relative z-10 mx-auto w-full ${PANEL_WIDTHS[width] || PANEL_WIDTHS.md} min-h-[100svh] flex flex-col pt-6 sm:pt-10 px-4 sm:px-6 pb-28`}
    >
      <div
        className={`panel-enter flex-1 bg-white/88 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg p-6 sm:p-8 ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

export function ImmersiveScreen({ mapLabel = 'Workspace', children }) {
  return (
    <div className="relative w-full">
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none bg-[#f5f5f7]"
        style={{ zIndex: 0 }}
      >
        <div className="absolute top-[-15%] left-[5%] w-[55%] h-[55%] rounded-full bg-yellow-400/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[45%] h-[45%] rounded-full bg-zinc-300/40 blur-[120px]" />
        <div className="absolute top-[35%] right-[25%] w-[30%] h-[30%] rounded-full bg-yellow-300/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute top-6 left-6 z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-600/80">Live canvas</p>
          <p className="text-sm font-semibold text-zinc-500 mt-1">{mapLabel}</p>
        </div>
      </div>
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}