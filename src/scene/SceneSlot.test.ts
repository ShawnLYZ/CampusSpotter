import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Forecast } from '@engine/index.ts';

const h = vi.hoisted(() => ({ gl: false, canvasLoaded: false }));
vi.mock('./webgl.ts', () => ({ hasWebGL: () => h.gl }));
vi.mock('./CampusCanvas.tsx', () => {
  h.canvasLoaded = true;
  return { CampusCanvas: () => null };
});

/** Just enough of a forecast for the placeholder panel (APU stop wait at the step). */
const fake = (minutes: number): Forecast => ({
  metrics: { apuStopQueue: { steps: Array.from({ length: 76 }, () => ({ value: minutes, status: 'ok', pressure: 'green', provenance: 'ai' })) } },
} as unknown as Forecast);

async function render(props: Record<string, unknown>) {
  vi.resetModules(); // SceneSlot memoises hasWebGL per module load
  const { SceneSlot } = await import('./SceneSlot.tsx');
  return renderToStaticMarkup(createElement(SceneSlot, { mode: 'single', forecasts: [fake(12)], step: 10, ...props } as never));
}

describe('SceneSlot without WebGL (Review Focus 5)', () => {
  beforeEach(() => { h.gl = false; h.canvasLoaded = false; });

  it('shows the message and the placeholder panel, inside the data-scene root', async () => {
    const html = await render({});
    expect(html).toContain('3D view needs WebGL — showing summary instead');
    expect(html).toContain('APU stop wait at 9:30 AM:');
    expect(html).toContain('aria-label="Open campus details"');
    expect(html).toMatch(/^<div data-scene=""/);
  });

  it('shows one panel per forecast with captions in split mode', async () => {
    const html = await render({ mode: 'split', forecasts: [fake(5), fake(0), fake(9)], captions: ['No action', 'With plan'] });
    expect(html.match(/Open campus details/g)).toHaveLength(2);
    expect(html).toContain('No action');
    expect(html).toContain('With plan');
  });

  it('never loads the 3D canvas module (three.js)', async () => {
    await render({});
    expect(h.canvasLoaded).toBe(false);
  });
});

describe('SceneSlot with WebGL', () => {
  beforeEach(() => { h.canvasLoaded = false; });
  it('renders the loading box while the lazy canvas loads, not the fallback', async () => {
    h.gl = true;
    const html = await render({});
    expect(html).not.toContain('3D view needs WebGL');
    expect(html).toContain('aria-label="Loading 3D view"');
    await vi.waitFor(() => expect(h.canvasLoaded).toBe(true)); // control for the "never loads" case above
  });
});
