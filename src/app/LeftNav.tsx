import { NavLink } from 'react-router';
import { CircleHelp } from 'lucide-react';
import { NAV_GROUPS } from './navItems.ts';
import { useGuide } from './guide.ts';

/** CampusSpotter app icon (source: CampusSpotter_Icon.png, resized into public/brand). No APU logo (PRD §3.14). */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src="/brand/logo-64.png" alt="" aria-hidden="true" width={32} height={32} className={`shrink-0 ${className}`} />;
}

export default function LeftNav() {
  const openGuide = useGuide((s) => s.open);
  return (
    <nav aria-label="Main" className="flex min-h-0 flex-col border-r border-border bg-panel">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <BrandMark />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">CampusSpotter</div>
          <div className="text-xs text-text-2">for Asia Pacific University</div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-xs font-medium text-text-3">{g.title}</p>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.end}
                    className={({ isActive }) => `group relative flex items-center gap-3 rounded-lg py-2 pr-3 transition-colors ${i.sub ? 'pl-6' : 'pl-3'} ${
                      isActive ? 'bg-accent-soft text-text' : 'text-text-2 hover:bg-panel-2 hover:text-text'}`}>
                    {({ isActive }) => (
                      <>
                        <i.Icon aria-hidden="true" strokeWidth={2}
                          className={`shrink-0 ${i.sub ? 'h-4 w-4' : 'h-[18px] w-[18px]'} ${isActive ? 'text-accent' : 'text-text-3 group-hover:text-text-2'}`} />
                        <span className="min-w-0">
                          <span className={`block text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{i.label}</span>
                          {!i.sub && <span className={`block truncate text-xs ${isActive ? 'text-text-2' : 'text-text-3'}`}>{i.hint}</span>}
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border p-3">
        <button type="button" onClick={openGuide}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-text-2 transition-colors hover:bg-panel-2 hover:text-text">
          <CircleHelp aria-hidden="true" className="h-[18px] w-[18px] text-accent" />
          <span>
            <span className="block font-medium text-text">New here?</span>
            <span className="block text-xs text-text-3">How CampusSpotter works</span>
          </span>
        </button>
      </div>
    </nav>
  );
}
