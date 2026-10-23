/**
 * AFTERHOURS — offline synthesizer.
 *
 * Composes the four Sound Room tracks from scratch (oscillators, noise,
 * Karplus–Strong strings, FM bells, a Freeverb-style reverb) and encodes them
 * to MP3 with ffmpeg. Everything is original, so the audio is free to ship.
 *
 *   node scripts/generate-audio.mjs
 *
 * Output: public/audio/<mood>.mp3 and src/data/waveforms.json (peak data used
 * by the player's waveform scrubber).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SR = 44100
const TAU = Math.PI * 2

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Chamberlin state-variable filter. Read .low / .band / .high after process(). */
class SVF {
  constructor(fc, q = 0.7) {
    this.low = 0
    this.band = 0
    this.high = 0
    this.q = q
    this.set(fc)
  }
  set(fc) {
    this.f = 2 * Math.sin((Math.PI * Math.min(Math.max(fc, 20), SR / 6)) / SR)
  }
  process(x) {
    this.low += this.f * this.band
    this.high = x - this.low - this.q * this.band
    this.band += this.f * this.high
  }
}

/** A stereo bus set: each instrument writes to a named bus plus a reverb send. */
class Mixer {
  constructor(seconds, buses) {
    this.n = Math.ceil(seconds * SR)
    this.buses = {}
    for (const b of [...buses, 'verb', 'delay']) {
      this.buses[b] = [new Float32Array(this.n), new Float32Array(this.n)]
    }
  }
  put(bus, i, l, r, send = 0, delay = 0) {
    if (i < 0 || i >= this.n) return
    const b = this.buses[bus]
    b[0][i] += l
    b[1][i] += r
    if (send) {
      this.buses.verb[0][i] += l * send
      this.buses.verb[1][i] += r * send
    }
    if (delay) {
      this.buses.delay[0][i] += l * delay
      this.buses.delay[1][i] += r * delay
    }
  }
}

const panLR = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)]

// ─── Instruments ────────────────────────────────────────────────────────────

function kick(mx, rand, t, { amp = 0.9, bus = 'drums', decay = 7 } = {}) {
  const s = Math.floor(t * SR)
  const n = Math.floor(0.5 * SR)
  let ph = 0
  for (let k = 0; k < n; k++) {
    const tt = k / SR
    const f = 44 + 110 * Math.exp(-tt * 30)
    ph += (TAU * f) / SR
    const env = Math.exp(-tt * decay) * Math.min(1, tt / 0.0015)
    const click = k < 80 ? (1 - k / 80) * 0.25 * (rand() * 2 - 1) : 0
    const v = Math.tanh((Math.sin(ph) * env + click) * 1.4) * amp
    mx.put(bus, s + k, v, v)
  }
}

function hat(mx, rand, t, { amp = 0.12, decay = 0.035, pan = 0.25, send = 0.05, bus = 'drums' } = {}) {
  const s = Math.floor(t * SR)
  const n = Math.floor(decay * 7 * SR)
  const f = new SVF(8000, 0.6)
  const [gl, gr] = panLR(pan)
  for (let k = 0; k < n; k++) {
    f.process(rand() * 2 - 1)
    const v = f.high * Math.exp(-k / SR / decay) * amp
    mx.put(bus, s + k, v * gl, v * gr, send)
  }
}

function clap(mx, rand, t, { amp = 0.35, send = 0.35, bus = 'drums', fc = 1400 } = {}) {
  const s = Math.floor(t * SR)
  const n = Math.floor(0.6 * SR)
  const f = new SVF(fc, 0.9)
  for (let k = 0; k < n; k++) {
    const tt = k / SR
    let env = Math.exp(-tt / 0.12)
    for (const o of [0, 0.011, 0.022]) if (tt >= o && tt < o + 0.01) env += Math.exp(-(tt - o) / 0.003)
    f.process(rand() * 2 - 1)
    const v = f.band * env * amp
    mx.put(bus, s + k, v, v, send)
  }
}

function snare(mx, rand, t, { amp = 0.4, send = 0.45, bus = 'drums' } = {}) {
  const s = Math.floor(t * SR)
  const n = Math.floor(0.5 * SR)
  const f = new SVF(2500, 0.8)
  let ph = 0
  for (let k = 0; k < n; k++) {
    const tt = k / SR
    f.process(rand() * 2 - 1)
    ph += (TAU * (180 + 60 * Math.exp(-tt * 40))) / SR
    const v = (f.band * Math.exp(-tt / 0.13) * 0.9 + Math.sin(ph) * Math.exp(-tt / 0.05) * 0.5) * amp
    mx.put(bus, s + k, v, v, send)
  }
}

/** Detuned-saw voice through a resonant low-pass with ADSR. */
function synth(mx, rand, t, dur, midi, opts = {}) {
  const {
    amp = 0.1,
    voices = 3,
    detune = 0.12,
    attack = 0.01,
    release = 0.2,
    cutoff = 1200,
    cutoffEnv = 0,
    cutoffDecay = 0.2,
    q = 0.5,
    pan = 0,
    spread = 0.6,
    send = 0.2,
    delay = 0,
    bus = 'music',
    wave = 'saw',
  } = opts
  const s = Math.floor(t * SR)
  const n = Math.floor((dur + release) * SR)
  const base = mtof(midi)
  const osc = Array.from({ length: voices }, (_, v) => ({
    f: base * Math.pow(2, ((v - (voices - 1) / 2) * detune) / 12),
    ph: rand(),
    pan: voices > 1 ? pan + ((v / (voices - 1)) * 2 - 1) * spread : pan,
  }))
  const fl = new SVF(cutoff, q)
  const fr = new SVF(cutoff, q)
  for (let k = 0; k < n; k++) {
    const tt = k / SR
    let env = tt < attack ? tt / attack : 1
    if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / release)
    if (env <= 0 && tt > dur) break
    let l = 0
    let r = 0
    for (const o of osc) {
      o.ph += o.f / SR
      o.ph -= Math.floor(o.ph)
      const x = wave === 'saw' ? o.ph * 2 - 1 : wave === 'square' ? (o.ph < 0.5 ? 1 : -1) : Math.sin(o.ph * TAU)
      const [gl, gr] = panLR(Math.max(-1, Math.min(1, o.pan)))
      l += x * gl
      r += x * gr
    }
    if (k % 16 === 0) {
      const c = cutoff + cutoffEnv * Math.exp(-tt / cutoffDecay)
      fl.set(c)
      fr.set(c)
    }
    fl.process(l)
    fr.process(r)
    const g = (env * amp) / Math.sqrt(voices)
    mx.put(bus, s + k, fl.low * g, fr.low * g, send, delay)
  }
}

/** Karplus–Strong plucked string. */
function pluck(mx, rand, t, midi, { amp = 0.25, decay = 0.996, pan = 0, send = 0.3, delay = 0, bright = 0.5, bus = 'music', len = 2.5 } = {}) {
  const s = Math.floor(t * SR)
  const period = Math.max(2, Math.round(SR / mtof(midi)))
  const line = new Float32Array(period)
  for (let i = 0; i < period; i++) line[i] = rand() * 2 - 1
  let prev = 0
  const [gl, gr] = panLR(pan)
  const n = Math.floor(len * SR)
  for (let k = 0; k < n; k++) {
    const i = k % period
    const j = (k + 1) % period
    const y = (line[i] * bright + line[j] * (1 - bright)) * decay
    line[i] = y
    const v = (y * 0.7 + prev * 0.3) * amp * Math.min(1, k / 30)
    prev = y
    mx.put(bus, s + k, v * gl, v * gr, send, delay)
  }
}

/** Two-operator FM bell. */
function bell(mx, t, midi, { amp = 0.12, ratio = 3.5, index = 3, decay = 2.5, pan = 0, send = 0.6, bus = 'music' } = {}) {
  const s = Math.floor(t * SR)
  const f = mtof(midi)
  const n = Math.floor(decay * 3 * SR)
  const [gl, gr] = panLR(pan)
  let pc = 0
  let pm = 0
  for (let k = 0; k < n; k++) {
    const tt = k / SR
    pm += (TAU * f * ratio) / SR
    const idx = index * Math.exp(-tt / (decay * 0.3))
    pc += (TAU * f) / SR
    const env = Math.exp(-tt / decay) * Math.min(1, tt / 0.003)
    const v = Math.sin(pc + idx * Math.sin(pm)) * env * amp
    mx.put(bus, s + k, v * gl, v * gr, send)
  }
}

/** Filtered noise with arbitrary cutoff/amp curves — wind, surf, risers. */
function noiseBed(mx, rand, t0, dur, { amp = 0.2, cutoff = () => 800, gain = () => 1, q = 0.8, send = 0.3, bus = 'music', width = 0.8 } = {}) {
  const s = Math.floor(t0 * SR)
  const n = Math.floor(dur * SR)
  const fl = new SVF(800, q)
  const fr = new SVF(800, q)
  let c = 800
  let g = 1
  for (let k = 0; k < n; k++) {
    if (k % 32 === 0) {
      const tt = k / SR
      c = cutoff(tt)
      g = gain(tt)
      fl.set(c)
      fr.set(c)
    }
    const a = rand() * 2 - 1
    const b = rand() * 2 - 1
    fl.process(a)
    fr.process(a * (1 - width) + b * width)
    mx.put(bus, s + k, fl.low * g * amp, fr.low * g * amp, send)
  }
}

// ─── Effects & mastering ────────────────────────────────────────────────────

function reverb([inL, inR], { room = 0.86, damp = 0.25, wet = 1 } = {}) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]
  const alls = [225, 556, 441, 341]
  const make = (spread) => ({
    combs: combs.map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 })),
    alls: alls.map((d) => ({ buf: new Float32Array(d + spread), i: 0 })),
  })
  const run = (input, st) => {
    const out = new Float32Array(input.length)
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015
      let acc = 0
      for (const c of st.combs) {
        const y = c.buf[c.i]
        c.store = y * (1 - damp) + c.store * damp
        c.buf[c.i] = x + c.store * room
        c.i = (c.i + 1) % c.buf.length
        acc += y
      }
      for (const a of st.alls) {
        const b = a.buf[a.i]
        a.buf[a.i] = acc + b * 0.5
        a.i = (a.i + 1) % a.buf.length
        acc = b - acc
      }
      out[n] = acc * wet
    }
    return out
  }
  return [run(inL, make(0)), run(inR, make(23))]
}

function pingPong([inL, inR], time, feedback = 0.45) {
  const d = Math.floor(time * SR)
  const L = new Float32Array(inL.length)
  const R = new Float32Array(inR.length)
  for (let n = 0; n < inL.length; n++) {
    const fromR = n >= d ? R[n - d] : 0
    const fromL = n >= d ? L[n - d] : 0
    L[n] = (inL[n] + inR[n]) * 0.5 + fromR * feedback
    R[n] = fromL * feedback
  }
  return [L, R]
}

function master(mx, { duck = null, verb = {}, delayTime = 0, fadeIn = 1.5, fadeOut = 4 } = {}) {
  const { n, buses } = mx
  if (duck) {
    // sidechain the music bus against kick times
    const g = new Float32Array(n).fill(1)
    for (const kt of duck.times) {
      const s = Math.floor(kt * SR)
      const len = Math.floor(0.35 * SR)
      for (let k = 0; k < len && s + k < n; k++) {
        const v = 1 - duck.depth * Math.exp(-(k / SR) * 9)
        g[s + k] = Math.min(g[s + k], v)
      }
    }
    for (const ch of buses.music) for (let i = 0; i < n; i++) ch[i] *= g[i]
  }
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  for (const [name, [bl, br]] of Object.entries(buses)) {
    if (name === 'verb' || name === 'delay') continue
    for (let i = 0; i < n; i++) {
      L[i] += bl[i]
      R[i] += br[i]
    }
  }
  if (delayTime) {
    const [dl, dr] = pingPong(buses.delay, delayTime)
    for (let i = 0; i < n; i++) {
      L[i] += dl[i] * 0.5
      R[i] += dr[i] * 0.5
      buses.verb[0][i] += dl[i] * 0.2
      buses.verb[1][i] += dr[i] * 0.2
    }
  }
  const [vl, vr] = reverb(buses.verb, verb)
  let peak = 0
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh((L[i] + vl[i]) * 1.1)
    R[i] = Math.tanh((R[i] + vr[i]) * 1.1)
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  }
  const norm = 0.89 / (peak || 1)
  const fi = fadeIn * SR
  const fo = fadeOut * SR
  for (let i = 0; i < n; i++) {
    let g = norm
    if (i < fi) g *= i / fi
    if (i > n - fo) g *= Math.max(0, (n - i) / fo)
    L[i] *= g
    R[i] *= g
  }
  return [L, R]
}

// ─── Compositions ───────────────────────────────────────────────────────────

/** 01 — MIDNIGHT DRIVE: 96 BPM, A minor, i–VI–III–VII, arpeggiated bass, gated drums. */
function midnightDrive() {
  const rand = seeded(11)
  const bpm = 96
  const beat = 60 / bpm
  const bar = beat * 4
  const bars = 32
  const mx = new Mixer(bars * bar + 4, ['drums', 'music'])
  const chords = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62], // G
  ]
  const roots = [45, 41, 48, 43]
  const lead = [76, 74, 72, 71, 72, 74, 76, 79, 77, 76, 74, 72, 71, 72, 71, 67]
  const kicks = []
  for (let b = 0; b < bars; b++) {
    const t = b * bar
    const c = b % 4
    const full = b >= 8 && !(b >= 24 && b < 28)
    // pad
    for (const m of chords[c]) synth(mx, rand, t, bar, m, { amp: 0.11, voices: 4, detune: 0.18, attack: 0.6, release: 1.2, cutoff: 900 + (b >= 8 ? 600 : 0), send: 0.5, spread: 0.8 })
    // arpeggiated bass, 16ths
    if (b >= 4) {
      for (let s = 0; s < 16; s++) {
        const m = roots[c] - 12 + (s % 2 ? 12 : 0)
        synth(mx, rand, t + s * (beat / 4), beat / 4 - 0.02, m, { amp: 0.22, voices: 2, detune: 0.06, release: 0.04, cutoff: 260, cutoffEnv: 1400, cutoffDecay: 0.06, q: 0.35, send: 0.02, spread: 0.1 })
      }
    }
    if (full) {
      for (let q = 0; q < 4; q++) {
        if (q === 0 || q === 2) {
          kick(mx, rand, t + q * beat, { amp: 0.85 })
          kicks.push(t + q * beat)
        }
        if (q === 1 || q === 3) snare(mx, rand, t + q * beat, { amp: 0.38, send: 0.7 })
        hat(mx, rand, t + q * beat + beat / 2, { amp: 0.09, decay: 0.05, pan: 0.3 })
      }
    }
    // lead: a wandering pluck line through a dotted delay
    if (b >= 12 && b < 24) {
      for (let s = 0; s < 4; s++) {
        const m = lead[((b - 12) * 4 + s) % lead.length]
        pluck(mx, rand, t + s * beat + (s % 2) * beat * 0.5, m, { amp: 0.16, decay: 0.997, pan: -0.2, send: 0.35, delay: 0.6, bright: 0.45 })
      }
    }
    if (b >= 28) {
      for (let s = 0; s < 8; s++) {
        pluck(mx, rand, t + s * (beat / 2), chords[c][s % 3] + 12, { amp: 0.09, pan: s % 2 ? 0.5 : -0.5, send: 0.4, delay: 0.4, bright: 0.5 })
      }
    }
  }
  return master(mx, { duck: { times: kicks, depth: 0.45 }, delayTime: beat * 0.75, verb: { room: 0.88, damp: 0.3 }, fadeOut: 5 })
}

/** 02 — DEEP FOCUS: slow maj7/min9 pads, sparse bells, brown-noise floor. No drums. */
function deepFocus() {
  const rand = seeded(23)
  const bar = (60 / 66) * 4
  const bars = 22
  const mx = new Mixer(bars * bar + 6, ['music'])
  const chords = [
    [50, 54, 57, 61, 64], // Dmaj9
    [47, 50, 54, 57, 61], // Bm9
    [43, 47, 50, 54, 57], // Gmaj7(9)
    [40, 43, 47, 50, 54], // Em9
  ]
  const scale = [74, 76, 78, 81, 83, 86, 88]
  for (let b = 0; b < bars; b += 2) {
    const t = b * bar
    const c = (b / 2) % 4
    for (const m of chords[c]) synth(mx, rand, t, bar * 2 - 0.2, m, { amp: 0.09, voices: 3, detune: 0.09, attack: 2.2, release: 2.8, cutoff: 700, q: 0.6, send: 0.7, spread: 0.9, wave: rand() < 0.5 ? 'saw' : 'sine' })
    synth(mx, rand, t, bar * 2, chords[c][0] - 12, { amp: 0.16, voices: 1, attack: 1.5, release: 2, cutoff: 300, send: 0.1, wave: 'sine' })
  }
  // sparse melodic bells — random walk over a pentatonic-ish set
  let idx = 3
  for (let t = bar * 1.5; t < bars * bar - 4; t += bar * (0.5 + rand() * 1.1)) {
    idx = Math.max(0, Math.min(scale.length - 1, idx + Math.round(rand() * 4 - 2)))
    bell(mx, t, scale[idx], { amp: 0.05, ratio: 2, index: 1.6, decay: 2.2, pan: rand() * 1.2 - 0.6, send: 0.8 })
    if (rand() < 0.35) pluck(mx, rand, t + 0.18, scale[idx] - 12, { amp: 0.08, decay: 0.998, pan: rand() - 0.5, send: 0.6, bright: 0.3 })
  }
  // warm noise floor
  noiseBed(mx, rand, 0, bars * bar + 4, { amp: 0.06, cutoff: (tt) => 380 + 120 * Math.sin(tt * 0.21), send: 0.1 })
  return master(mx, { verb: { room: 0.92, damp: 0.4 }, fadeIn: 3, fadeOut: 6 })
}

/** 03 — OCEAN AT NIGHT: irregular swells of surf, a low drone, far-away chimes. */
function oceanAtNight() {
  const rand = seeded(37)
  const dur = 84
  const mx = new Mixer(dur, ['music', 'sea'])
  // waves — each swell has its own length and strength
  const swells = []
  for (let t = 0; t < dur; ) {
    const len = 6 + rand() * 4.5
    swells.push({ t, len, strength: 0.6 + rand() * 0.5 })
    t += len * (0.62 + rand() * 0.2)
  }
  for (const s of swells) {
    noiseBed(mx, rand, s.t, s.len + 1.5, {
      bus: 'sea',
      amp: 0.5 * s.strength,
      q: 1.1,
      width: 0.9,
      send: 0.25,
      gain: (tt) => {
        const x = tt / s.len
        if (x > 1) return Math.max(0, (1 - (tt - s.len) / 1.5) * 0.05)
        return Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.2)), 2) * (x < 0.83 ? 1 : Math.max(0.05, 1 - (x - 0.83) * 5))
      },
      cutoff: (tt) => 260 + 2600 * Math.pow(Math.sin(Math.PI * Math.min(1, tt / s.len)), 3),
    })
  }
  // drone: E + B, very slow filter breathing
  for (const [m, a] of [[28, 0.2], [40, 0.12], [47, 0.08], [52, 0.05]]) {
    synth(mx, rand, 0, dur - 3, m, { amp: a, voices: 3, detune: 0.07, attack: 6, release: 3, cutoff: 260, q: 0.7, send: 0.5, spread: 0.7 })
  }
  // chimes in E minor pentatonic, drifting across the stereo field
  const chimes = [76, 79, 81, 83, 86, 88, 91]
  for (let t = 4; t < dur - 6; t += 1.6 + rand() * 3.8) {
    bell(mx, t, chimes[Math.floor(rand() * chimes.length)], { amp: 0.045, ratio: 3.5, index: 2.5, decay: 3, pan: rand() * 1.6 - 0.8, send: 0.9 })
  }
  return master(mx, { verb: { room: 0.93, damp: 0.5 }, fadeIn: 3, fadeOut: 6 })
}

/** 04 — NO SLEEP CLUB: 124 BPM, F minor, four-on-the-floor, rolling bass, filtered stabs. */
function noSleepClub() {
  const rand = seeded(53)
  const bpm = 124
  const beat = 60 / bpm
  const bar = beat * 4
  const bars = 40
  const mx = new Mixer(bars * bar + 3, ['drums', 'music'])
  const stabs = [
    [53, 56, 60, 63], // Fm7
    [49, 53, 56, 60], // Dbmaj7
    [51, 55, 58, 62], // Eb(add9)
    [48, 51, 55, 58], // Cm7
  ]
  const bassRoots = [29, 25, 27, 24]
  const kicks = []
  for (let b = 0; b < bars; b++) {
    const t = b * bar
    const c = Math.floor(b / 2) % 4
    const breakdown = b >= 28 && b < 32
    for (let q = 0; q < 4; q++) {
      const tq = t + q * beat
      if (!breakdown) {
        kick(mx, rand, tq, { amp: 0.95, decay: 8 })
        kicks.push(tq)
      }
      if (b >= 2) hat(mx, rand, tq + beat / 2, { amp: 0.11, decay: 0.09, pan: 0.15, send: 0.08 })
      if (b >= 4 && !breakdown) for (let s = 0; s < 4; s++) hat(mx, rand, tq + (s * beat) / 4, { amp: s === 2 ? 0.03 : 0.05 + rand() * 0.03, decay: 0.018, pan: -0.35 })
      if (b >= 8 && (q === 1 || q === 3)) clap(mx, rand, tq, { amp: breakdown ? 0.22 : 0.36 })
    }
    // rolling offbeat bass
    if (b >= 4 && !breakdown) {
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 0) continue
        const m = bassRoots[c] + (s % 4 === 3 && rand() < 0.4 ? 12 : 0)
        synth(mx, rand, t + s * (beat / 4), beat / 4 - 0.015, m + 12, { amp: 0.25, voices: 2, detune: 0.05, release: 0.03, cutoff: 180, cutoffEnv: 900 + (b % 8) * 120, cutoffDecay: 0.05, q: 0.3, send: 0.02, spread: 0.05 })
      }
    }
    // chord stabs: syncopated, filter opening across the track
    if (b >= 12) {
      const open = breakdown ? 600 + ((b - 28) / 4) * 3000 : 900 + 1500 * Math.sin(((b - 12) / 16) * Math.PI) ** 2
      for (const off of [0.75, 1.75, 2.5, 3.5]) {
        for (const m of stabs[c]) synth(mx, rand, t + off * beat, beat * 0.3, m, { amp: 0.07, voices: 2, detune: 0.14, release: 0.12, cutoff: open, cutoffEnv: 1200, cutoffDecay: 0.08, q: 0.4, send: 0.35, delay: 0.25, spread: 0.7 })
      }
    }
    // riser into the drop
    if (b === 30) {
      noiseBed(mx, rand, t, bar * 2, { amp: 0.25, cutoff: (tt) => 400 + Math.pow(tt / (bar * 2), 2) * 9000, gain: (tt) => tt / (bar * 2), send: 0.5 })
    }
  }
  return master(mx, { duck: { times: kicks, depth: 0.6 }, delayTime: beat * 0.75, verb: { room: 0.8, damp: 0.35 }, fadeIn: 0.3, fadeOut: 4 })
}

// ─── Encode ─────────────────────────────────────────────────────────────────

function writeWav(path, [L, R]) {
  const n = L.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4)
  }
  writeFileSync(path, buf)
}

function peaks([L, R], bins = 120) {
  const step = Math.floor(L.length / bins)
  const out = []
  for (let b = 0; b < bins; b++) {
    let sum = 0
    for (let i = b * step; i < (b + 1) * step; i++) sum += (L[i] * L[i] + R[i] * R[i]) / 2
    out.push(Math.sqrt(sum / step))
  }
  const max = Math.max(...out)
  return out.map((v) => Math.round((v / max) * 100) / 100)
}

const tracks = {
  'midnight-drive': midnightDrive,
  'deep-focus': deepFocus,
  'ocean-at-night': oceanAtNight,
  'no-sleep-club': noSleepClub,
}

const outDir = join(ROOT, 'public', 'audio')
const tmp = join(tmpdir(), `afterhours-${process.pid}`)
mkdirSync(outDir, { recursive: true })
mkdirSync(tmp, { recursive: true })
mkdirSync(join(ROOT, 'src', 'data'), { recursive: true })

const waveforms = {}
for (const [id, compose] of Object.entries(tracks)) {
  const t0 = Date.now()
  const audio = compose()
  const wav = join(tmp, `${id}.wav`)
  writeWav(wav, audio)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', '-metadata', `title=${id}`, '-metadata', 'artist=AFTERHOURS', join(outDir, `${id}.mp3`)])
  waveforms[id] = peaks(audio)
  console.log(`✓ ${id}  ${(audio[0].length / SR).toFixed(1)}s  (${Date.now() - t0}ms)`)
}
writeFileSync(join(ROOT, 'src', 'data', 'waveforms.json'), JSON.stringify(waveforms))
rmSync(tmp, { recursive: true, force: true })
