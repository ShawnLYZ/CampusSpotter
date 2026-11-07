export type Vec3 = [number, number, number];

export type CameraPresetId = 'overview' | 'campus' | 'lrt' | 'stadium';

export interface CameraPose { position: Vec3; target: Vec3 }

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPose> = {
  overview: { position: [-40, 205, 150], target: [-40, 0, 28] },
  campus: { position: [25, 45, 55], target: [0, 0, 0] },
  lrt: { position: [-70, 30, 40], target: [-95, 0, 5] },
  stadium: { position: [-80, 35, 80], target: [-105, 0, 40] },
};
