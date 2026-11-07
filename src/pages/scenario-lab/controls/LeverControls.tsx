import { BLOCK_IDS } from '@engine/index.ts';
import type { InputBundle, Lever, LeverKind } from '@engine/index.ts';
import { BlockPicker, SelectField, Stepper, TimeSelect, WindowFields } from './fields.tsx';

type Of<K extends LeverKind> = Extract<Lever, { kind: K }>;
interface P<K extends LeverKind> { lever: Of<K>; bundle: InputBundle; onChange: (l: Lever) => void }

function ClassesOnline({ lever, onChange }: P<'classesOnline'>) {
  return (<>
    <WindowFields fromMin={lever.fromMin} toMin={lever.toMin} onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin })} />
    <BlockPicker value={lever.blocks} onChange={(blocks) => onChange({ ...lever, blocks })} />
  </>);
}

function Stagger({ lever, onChange }: P<'stagger'>) {
  return (<>
    <SelectField label="Shift" value={lever.target} options={[{ value: 'start', label: 'Start times' }, { value: 'end', label: 'End times' }]}
      onChange={(target) => onChange({ ...lever, target })} />
    <WindowFields fromMin={lever.fromMin} toMin={lever.toMin} onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin })} />
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {BLOCK_IDS.map((b) => (
        <Stepper key={b} label={`Block ${b} shift`} value={lever.shifts[b] ?? 0} min={0} max={30} step={5}
          onChange={(v) => onChange({ ...lever, shifts: { ...lever.shifts, [b]: v } })} />
      ))}
    </div>
    <p className="text-xs text-text-3">Shift in minutes, 0 to 30 per block.</p>
  </>);
}

function ExtraBuses({ lever, onChange }: P<'extraBuses'>) {
  return (<>
    <Stepper label="Extra buses" value={lever.buses} min={1} max={10} onChange={(buses) => onChange({ ...lever, buses })} />
    <WindowFields fromMin={lever.fromMin} toMin={lever.toMin} onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin })} />
  </>);
}

function LoopWindow({ lever, onChange }: P<'nonstopLoop'>) {
  return <WindowFields fromMin={lever.fromMin} toMin={lever.toMin} onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin })} />;
}

function BusesAtLrt({ lever, bundle, onChange }: P<'busesAtLrt'>) {
  return (<>
    <Stepper label="Buses at LRT" value={lever.buses} min={1} max={Math.max(1, bundle.baseline.fleetSize.value)} onChange={(buses) => onChange({ ...lever, buses })} />
    <TimeSelect label="At" value={lever.atMin} onChange={(atMin) => onChange({ ...lever, atMin })} />
  </>);
}

function Cafeteria({ lever, bundle, onChange }: P<'cafeteria'>) {
  return (<>
    <SelectField label="Outlet" value={lever.outletId} options={bundle.baseline.cafeterias.map((o) => ({ value: o.id, label: o.name }))}
      onChange={(outletId) => onChange({ ...lever, outletId })} />
    <Stepper label="Extra counters" value={lever.extraCounters} min={0} max={5} onChange={(extraCounters) => onChange({ ...lever, extraCounters })} />
    <WindowFields fromMin={lever.fromMin} toMin={lever.toMin}
      onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin, closeAtMin: lever.closeAtMin !== null ? Math.min(lever.closeAtMin, toMin) : null })} />
    <TimeSelect label="Close at" value={lever.closeAtMin} max={lever.toMin} noneLabel="Normal hours"
      onChange={(closeAtMin) => onChange({ ...lever, closeAtMin })} onNone={() => onChange({ ...lever, closeAtMin: null })} />
  </>);
}

function WaitingHall({ lever, bundle, onChange }: P<'waitingHall'>) {
  return (<>
    <SelectField label="Hall" value={lever.hallId} options={bundle.baseline.waitingHalls.map((h) => ({ value: h.id, label: h.name }))}
      onChange={(hallId) => onChange({ ...lever, hallId })} />
    <WindowFields fromMin={lever.fromMin} toMin={lever.toMin} onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin })} />
  </>);
}

function AcOff({ lever, onChange }: P<'acOffInGap'>) {
  return (<>
    <WindowFields fromMin={lever.fromMin} toMin={lever.toMin} onChange={(fromMin, toMin) => onChange({ ...lever, fromMin, toMin })} />
    <BlockPicker value={lever.blocks} onChange={(blocks) => onChange({ ...lever, blocks })} />
  </>);
}

const MESSAGES = [
  { value: 'leave_before', label: 'Leave before' },
  { value: 'walk_to_lrt', label: 'Walk to the LRT' },
  { value: 'expect_delays', label: 'Expect delays' },
] as const;

function Advisory({ lever, onChange }: P<'advisory'>) {
  return (<>
    <TimeSelect label="Advised time" value={lever.advisedMin} onChange={(advisedMin) => onChange({ ...lever, advisedMin })} />
    <SelectField label="Message" value={lever.message} options={[...MESSAGES]} onChange={(message) => onChange({ ...lever, message })} />
  </>);
}

function StudentCount({ lever, onChange }: P<'studentCount'>) {
  return <Stepper label="Student count change (%)" value={lever.percent} min={-30} max={50} step={5} onChange={(percent) => onChange({ ...lever, percent })} />;
}

export function LeverControls({ lever, bundle, onChange }: { lever: Lever; bundle: InputBundle; onChange: (l: Lever) => void }) {
  switch (lever.kind) {
    case 'classesOnline': return <ClassesOnline lever={lever} bundle={bundle} onChange={onChange} />;
    case 'stagger': return <Stagger lever={lever} bundle={bundle} onChange={onChange} />;
    case 'extraBuses': return <ExtraBuses lever={lever} bundle={bundle} onChange={onChange} />;
    case 'nonstopLoop': return <LoopWindow lever={lever} bundle={bundle} onChange={onChange} />;
    case 'busesAtLrt': return <BusesAtLrt lever={lever} bundle={bundle} onChange={onChange} />;
    case 'cafeteria': return <Cafeteria lever={lever} bundle={bundle} onChange={onChange} />;
    case 'waitingHall': return <WaitingHall lever={lever} bundle={bundle} onChange={onChange} />;
    case 'acOffInGap': return <AcOff lever={lever} bundle={bundle} onChange={onChange} />;
    case 'advisory': return <Advisory lever={lever} bundle={bundle} onChange={onChange} />;
    case 'studentCount': return <StudentCount lever={lever} bundle={bundle} onChange={onChange} />;
  }
}
