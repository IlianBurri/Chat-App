import { nextSpeaking, rmsLevel, type SpeakingState } from './callMath';

interface Entry {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Uint8Array<ArrayBuffer>;
  state: SpeakingState;
}

const POLL_MS = 120;

/** Measures the loudness of several audio streams and reports who starts or stops speaking. */
export class SpeakingMonitor {
  private ctx: AudioContext | null = null;
  private entries = new Map<string, Entry>();
  private timer: number | null = null;

  constructor(private onChange: (id: string, speaking: boolean) => void) {}

  watch(id: string, stream: MediaStream) {
    this.unwatch(id);
    if (stream.getAudioTracks().length === 0) return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume().catch(() => {});
    const source = this.ctx.createMediaStreamSource(stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    this.entries.set(id, { source, analyser, samples: new Uint8Array(analyser.fftSize), state: { speaking: false, lastLoudAt: 0 } });
    this.timer ??= window.setInterval(() => this.poll(), POLL_MS);
  }

  unwatch(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.source.disconnect();
    this.entries.delete(id);
    if (entry.state.speaking) this.onChange(id, false);
  }

  stop() {
    for (const id of [...this.entries.keys()]) this.unwatch(id);
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private poll() {
    const now = performance.now();
    for (const [id, entry] of this.entries) {
      entry.analyser.getByteTimeDomainData(entry.samples);
      const next = nextSpeaking(entry.state, rmsLevel(entry.samples), now);
      if (next.speaking !== entry.state.speaking) this.onChange(id, next.speaking);
      entry.state = next;
    }
  }
}
