import { NavLink } from 'react-router';

const ITEMS = [
  { to: '/', label: 'Command Center', end: true },
  { to: '/early-warning', label: 'Early Warning', end: false },
  { to: '/scenario-lab', label: 'Scenario Lab', end: false },
  { to: '/action-plans', label: 'Action Plans', end: true },
  { to: '/action-plans/log', label: 'Decision Log', end: true, sub: true },
  { to: '/replay', label: 'Replay: 4 Nov', end: false },
  { to: '/data', label: 'Data & Assumptions', end: false },
];

export default function LeftNav() {
  return (
    <nav aria-label="Main" className="flex flex-col border-r border-border bg-panel">
      <div className="h-14 border-b border-border px-4 py-2">
        <div className="text-base font-semibold">CampusSpotter</div>
        <div className="text-xs text-text-2">for Asia Pacific University</div>
      </div>
      <ul className="flex flex-col gap-1 p-3">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `block rounded-md py-2 text-sm ${'sub' in i ? 'pl-7 pr-3' : 'px-3'} ${isActive ? 'bg-panel-2 font-medium text-text' : 'text-text-2 hover:bg-panel-2 hover:text-text'}`}
            >
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
