// Procedural sound: every effect is synthesised with WebAudio, so the game ships
// no audio files and makes no network request. The context is created lazily on
// the first user gesture, because browsers block audio before one.
export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // A burst of filtered noise: gunshots, explosions, impacts.
  function burst({ duration, filterFreq, gain, type = 'lowpass', when = 0 }) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + duration);
  }

  // A pitched blip: beeps, hits, UI clicks, melodies.
  function tone({ freq, endFreq, duration, gain, type = 'sine', when = 0 }) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Two-note and three-note phrases, written out so each effect reads as music.
  function phrase(notes) {
    for (const n of notes) tone(n);
  }

  return {
    unlock: ensure,
    shot(kind) {
      if (kind === 'rifle') { burst({ duration: 0.12, filterFreq: 1800, gain: 0.5 }); tone({ freq: 160, endFreq: 60, duration: 0.09, gain: 0.35, type: 'triangle' }); }
      else if (kind === 'smg') { burst({ duration: 0.09, filterFreq: 2400, gain: 0.4 }); }
      else { burst({ duration: 0.1, filterFreq: 1500, gain: 0.45 }); tone({ freq: 220, endFreq: 90, duration: 0.08, gain: 0.3, type: 'triangle' }); }
    },
    enemyShot() { burst({ duration: 0.1, filterFreq: 1200, gain: 0.16 }); },
    reload() { phrase([{ freq: 900, duration: 0.05, gain: 0.15, type: 'square' }, { freq: 600, duration: 0.05, gain: 0.15, type: 'square', when: 0.25 }]); },
    hit() { tone({ freq: 1400, duration: 0.05, gain: 0.2, type: 'square' }); },
    kill() { phrase([{ freq: 1400, duration: 0.06, gain: 0.2, type: 'square' }, { freq: 1800, duration: 0.08, gain: 0.2, type: 'square', when: 0.07 }]); },
    hurt() { tone({ freq: 110, endFreq: 70, duration: 0.18, gain: 0.3, type: 'sawtooth' }); },
    plantBeep() { tone({ freq: 1200, duration: 0.07, gain: 0.18, type: 'square' }); },
    explosion() {
      burst({ duration: 1.1, filterFreq: 400, gain: 0.9 });
      tone({ freq: 90, endFreq: 30, duration: 0.9, gain: 0.6, type: 'sine' });
    },
    roundWin() { phrase([{ freq: 523, duration: 0.12, gain: 0.2 }, { freq: 659, duration: 0.12, gain: 0.2, when: 0.12 }, { freq: 784, duration: 0.2, gain: 0.2, when: 0.24 }]); },
    roundLose() { phrase([{ freq: 392, duration: 0.15, gain: 0.2 }, { freq: 311, duration: 0.25, gain: 0.2, when: 0.15 }]); },
    click() { tone({ freq: 1000, duration: 0.04, gain: 0.12, type: 'square' }); },
    bounce() { tone({ freq: 300, endFreq: 180, duration: 0.08, gain: 0.15, type: 'triangle' }); },
  };
}
