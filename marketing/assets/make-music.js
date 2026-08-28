// Synthesizes a soft ambient bed for the Hielda demo video: a slow
// four-chord pad (Cmaj7 â†’ Am9 â†’ Fmaj7 â†’ G6) with a gentle plucked
// arpeggio on top. 44.1kHz stereo WAV, ~42s, fades in and out.
// Everything is generated from oscillators â€” no samples, no licence.

const fs = require('fs')

const SR = 44100
const DUR = 42
const N = SR * DUR

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12)

// Chords as MIDI notes (low root + spread voicing)
const CHORDS = [
  [48, 55, 60, 64, 71], // Cmaj7
  [45, 52, 57, 60, 71], // Am9
  [41, 48, 53, 57, 64], // Fmaj7
  [43, 50, 55, 59, 64], // G6
]
const BAR = 5.25 // seconds per chord â†’ 4 chords â‰ˆ 21s, looped twice

const L = new Float64Array(N)
const R = new Float64Array(N)

// â”€â”€ Pad: detuned triangle-ish sines with slow attack/release â”€â”€
for (let c = 0; c < 8; c++) {
  const chord = CHORDS[c % 4]
  const t0 = c * BAR
  const t1 = t0 + BAR + 0.8 // slight overlap for smooth crossfade
  for (const m of chord) {
    const f = midiHz(m)
    const detunes = [-1.7, 0, 1.7] // cents-ish detune via Hz offset scaled
    for (let d = 0; d < detunes.length; d++) {
      const fd = f * (1 + detunes[d] / 1200)
      const pan = d === 0 ? 0.35 : d === 2 ? 0.65 : 0.5
      const phase = Math.random() * Math.PI * 2
      const start = Math.max(0, Math.floor(t0 * SR))
      const end = Math.min(N, Math.floor(t1 * SR))
      for (let i = start; i < end; i++) {
        const t = i / SR - t0
        const rel = (t1 - t0) - t
        // slow attack (1.2s), slow release (0.8s)
        const env = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, rel / 0.8))
        // soften with a second harmonic at low level for warmth
        const s = Math.sin(2 * Math.PI * fd * (i / SR) + phase)
          + 0.06 * Math.sin(4 * Math.PI * fd * (i / SR) + phase)
        const v = s * env * 0.012
        L[i] += v * (1 - pan)
        R[i] += v * pan
      }
    }
  }
}

// â”€â”€ Pluck arpeggio: exponential-decay sine, one note per beat â”€â”€
const PLUCK_GAIN = 0        // plucks removed - pad only, way in the background
for (let c = 0; c < 8; c++) {
  const chord = CHORDS[c % 4]
  const t0 = c * BAR
  const beats = 7
  for (let b = 0; b < beats; b++) {
    // skip some beats for breathing room
    if (b % 7 === 3 || (c % 2 === 1 && b % 7 === 5)) continue
    const note = chord[(b * 2 + c) % chord.length] + 12 // up an octave
    const f = midiHz(note)
    const tN = t0 + b * (BAR / beats)
    const start = Math.floor(tN * SR)
    const len = Math.floor(1.4 * SR)
    const pan = 0.4 + 0.2 * Math.sin(b + c)
    for (let i = 0; i < len && start + i < N; i++) {
      const t = i / SR
      const env = Math.exp(-t * 3.2) * Math.min(1, t / 0.004)
      const s = Math.sin(2 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t)
      const v = s * env * PLUCK_GAIN
      L[start + i] += v * (1 - pan)
      R[start + i] += v * pan
    }
  }
}

// â”€â”€ Master: gentle fade in/out, soft clip, normalize â”€â”€
let peak = 0
for (let i = 0; i < N; i++) {
  const tIn = Math.min(1, (i / SR) / 2.5)
  const tOut = Math.min(1, (DUR - i / SR) / 3.5)
  const g = tIn * tOut
  L[i] = Math.tanh(L[i] * 1.4) * g
  R[i] = Math.tanh(R[i] * 1.4) * g
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const norm = 0.20 / peak // leave headroom â€” it's background music

// â”€â”€ WAV out (16-bit PCM stereo) â”€â”€
const data = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(L[i] * norm * 32767), i * 4)
  data.writeInt16LE(Math.round(R[i] * norm * 32767), i * 4 + 2)
}
const hdr = Buffer.alloc(44)
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8)
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20)
hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28)
hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34)
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40)
fs.writeFileSync(__dirname + '/music.wav', Buffer.concat([hdr, data]))
console.log('wrote music.wav', ((44 + data.length) / 1024 / 1024).toFixed(1) + 'MB')
