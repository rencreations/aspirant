/** Printing the lines at rest costs one draw. During a song their shape follows its spectrum. */
export class SoundField {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly bins = new Uint8Array(128);
  private phase = 0;
  private lastDraw = -1;
  private idle = false;
  bass = 0;
  treble = 0;

  constructor(private readonly canvas: HTMLCanvasElement | null) {
    this.ctx = canvas?.getContext("2d") ?? null;
  }

  update(w: number, h: number, dt: number, time: number, analyser: AnalyserNode | null): void {
    if (analyser) analyser.getByteFrequencyData(this.bins);
    else this.bins.fill(0);
    let low = 0;
    let high = 0;
    for (let i = 1; i <= 5; i++) low += this.bins[i] ?? 0;
    for (let i = 32; i < 112; i++) high += this.bins[i] ?? 0;
    const follow = 1 - Math.exp(-dt * 16);
    this.bass += (low / (5 * 255) - this.bass) * follow;
    this.treble += (high / (80 * 255) - this.treble) * follow;
    this.phase += dt * (this.bass * 2.8 + this.treble * 3);
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas || w <= 0 || h <= 0) return;
    const scale = Math.min(1, 1100 / w);
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    const resized = canvas.width !== width || canvas.height !== height;
    const quiet = !analyser && this.bass + this.treble < 0.003;
    if (!resized && ((quiet && this.idle) || time - this.lastDraw < 1 / 30)) return;
    this.lastDraw = time;
    this.idle = quiet;
    if (resized) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);
    const inks = ["#6f71aa", "#548f9d", "#9d769e"];
    for (let layer = 0; layer < 3; layer++) {
      ctx.strokeStyle = inks[layer]!;
      ctx.lineWidth = scale * 1.45;
      ctx.globalAlpha = 0.25 + this.bass * 0.19;
      for (let line = 0; line < 8; line++) {
        ctx.beginPath();
        for (let step = 0; step <= 64; step++) {
          const u = step / 64;
          const p = this.phase + layer * 1.9 + line * 0.075;
          const energy = (this.bins[2 + Math.floor(u * 100)] ?? 0) / 255;
          const wave =
            Math.sin(u * 7.2 + p) * (0.085 + this.bass * 0.09) +
            Math.cos(u * 11 - p * 0.62) * (0.025 + this.treble * 0.07) +
            energy * Math.sin(u * 18 + p) * 0.045;
          const y = height * (0.32 + layer * 0.14 + line * 0.009 + wave);
          if (step === 0) ctx.moveTo(0, y);
          else ctx.lineTo(u * width, y);
        }
        ctx.stroke();
      }
    }
  }
}
