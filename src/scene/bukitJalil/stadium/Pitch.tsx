import { useMemo } from 'react';
import { Struts, type Segment } from '../helpers/Instanced.tsx';
import { canvasTexture } from '../helpers/textures.ts';

/** Extent of the painted arena floor, in metres. It tucks under the front of the stands. */
const FLOOR_WIDTH = 132;
const FLOOR_LENGTH = 200;
const PIXELS_PER_METRE = 6;

/** Standard 400 m track: 84.39 m straights joined by 36.5 m radius bends. */
const STRAIGHT_HALF = 84.39 / 2;
const INNER_RADIUS = 36.5;
const LANE_WIDTH = 1.22;
const LANES = 9;

const PITCH_HALF_WIDTH = 34;
const PITCH_HALF_LENGTH = 52.5;

/** Traces the track oval at a given bend radius. Canvas +Y is south. */
function oval(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  ctx.moveTo(radius, -STRAIGHT_HALF);
  ctx.lineTo(radius, STRAIGHT_HALF);
  ctx.arc(0, STRAIGHT_HALF, radius, 0, Math.PI);
  ctx.lineTo(-radius, -STRAIGHT_HALF);
  ctx.arc(0, -STRAIGHT_HALF, radius, Math.PI, Math.PI * 2);
  ctx.closePath();
}

function paintFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2b5fae';
  ctx.fillRect(0, 0, w, h);

  // Work in metres from here on, origin at the centre spot.
  ctx.translate(w / 2, h / 2);
  ctx.scale(PIXELS_PER_METRE, PIXELS_PER_METRE);

  const trackOuter = INNER_RADIUS + LANES * LANE_WIDTH;
  oval(ctx, trackOuter + 4);
  ctx.fillStyle = '#3a72c6';
  ctx.fill();

  // The blue track fitted in the 2017 refurbishment.
  oval(ctx, trackOuter);
  ctx.fillStyle = '#2f7de2';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 0.14;
  for (let lane = 0; lane <= LANES; lane++) {
    oval(ctx, INNER_RADIUS + lane * LANE_WIDTH);
    ctx.stroke();
  }

  // Infield: blue D-ends for field events, grass between.
  oval(ctx, INNER_RADIUS - 0.1);
  ctx.fillStyle = '#2867c2';
  ctx.fill();

  ctx.save();
  oval(ctx, INNER_RADIUS - 1.2);
  ctx.clip();
  ctx.fillStyle = '#3b8f37';
  ctx.fillRect(-36, -55.5, 72, 111);
  const stripes = 18;
  const stripe = (PITCH_HALF_LENGTH * 2) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#439c3d' : '#378a34';
    ctx.fillRect(-PITCH_HALF_WIDTH - 2, -PITCH_HALF_LENGTH + i * stripe, PITCH_HALF_WIDTH * 2 + 4, stripe);
  }
  ctx.restore();

  // Pitch markings.
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 0.28;
  ctx.strokeRect(-PITCH_HALF_WIDTH, -PITCH_HALF_LENGTH, PITCH_HALF_WIDTH * 2, PITCH_HALF_LENGTH * 2);
  ctx.beginPath();
  ctx.moveTo(-PITCH_HALF_WIDTH, 0);
  ctx.lineTo(PITCH_HALF_WIDTH, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 9.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 0.4, 0, Math.PI * 2);
  ctx.fill();

  for (const end of [-1, 1]) {
    const goalLine = end * PITCH_HALF_LENGTH;
    // strokeRect needs the top edge, which is the goal line only at the north end.
    const boxTop = (depth: number) => (end > 0 ? goalLine - depth : goalLine);
    ctx.strokeRect(-20.16, boxTop(16.5), 40.32, 16.5);
    ctx.strokeRect(-9.16, boxTop(5.5), 18.32, 5.5);

    const spot = end * (PITCH_HALF_LENGTH - 11);
    ctx.beginPath();
    ctx.arc(0, spot, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // The "D": the part of the 9.15 m circle outside the penalty area.
    const towardsCentre = end > 0 ? -Math.PI / 2 : Math.PI / 2;
    ctx.beginPath();
    ctx.arc(0, spot, 9.15, towardsCentre - 0.926, towardsCentre + 0.926);
    ctx.stroke();
  }
}

/** Goal frames: two posts and a crossbar at each end. */
const GOALS: Segment[] = [-1, 1].flatMap((end): Segment[] => {
  const z = end * PITCH_HALF_LENGTH;
  return [
    [
      [-3.66, 0, z],
      [-3.66, 2.44, z],
    ],
    [
      [3.66, 0, z],
      [3.66, 2.44, z],
    ],
    [
      [-3.66, 2.44, z],
      [3.66, 2.44, z],
    ],
    [
      [-3.66, 2.44, z],
      [-3.66, 0, z + end * 2],
    ],
    [
      [3.66, 2.44, z],
      [3.66, 0, z + end * 2],
    ],
  ];
});

/** Pitch, blue running track and arena floor, painted onto a single plane. */
export function Pitch() {
  const texture = useMemo(() => canvasTexture(FLOOR_WIDTH * PIXELS_PER_METRE, FLOOR_LENGTH * PIXELS_PER_METRE, paintFloor, 16), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_LENGTH]} />
        <meshStandardMaterial map={texture} roughness={0.95} />
      </mesh>
      <Struts segments={GOALS} radius={0.07} color="#ffffff" castShadow={false} />
    </group>
  );
}
