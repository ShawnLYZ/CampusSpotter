import { Sign } from '../helpers/Sign.tsx';
import { Pitch } from './Pitch.tsx';
import { SeatingBowl } from './SeatingBowl.tsx';
import { StadiumRoof } from './StadiumRoof.tsx';
import { StadiumShell } from './StadiumShell.tsx';

/** Giant screens hung over the top rows at the north and south ends, facing the pitch. */
function Scoreboards() {
  return (
    <>
      {[-1, 1].map((end) => (
        <Sign
          key={end}
          position={[0, 39.5, end * 124]}
          rotation={[0, end > 0 ? Math.PI : 0, 0]}
          width={34}
          height={9}
          depth={1.4}
          text="STADIUM NASIONAL BUKIT JALIL"
          subtitle="KUALA LUMPUR SPORTS CITY"
          background={['#0b1b3a', '#12306a']}
          color="#ffd23f"
          textScale={0.36}
          glow={0.6}
        />
      ))}
    </>
  );
}

/** Stadium Nasional Bukit Jalil, centred on the model origin with its pitch running north–south. `glowing` lights it up for an event. */
export function Stadium({ glowing = false }: { glowing?: boolean }) {
  return (
    <group>
      <Pitch />
      <SeatingBowl />
      <StadiumShell glowing={glowing} />
      <StadiumRoof glowing={glowing} />
      <Scoreboards />
    </group>
  );
}
