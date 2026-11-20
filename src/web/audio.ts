/**
 * Âm thanh tổng hợp bằng Web Audio (không dùng file âm thanh nào): nhạc nền đêm và hiệu ứng cho
 * nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối.
 * Chỉ chạy trong trình duyệt (AudioContext chỉ mở được sau một thao tác của người chơi).
 */
export type Sfx =
  | "pickup" | "light" | "pulse" | "hit" | "jump" | "dash" | "win" | "lose" | "spawn" | "tick" | "charm" | "steal" | "deposit";

export class AudioBank {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private volume = 0.7;

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  /** Gọi sau thao tác đầu tiên của người chơi (phím/chuột). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.25, when = 0, slideTo?: number, dest?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, gain = 0.2, lp = 2000): void {
    if (!this.ctx || !this.master) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lp;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  play(name: Sfx): void {
    if (!this.ctx) return;
    switch (name) {
      case "pickup": this.tone(880, 0.09, "sine", 0.2); this.tone(1320, 0.12, "sine", 0.18, 0.06); break;
      case "deposit": this.tone(520, 0.1, "triangle", 0.2); this.tone(660, 0.12, "triangle", 0.2, 0.07); break;
      case "light": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.22, i * 0.08)); break;
      case "pulse": this.tone(300, 0.5, "sawtooth", 0.16, 0, 1200); this.noise(0.25, 0.08, 5000); break;
      case "hit": this.noise(0.3, 0.3, 700); this.tone(140, 0.3, "square", 0.2, 0, 60); break;
      case "jump": this.tone(330, 0.16, "square", 0.1, 0, 620); break;
      case "dash": this.noise(0.2, 0.18, 4000); break;
      case "win": [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.45, "triangle", 0.24, i * 0.13)); break;
      case "lose": [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.55, "sawtooth", 0.14, i * 0.2)); break;
      case "spawn": this.tone(90, 0.6, "sawtooth", 0.14, 0, 55); break;
      case "tick": this.tone(1000, 0.06, "square", 0.12); break;
      case "charm": this.tone(660, 0.12, "sine", 0.2); this.tone(990, 0.14, "sine", 0.2, 0.08); this.tone(1480, 0.2, "sine", 0.18, 0.16); break;
      case "steal": this.tone(900, 0.3, "sawtooth", 0.14, 0, 200); break;
    }
  }

  /** Nhạc nền đêm: nền trầm kéo dài + vài nốt chuông thưa trên thang ngũ âm. */
  startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicTimer !== null) return;
    const bass = [110, 98, 82.4, 98];
    const bell = [523, 587, 659, 784, 880];
    let bar = 0;
    const playBar = () => {
      this.tone(bass[bar % bass.length], 4.6, "sine", 0.35, 0, undefined, this.musicGain!);
      this.tone(bass[bar % bass.length] * 1.5, 4.6, "sine", 0.12, 0, undefined, this.musicGain!);
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.7) this.tone(bell[Math.floor(Math.random() * bell.length)], 1.4, "triangle", 0.1, 0.4 + i * 1.3, undefined, this.musicGain!);
      }
      bar++;
    };
    playBar();
    this.musicTimer = window.setInterval(playBar, 4500);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
