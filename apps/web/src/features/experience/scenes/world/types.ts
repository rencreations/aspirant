/**
 * Preset shapes for the scene compositions. Presets are data: colours are sRGB hex, positions
 * are in world units (the camera sits about 10 units from the stage, eye level at y = 0).
 * A `Drive` value moves with the reader: "chapter" follows chapter progress, "part" follows
 * progress through the Part, "beat" follows the beat envelope.
 */
export type Drive = "chapter" | "part" | "time";

export interface SkyParams {
  top: string;
  mid: string;
  bottom: string;
  /** Glow band at the horizon. */
  band?: string;
  bandStrength?: number;
  sun?: {
    /** Offset from the horizon point, in screen heights. */
    x: number;
    y: number;
    size: number;
    color: string;
    glow?: number;
    /** Extra height gained over chapter progress. */
    rise?: number;
    /** 0 round sun, 1 a ring of lamps (the Dome's false sun). */
    ring?: number;
  };
  /** A second light (the real sun on Oro, a lamp, a star). */
  sun2?: { x: number; y: number; size: number; color: string; glow?: number; rise?: number };
  clouds?: {
    amount: number;
    color: string;
    light: string;
    speed?: number;
    /** 0 soft, 1 a storm (contrast, underlight, flashes). */
    storm?: number;
    /** Where the cloud layer sits above the horizon, in screen heights. */
    height?: number;
    /** Underlight colour for storms. */
    under?: string;
  };
  stars?: number;
  /** Random lightning strikes per second (0 none). Never above 0.5. */
  flash?: number;
  rift?: {
    x: number;
    y: number;
    size: number;
    rim: string;
    /** How open it is: a number, or "chapter" to open with progress. */
    open?: number | Drive;
  };
  vortex?: { amount: number; color: string; color2: string };
  aurora?: { amount: number; color: string };
  water?: { color: string; glitter?: number; waves?: number };
  /** A vertical beam of light from the ground into the clouds (x along the horizon). */
  pillar?: { x: number; color: string; width?: number };
  /** Whiteout, 0 to 1 (white silence). */
  white?: number;
  whiteColor?: string;
  /** Overall exposure multiplier. */
  exposure?: number;
}

export interface CityParams {
  /** Silhouette colour of the near towers. */
  color: string;
  /** Fog colour the far towers fade into (usually the band colour). */
  fog: string;
  windows?: string;
  /** Fraction of windows lit, 0 to 1, or a drive. */
  lit?: number | Drive;
  /** 0 intact, 1 broken tops and fires. */
  ruin?: number;
  fire?: string;
  /** Distance of the skyline, world units behind the stage. Default 40. */
  depth?: number;
  /** Ground level relative to the eye. Default -2.2. */
  ground?: number;
  /** Tower height scale. Default 1. */
  height?: number;
  /** One tall tower at the centre (the Academy tower, the bell tower). */
  tower?: { x: number; height: number; lamp?: string; window?: number };
  /** Gantry railing silhouette in the foreground. */
  gantry?: boolean;
  /** Ten thousand tiny lights instead of solid towers (the Virtual Battlefield). */
  points?: boolean;
}

export interface DomeParams {
  color: string;
  opacity?: number;
  /** Build progress 0 to 1, or a drive. */
  build?: number | Drive;
  /** Crack 0 to 1, or a drive. */
  crack?: number | Drive;
  radius?: number;
  /** Centre: x, y (ground), z. */
  center?: [number, number, number];
  /** Hex cell scale. */
  cells?: number;
  /** Fill inside the cells (glass). */
  fill?: number;
}

export type ParticleMode =
  | "motes"
  | "sparks"
  | "ash"
  | "rain"
  | "snow"
  | "lanterns"
  | "embers"
  | "leaves"
  | "eyes"
  | "dust"
  | "fireworks"
  | "blacksnow"
  | "stars"
  | "petals"
  | "darts";

export interface ParticleParams {
  mode: ParticleMode;
  color: string;
  color2?: string;
  count?: number;
  size?: number;
  speed?: number;
  /** Box the particles live in: x half width, y bottom, y top, z near, z far. */
  area?: [number, number, number, number, number];
  opacity?: number;
  /** Fraction of particles visible, or a drive (eyes opening). */
  amount?: number | Drive;
  /** Sideways slant for rain and streaks (x per unit of fall). */
  tilt?: number;
}

interface LightSpec {
  color: string;
  size: number;
  /** Position, or orbit around `center` when `orbit` is set. */
  pos?: [number, number, number];
  kind?: "orb" | "star" | "lamp" | "flare";
  intensity?: number;
  /** Pulse speed (Hz); 0 steady. */
  pulse?: number;
}

export interface LightsParams {
  lights: LightSpec[];
  /** Two-body orbit for the first two lights. */
  orbit?: {
    center: [number, number, number];
    /** Separation at the start and the end of the drive. */
    from: number;
    to: number;
    drive: Drive;
    speed?: number;
    /** Stars blink in sync when separation is small. */
    sync?: boolean;
  };
}

export interface LatticeParams {
  mode: "matrix" | "net" | "web" | "threads" | "ring";
  color: string;
  color2?: string;
  opacity?: number;
  /** Unroll or growth, 0 to 1, or a drive. */
  grow?: number | Drive;
  /** A dark flaw thread through the net. */
  flaw?: boolean;
  center?: [number, number, number];
  scale?: number;
}

export interface ShapeParams {
  kind:
    | "board"
    | "portal"
    | "corridor"
    | "hall"
    | "ribbons"
    | "ticks"
    | "terrain"
    | "citadel"
    | "orb"
    | "tree"
    | "ship"
    | "giant"
    | "memories";
  color: string;
  color2?: string;
  color3?: string;
  /** Free numeric knobs read by each shape (documented in the shape). */
  a?: number;
  b?: number;
  c?: number;
  drive?: Drive;
  pos?: [number, number, number];
  scale?: number;
}

export interface Preset {
  /** One line: what this scene carries. */
  intent: string;
  camera?: { y?: number; lookY?: number; z?: number; fov?: number; push?: number };
  /** Distance fog for silhouettes (towers, terrain, halls). */
  fog?: { color: string; near: number; far: number };
  sky: SkyParams;
  city?: CityParams;
  dome?: DomeParams;
  particles?: ParticleParams[];
  lights?: LightsParams;
  lattice?: LatticeParams[];
  shapes?: ShapeParams[];
}
