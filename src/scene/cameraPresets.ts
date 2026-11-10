import { STADIUM_AT, STATION_AT } from './bukitJalil/placement.ts';

export type Vec3 = [number, number, number];

export type CameraPresetId = 'overview' | 'campus' | 'lrt' | 'stadium';

export interface CameraPose { position: Vec3; target: Vec3 }

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPose> = {
  overview: { position: [-40, 205, 150], target: [-40, 0, 28] },
  campus: { position: [46, 30, 36], target: [3, 3, -9] },
  lrt: { position: [STATION_AT[0] + 16, 20, STATION_AT[1] + 34], target: [STATION_AT[0] + 2, 2, STATION_AT[1] + 3] },
  stadium: { position: [STADIUM_AT[0] + 34, 52, STADIUM_AT[1] + 62], target: [STADIUM_AT[0], 3, STADIUM_AT[1]] },
};
