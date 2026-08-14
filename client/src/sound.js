// Sonidos sintetizados con Web Audio (sin archivos). Se pueden silenciar.
let audioCtx = null;
let muted = false;
try { muted = localStorage.getItem('basta_muted') === '1'; } catch { /* noop */ }

function ac() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, startAt, dur, type = 'sine', gain = 0.18) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + startAt;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(a.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.03);
}

export function isMuted() { return muted; }
export function setMuted(m) { muted = m; try { localStorage.setItem('basta_muted', m ? '1' : '0'); } catch { /* noop */ } }
export function toggleMuted() { setMuted(!muted); return muted; }

export const sfx = {
  tick() { if (muted) return; tone(880, 0, 0.07, 'square', 0.10); },
  go() { if (muted) return; tone(660, 0, 0.12, 'square', 0.15); tone(990, 0.1, 0.18, 'square', 0.15); },
  correct() { if (muted) return; tone(660, 0, 0.1, 'sine', 0.2); tone(990, 0.09, 0.16, 'sine', 0.2); },
  wrong() { if (muted) return; tone(180, 0, 0.28, 'sawtooth', 0.18); },
  pop() { if (muted) return; tone(520, 0, 0.09, 'triangle', 0.16); },
  fanfare() { if (muted) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.32, 'square', 0.16)); },
};
