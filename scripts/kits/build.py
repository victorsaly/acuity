#!/usr/bin/env python3
"""
Build the drum kits for Downbeat.

    python3 scripts/kits/build.py            # all kits
    python3 scripts/kits/build.py --kit club # one kit

Every voice is rendered offline from licence-clean material:

  * CC0 recordings in scripts/kits/src/  (TR-808 by Edward Loveall, CC0;
    "vintage" SP-1200-style crunch kit by Boochi44, CC0 — licences alongside)
  * original synthesis in this file (sweep kicks, modal snares, metallic hats,
    claps, congas, 808 subs …)

Layers are mixed, EQ'd, saturated, transient-shaped, trimmed sample-tight and
peak-normalised to -1 dBFS, then written as 16-bit mono WAV with 2–3 round-robin
variants per voice so repeated hits never sound machine-gunned.  A manifest
(public/samples/manifest.json) tells the engine which files exist plus the mix
gain, reverb send and duck amount for each voice.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
OUT = HERE.parents[1] / "public" / "samples"
rng = np.random.default_rng(808)

# ───────────────────────── basics ─────────────────────────

def db(g): return 10 ** (g / 20)
def sec(s): return int(round(s * SR))
def tl(n): return np.arange(n) / SR
def noise(n): return rng.uniform(-1, 1, n)
def sine(f, n, phase=0.0): return np.sin(2 * math.pi * f * tl(n) + phase)

def expdec(n, tau, hold=0.0):
    """Exponential decay envelope after an optional hold."""
    tt = tl(n)
    return np.where(tt < hold, 1.0, np.exp(-(tt - hold) / tau))

def sweep(f0, f1, tau, n):
    """Sine whose frequency falls exponentially from f1 to f0 (pitch envelope)."""
    f = f0 + (f1 - f0) * np.exp(-tl(n) / tau)
    return np.sin(2 * math.pi * np.cumsum(f) / SR)

def sat(x, drive):
    return np.tanh(x * drive) / math.tanh(drive)

def biquad(x, kind, f, q=0.707, gain=0.0):
    """RBJ cookbook biquad."""
    A = db(gain / 2)
    w = 2 * math.pi * f / SR
    cw, sw = math.cos(w), math.sin(w)
    alpha = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]; a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "hshelf":
        s = math.sqrt(A) * 2 * alpha
        b = [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s)]
        a = [(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    elif kind == "lshelf":
        s = math.sqrt(A) * 2 * alpha
        b = [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s)]
        a = [(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s]
    else:
        raise ValueError(kind)
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x)

def hp(x, f, q=0.707): return biquad(x, "hp", f, q)
def lp(x, f, q=0.707): return biquad(x, "lp", f, q)
def bp(x, f, q=1.0): return biquad(x, "bp", f, q)
def peak(x, f, q, g): return biquad(x, "peak", f, q, g)
def hshelf(x, f, g): return biquad(x, "hshelf", f, 0.7, g)
def lshelf(x, f, g): return biquad(x, "lshelf", f, 0.7, g)

def load(name):
    rate, data = wavfile.read(SRC / f"{name}.wav")
    if data.dtype == np.int16: x = data / 32768.0
    elif data.dtype == np.int32: x = data / 2147483648.0
    elif data.dtype == np.uint8: x = (data.astype(np.float64) - 128) / 128.0
    else: x = data.astype(np.float64)
    if x.ndim > 1: x = x.mean(axis=1)
    if rate != SR: x = signal.resample_poly(x, SR, rate)
    return trim(x)

def trim(x, thresh=-48, pre=0.0008):
    a = np.abs(x)
    if a.max() == 0: return x
    idx = int(np.argmax(a > a.max() * db(thresh)))
    return x[max(0, idx - sec(pre)):]

def cut(x, seconds, fade=0.02):
    n = min(len(x), sec(seconds))
    y = x[:n].copy()
    m = min(n, sec(fade))
    if m > 0: y[-m:] *= np.linspace(1, 0, m)
    return y

def pitch(x, semis):
    """Resample to shift pitch (and length) by semitones."""
    r = 2 ** (semis / 12)
    n = int(len(x) / r)
    return np.interp(np.arange(n) * r, np.arange(len(x)), x)

def crush(x, bits=12, down=1):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    if down > 1:
        y = np.repeat(y[::down], down)[:len(x)]
    return y

def transient(x, amt, ms=7):
    n = min(len(x), sec(ms / 1000))
    y = x.copy()
    y[:n] *= 1 + amt * np.linspace(1, 0, n) ** 2
    return y

def mix(*layers):
    n = max(len(x) for x, _ in layers)
    out = np.zeros(n)
    for x, g in layers:
        out[:len(x)] += x * g
    return out

def finish(x, hpf=25, tail=-64, fade=0.006):
    """Tidy: rumble filter, click-free ends, tail cut, -1 dBFS peak."""
    x = hp(x, hpf)
    x = trim(x, -60, 0.0005)
    a = np.abs(x)
    pk = a.max()
    if pk == 0: return x
    env = np.maximum.accumulate(a[::-1])[::-1]          # future-peak envelope
    last = int(np.argmax(env < pk * db(tail))) or len(x)
    x = x[:last + sec(0.004)]
    m = min(len(x), sec(fade))
    x[:min(len(x), sec(0.0005))] *= np.linspace(0, 1, min(len(x), sec(0.0005)))
    x[-m:] *= np.linspace(1, 0, m) ** 0.7
    return x / np.abs(x).max() * db(-1.0)

# ───────────────────────── synthesis ─────────────────────────

def click(dur=0.005, hpf=3000):
    n = sec(dur)
    return hp(noise(n) * expdec(n, dur / 3), hpf)

def sweep_kick(f0=50, f1=180, ptau=0.04, dur=0.4, atau=0.14, drive=1.4):
    n = sec(dur)
    return sat(sweep(f0, f1, ptau, n) * expdec(n, atau), drive)

def sub808(f=43.65, dur=0.9, tau=0.32, drive=1.7):
    n = sec(dur)
    x = sweep(f, f * 2.3, 0.012, n) * expdec(n, tau, hold=0.03)
    return sat(x, drive)

def noise_snare(body=190, dur=0.26, tone_tau=0.06, noise_tau=0.1, bpf=1800, q=0.7):
    n = sec(dur)
    tone = sweep(body, body * 1.6, 0.02, n) * expdec(n, tone_tau)
    nz = bp(noise(n), bpf, q) * expdec(n, noise_tau)
    ck = np.zeros(n)
    c = click(0.004, 2000)
    ck[:len(c)] = c
    return 0.55 * tone + 0.9 * nz + 0.3 * ck

def metal_hat(dur=0.09, tau=0.022, hpf=7000, base=320, bright=4):
    n = sec(dur)
    x = np.zeros(n)
    for r in (1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523):
        x += signal.square(2 * math.pi * base * r * tl(n))
    x = x / 6 * expdec(n, tau)
    x = hp(x, hpf, 0.9)
    return peak(x, 10000, 1.0, bright)

def clap(dur=0.35, spread=0.011, bursts=4, tau=0.09, tone=1200):
    n = sec(dur)
    out = np.zeros(n)
    m = sec(0.012)
    for i in range(bursts):
        s = sec(i * spread)
        out[s:s + m] += noise(m) * expdec(m, 0.004)
    tail = noise(n) * expdec(n, tau)
    tail[:sec(bursts * spread)] = 0
    x = bp(out + 0.7 * tail, tone, 0.6)
    return peak(x, 2600, 1.2, 4)

def rimshot(dur=0.11):
    n = sec(dur)
    ping = sine(820, n) * expdec(n, 0.02) + 0.5 * sine(1650, n) * expdec(n, 0.012)
    body = bp(noise(n), 2400, 1.5) * expdec(n, 0.015)
    return 0.6 * ping + 0.8 * body

def shaker(dur=0.13, tau=0.035, hpf=5500):
    n = sec(dur)
    tt = tl(n)
    env = np.minimum(1, tt / 0.012) * np.exp(-np.maximum(0, tt - 0.012) / tau)
    return hp(noise(n) * env, hpf, 0.8)

def conga(f=205, dur=0.42):
    n = sec(dur)
    x = sweep(f, f * 1.35, 0.015, n) * expdec(n, 0.12)
    x += 0.35 * sine(f * 1.9, n) * expdec(n, 0.05)
    x += 0.2 * sine(f * 2.8, n) * expdec(n, 0.03)
    slap = bp(noise(n), 2200, 1.2) * expdec(n, 0.006)
    return x + 0.5 * slap

def cowbell(f=560, dur=0.22):
    n = sec(dur)
    x = signal.square(2 * math.pi * f * tl(n)) + signal.square(2 * math.pi * f * 1.48 * tl(n))
    x = x * 0.5 * expdec(n, 0.06)
    return bp(x, f * 1.2, 1.1) + 0.4 * bp(x, f * 3.6, 2.0)

def tom(f=120, dur=0.45):
    n = sec(dur)
    x = sweep(f, f * 1.8, 0.03, n) * expdec(n, 0.13)
    return x + 0.4 * bp(noise(n), 1500, 1.0) * expdec(n, 0.01)

def acoustic_kick(dur=0.5):
    n = sec(dur)
    head = sweep(56, 190, 0.025, n) * expdec(n, 0.2)
    shell = sine(92, n) * expdec(n, 0.06) * 0.4
    beater = lp(noise(n), 3200) * expdec(n, 0.006) * 0.8
    return head + shell + beater

def acoustic_snare(dur=0.32):
    n = sec(dur)
    body = sweep(183, 260, 0.01, n) * expdec(n, 0.07) + 0.6 * sine(331, n) * expdec(n, 0.05)
    wires = hp(noise(n), 2500) * expdec(n, 0.16)
    wires = peak(wires, 5000, 0.8, 5)
    hit = bp(noise(n), 900, 0.5) * expdec(n, 0.01)
    return 0.7 * body + 0.9 * wires + 0.7 * hit

def ride_bell(dur=0.7):
    n = sec(dur)
    x = np.zeros(n)
    for i, r in enumerate((1, 1.483, 2.087, 2.712, 3.35, 4.12)):
        x += sine(880 * r, n) * expdec(n, 0.45 / (1 + i * 0.6)) / (1 + i * 0.5)
    x += 0.4 * hp(noise(n), 6000) * expdec(n, 0.02)
    return bp(x, 3000, 0.4) + 0.5 * x

def pluck_bass(f=43.65, dur=0.8):
    n = sec(dur)
    x = sine(f, n) + 0.35 * signal.sawtooth(2 * math.pi * f * tl(n))
    x = lp(x * expdec(n, 0.28), 900)
    x += 0.3 * bp(noise(n), 1200, 0.8) * expdec(n, 0.004)
    return sat(x, 1.3)

def snap(dur=0.09):
    n = sec(dur)
    return bp(noise(n), 1800, 0.7) * expdec(n, 0.02) + 0.5 * bp(noise(n), 4000, 1.0) * expdec(n, 0.006)

# ───────────────────────── round-robin variation ─────────────────────────

def vary(x, i):
    """Variant i: tiny pitch / decay / tilt differences so repeats breathe."""
    semis = (0, 0.3, -0.3)[i % 3]
    x = pitch(x, semis) if semis else x
    if i % 3 == 1: x = hshelf(x, 6000, 0.8)
    if i % 3 == 2: x = x * expdec(len(x), 0.6)          # slightly shorter
    return x

# ───────────────────────── kits ─────────────────────────
# Each voice: (renderer(i) -> array, variants, gain, send, duck)

def punch():
    kicks = ["tr808/BD0025", "tr808/BD1025", "tr808/BD5025"]
    snares = ["tr808/SD0010", "tr808/SD1010", "tr808/SD2510"]
    return {
        "kick": (lambda i: peak(sat(mix((cut(load(kicks[i]), 0.35), 0.9), (sweep_kick(50, 180, 0.04, 0.38, 0.14), 0.8), (click(0.005, 3000), 0.35)), 1.7), 60, 1.0, 2), 3, 1.0, 0.04, 0),
        "snare": (lambda i: peak(peak(sat(hp(mix((load(snares[i]), 0.8), (noise_snare(200, 0.26), 0.7)), 140), 1.5), 200, 1.2, 2), 5000, 0.9, 3), 3, 0.85, 0.22, 0),
        "clap": (lambda i: hp(mix((cut(load("tr808/CP"), 0.4), 0.7), (clap(), 0.8)), 300), 2, 0.7, 0.3, 0),
        "hat": (lambda i: hp(mix((load("tr808/CH"), 0.6), (metal_hat(0.08, 0.02, 7500), 0.8)), 6500), 3, 0.5, 0.08, 0.5),
        "open": (lambda i: hp(mix((load(["tr808/OH25", "tr808/OH50"][i]), 0.7), (metal_hat(0.35, 0.12, 6000), 0.6)), 5500), 2, 0.5, 0.14, 0.5),
        "rim": (lambda i: mix((load("tr808/RS"), 0.7), (rimshot(), 0.6)), 2, 0.55, 0.18, 0),
        "perc": (lambda i: mix((load("tr808/CB"), 0.6), (cowbell(560 * (1, 1.19)[i]), 0.6)), 2, 0.45, 0.2, 0),
        "bass": (lambda i: sub808(43.65, 0.9, 0.32, 1.7), 1, 0.8, 0.0, 1),
    }

def boom():
    kicks = ["tr808/BD0050", "boochi/vintage-kick-02", "tr808/BD2525"]
    snares = ["boochi/vintage-snare-01", "boochi/vintage-snare-03", "tr808/SD5010"]
    def kick(i):
        x = mix((cut(load(kicks[i]), 0.5), 0.9), (sweep_kick(48, 140, 0.05, 0.5, 0.22, 1.2), 0.6), (click(0.006, 1500), 0.2))
        return peak(sat(crush(lp(x, 6000), 12), 2.2), 80, 1.0, 3)
    def snare(i):
        x = mix((load(snares[i]), 0.9), (noise_snare(180, 0.22, bpf=1400), 0.5))
        return peak(peak(sat(crush(lp(x, 9000), 12), 2.0), 240, 1.2, 2), 3500, 1.0, 2)
    return {
        "kick": (kick, 3, 1.0, 0.05, 0),
        "snare": (snare, 3, 0.85, 0.28, 0),
        "clap": (lambda i: crush(lp(mix((load("boochi/vintage-clap-01"), 0.8), (clap(0.3, 0.012, 3, 0.08), 0.6)), 8000), 12), 2, 0.65, 0.32, 0),
        "hat": (lambda i: crush(lp(mix((load("boochi/hi-hat-closed-01"), 0.7), (load("tr808/CH"), 0.5)), 9500), 12), 3, 0.5, 0.08, 0.4),
        "open": (lambda i: lp(mix((load("boochi/open-hat-01"), 0.7), (load("tr808/OH10"), 0.5)), 9000), 2, 0.5, 0.15, 0.4),
        "rim": (lambda i: crush(lp(load("tr808/RS"), 7000), 12), 2, 0.55, 0.2, 0),
        "perc": (lambda i: mix((load(["tr808/LC00", "tr808/MC00"][i]), 0.7), (conga((205, 250)[i]), 0.6)), 2, 0.5, 0.22, 0),
        "bass": (lambda i: lp(sub808(43.65, 0.9, 0.3, 2.0), 800), 1, 0.85, 0.0, 1),
    }

def club():
    return {
        "kick": (lambda i: peak(peak(sat(mix((sweep_kick(48, 220, 0.03, 0.4, 0.13, 2.2), 1.0), (cut(load("tr808/BD0000"), 0.3), 0.4), (click(0.004, 4000), 0.4)), 2.6), 55, 1.0, 2), 3000, 1.0, 2), 3, 1.0, 0.03, 0),
        "snare": (lambda i: sat(hp(mix((clap(), 0.9), (cut(load("tr808/CP"), 0.4), 0.6), (load("tr808/SD0000"), 0.7), (noise_snare(210, 0.2), 0.4)), 200), 1.8), 3, 0.85, 0.26, 0),
        "clap": (lambda i: hp(mix((clap(0.4, 0.012, 5, 0.12), 0.9), (cut(load("tr808/CP"), 0.4), 0.5)), 400), 2, 0.7, 0.34, 0),
        "hat": (lambda i: peak(hp(mix((metal_hat(0.07, 0.018, 8500, 340), 0.9), (load("tr808/CH"), 0.3)), 7000), 12000, 1.0, 3), 3, 0.5, 0.07, 0.6),
        "open": (lambda i: hp(mix((metal_hat(0.32, 0.11, 6500), 0.8), (load("tr808/OH50"), 0.5)), 5500), 2, 0.5, 0.14, 0.6),
        "rim": (lambda i: rimshot(), 2, 0.5, 0.2, 0),
        "perc": (lambda i: tom((130, 98)[i]), 2, 0.5, 0.2, 0),
        "bass": (lambda i: sub808(43.65, 0.7, 0.22, 1.2), 1, 0.85, 0.0, 1),
    }

def wood():
    congas = ["tr808/LC00", "tr808/MC00", "tr808/HC00"]
    return {
        "kick": (lambda i: peak(peak(sat(mix((acoustic_kick(), 0.9), (cut(load("tr808/BD7500"), 0.3), 0.35)), 1.3), 70, 1.0, 2), 4000, 1.0, 1.5), 3, 1.0, 0.08, 0),
        "snare": (lambda i: peak(peak(hp(mix((acoustic_snare(), 0.9), (load("tr808/SD7510"), 0.35)), 150), 230, 1.2, 2), 6000, 0.8, 2), 3, 0.85, 0.3, 0),
        "clap": (lambda i: snap(), 2, 0.6, 0.3, 0),
        "hat": (lambda i: hp(mix((shaker(), 0.8), (load("tr808/MA"), 0.5)), 4000), 3, 0.45, 0.1, 0.3),
        "open": (lambda i: ride_bell(), 2, 0.4, 0.2, 0.3),
        "rim": (lambda i: mix((rimshot(), 0.8), (load("tr808/RS"), 0.3), (bp(noise(sec(0.03)), 2000, 1.5) * expdec(sec(0.03), 0.004), 0.4)), 2, 0.5, 0.2, 0),
        "perc": (lambda i: mix((load(congas[i]), 0.7), (conga((205, 250, 310)[i]), 0.5)), 3, 0.5, 0.24, 0),
        "bass": (lambda i: pluck_bass(), 1, 0.8, 0.0, 1),
    }

KITS = {"punch": punch, "boom": boom, "club": club, "wood": wood}

# ───────────────────────── render ─────────────────────────

def write(path, x):
    x = np.clip(x + rng.uniform(-1, 1, len(x)) / 65536, -1, 1)   # TPDF-ish dither
    wavfile.write(path, SR, (x * 32767).astype(np.int16))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit")
    args = ap.parse_args()
    manifest = {"sampleRate": SR, "bassRoot": 43.65, "kits": {}}
    if OUT.joinpath("manifest.json").exists():
        manifest = json.loads(OUT.joinpath("manifest.json").read_text())
    for name, build in KITS.items():
        if args.kit and args.kit != name: continue
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        voices = {}
        for voice, (render, count, gain, send, duck) in build().items():
            files = []
            for i in range(count):
                x = finish(vary(render(i), i))
                f = f"{voice}-{i + 1}.wav"
                write(d / f, x)
                files.append(f)
                print(f"{name}/{f:12s} {len(x) / SR * 1000:6.0f} ms")
            voices[voice] = {"files": files, "gain": gain, "send": send, "duck": duck}
        manifest["kits"][name] = voices
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print("wrote", OUT / "manifest.json")

if __name__ == "__main__":
    main()
