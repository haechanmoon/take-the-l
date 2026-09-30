"""Render the playground's original dance loop; no samples or external packages."""

import array
import math
from pathlib import Path
import random
import wave

RATE = 22050
BPM = 132
BEAT = 60 / BPM
BARS = 8
LENGTH = BEAT * 4 * BARS
track = [0.0] * round(LENGTH * RATE)
rng = random.Random(132)


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def add(start, duration, sample):
    offset = round(start * RATE)
    for frame in range(round(duration * RATE)):
        track[(offset + frame) % len(track)] += sample(frame / RATE)


def tone(start, duration, note, volume, brass=False):
    pitch = frequency(note)

    def sample(t):
        attack = min(1, t / 0.008)
        release = min(1, max(0, (duration - t) / 0.05))
        envelope = attack * release * (0.7 + 0.3 * math.exp(-t * 8))
        phase = 2 * math.pi * pitch * t
        if brass:
            sound = (math.sin(phase) + 0.36 * math.sin(2 * phase)
                     + 0.18 * math.sin(3 * phase) + 0.08 * math.sin(4 * phase)) / 1.62
        else:
            sound = math.sin(phase) + 0.18 * math.sin(2 * phase)
        return volume * envelope * sound

    add(start, duration, sample)


# A new, short melody over a bouncing minor-key groove.
melody = [
    [79, None, 82, 86, None, 84, 82, None],
    [79, 82, None, 77, 79, None, 74, None],
    [79, None, 82, 86, 87, None, 86, 82],
    [84, None, 82, 79, None, 77, 74, None],
    [79, None, 82, 86, None, 84, 82, 79],
    [77, None, 79, 82, 79, None, 74, None],
    [82, 86, None, 87, 86, 84, 82, None],
    [79, None, 77, 74, 77, None, 79, None],
]
roots = [43, 43, 39, 41, 43, 43, 39, 38]
chords = [[55, 58, 62], [55, 58, 62], [51, 55, 58], [53, 57, 60],
          [55, 58, 62], [55, 58, 62], [51, 55, 58], [50, 53, 57]]

for bar in range(BARS):
    for half, note in enumerate(melody[bar]):
        if note is not None:
            tone((bar * 4 + half * 0.5) * BEAT, BEAT * 0.35, note, 0.23, brass=True)
    for beat in range(4):
        at = (bar * 4 + beat) * BEAT
        tone(at, BEAT * 0.37, roots[bar] + (7 if beat % 2 else 0), 0.3)
        for note in chords[bar]:
            tone(at + BEAT * 0.5, BEAT * 0.22, note, 0.045, brass=True)

        def kick(t):
            # An integrated pitch sweep gives a rounded, punchy kick.
            phase = 2 * math.pi * (45 * t + 110 * (1 - math.exp(-t * 40)) / 40)
            return 0.45 * math.sin(phase) * math.exp(-t * 27) * min(1, t / 0.002)

        add(at, 0.18, kick)
        if beat % 2:
            add(at, 0.14, lambda t: 0.19 * rng.uniform(-1, 1) * math.exp(-t * 34)
                + 0.08 * math.sin(2 * math.pi * 180 * t) * math.exp(-t * 38))
        for offbeat in [0, 0.5]:
            add(at + offbeat * BEAT, 0.06,
                lambda t: 0.065 * rng.uniform(-1, 1) * math.exp(-t * 85))

peak = max(abs(value) for value in track)
pcm = array.array("h", [round(value / peak * 0.85 * 32767) for value in track])
destination = Path(__file__).resolve().parents[1] / "web/public/audio/playground.wav"
with wave.open(str(destination), "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(RATE)
    output.writeframes(pcm.tobytes())
print(f"Created original {BPM} BPM loop: {LENGTH:.2f}s, {destination.stat().st_size} bytes")
