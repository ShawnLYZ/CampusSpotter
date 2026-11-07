import { useMemo } from 'react';
import type { Forecast } from '@engine/output.ts';
import { itemById } from './layout.ts';
import { Block } from './parts/Block.tsx';
import { Spine } from './parts/Spine.tsx';
import { Canopy } from './parts/Canopy.tsx';
import { Library } from './parts/Library.tsx';
import { Residences } from './parts/Residences.tsx';
import { CarParks } from './parts/CarParks.tsx';
import { Trees } from './parts/Trees.tsx';
import { Ground } from './parts/Ground.tsx';
import { Road } from './parts/Road.tsx';
import { LrtStation } from './parts/LrtStation.tsx';
import { Stadium } from './parts/Stadium.tsx';
import { MrantiParking } from './parts/MrantiParking.tsx';
import { ZoneHighlight } from './parts/ZoneHighlight.tsx';
import { ZoneLabels } from './parts/ZoneLabel.tsx';
import { ZONES, valueFor, zonePressure } from './zones.ts';
import { pressureStyle, type PressureStyle } from './pressureStyle.ts';
import { labelSeverity } from './labelDeclutter.ts';
import { Buses } from './fx/Buses.tsx';
import { QueueFigures } from './fx/QueueFigures.tsx';
import { SpineParticles } from './fx/SpineParticles.tsx';
import { WindowGlow } from './fx/WindowGlow.tsx';
import { Rain } from './fx/Rain.tsx';
import { StadiumCrowd } from './fx/StadiumCrowd.tsx';
import { formatMetric } from '../lib/format.ts';

/** Concert or sports disruption in the forecast context: MRANTI parking is in use. */
export function hasEventDisruption(forecast: Forecast): boolean {
  return forecast.context.disruptions.some((d) => d.kind === 'concert' || d.kind === 'sports');
}

export interface CampusSceneProps {
  forecast: Forecast;
  step: number;
  selectedZone: string | null;
  /** Hourly precipitation (20 points); drives rain. */
  weatherMm?: (number | null)[];
  onZoneClick?: (zoneId: string) => void;
  /** A click on empty ground (zones stop their own clicks, so this only sees misses). */
  onGroundClick?: () => void;
}

/** One campus model for one forecast, with pressure highlights and labels. Stateless. */
export function CampusScene({ forecast, step, selectedZone, weatherMm, onZoneClick, onGroundClick }: CampusSceneProps) {
  const states = useMemo(() => ZONES.map((zone) => {
    const { pressure, status, worst } = zonePressure(zone, forecast, step);
    const v = worst ? valueFor(worst, forecast, step) : undefined;
    return { zone, style: pressureStyle(pressure, status), severity: labelSeverity(pressure, status), valueText: worst && v ? formatMetric(worst.metric, v) : '' };
  }), [forecast, step]);
  const eventDisruption = hasEventDisruption(forecast);
  const roadStyles = useMemo(() => {
    const out: Record<string, PressureStyle> = {};
    for (const s of states) if (s.zone.outline === 'path') out[s.zone.id] = s.style;
    return out;
  }, [states]);

  const block = (id: string, extra: { roof?: 'plate' | 'green'; perforated?: boolean } = {}) => (
    <Block key={id} item={itemById(id)!} onZoneClick={onZoneClick} {...extra} />
  );
  return (
    <>
      <Ground onClick={onGroundClick} />
      {block('block-a')}
      {block('block-b', { perforated: true })}
      {block('block-c')}
      {block('block-d')}
      {block('block-e', { roof: 'green' })}
      <Canopy onZoneClick={onZoneClick} />
      <Library onZoneClick={onZoneClick} />
      <Spine onZoneClick={onZoneClick} />
      <Residences onZoneClick={onZoneClick} />
      <CarParks onZoneClick={onZoneClick} />
      <Trees />
      <Road onZoneClick={onZoneClick} styles={roadStyles} selectedZone={selectedZone} />
      <LrtStation onZoneClick={onZoneClick} />
      <Stadium onZoneClick={onZoneClick} glowing={eventDisruption} />
      <MrantiParking visible={eventDisruption} onZoneClick={onZoneClick} />
      <Buses forecast={forecast} step={step} />
      <QueueFigures forecast={forecast} step={step} />
      <SpineParticles forecast={forecast} step={step} />
      <WindowGlow forecast={forecast} step={step} />
      <Rain weatherMm={weatherMm} step={step} />
      {eventDisruption && <StadiumCrowd forecast={forecast} step={step} />}
      {states.map(({ zone, style }) => (
        <ZoneHighlight key={zone.id} zone={zone} style={style} selected={zone.id === selectedZone}
          hidden={zone.id === 'mranti-parking' && !eventDisruption} />
      ))}
      <ZoneLabels states={states} selectedZone={selectedZone} />
    </>
  );
}
