// 観客の声（すべてその場で合成）
// ざわめき・歓声のうねり・チャント（声＋手拍子＋太鼓）・ため息・ブーイング・指笛
export function makeCrowd(AC, out) {
  const now = () => AC.currentTime;
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 2.5; comp.attack.value = 0.01; comp.release.value = 0.4;
  const bus = AC.createGain(); bus.gain.value = 1.0;
  bus.connect(comp); comp.connect(out);

  // ピンクノイズ
  const len = AC.sampleRate * 4;
  const nbuf = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = nbuf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  }
  const noise = (off = 0) => { const s = AC.createBufferSource(); s.buffer = nbuf; s.loop = true; s.start(now(), off); return s; };
  const formant = (src, fs, qs, gs) => {
    const sum = AC.createGain();
    fs.forEach((f, i) => { const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = qs[i]; const g = AC.createGain(); g.gain.value = gs[i]; src.connect(bp); bp.connect(g); g.connect(sum); });
    return sum;
  };

  // 1) ざわめき（たくさんの人の話し声）
  const bedG = AC.createGain(); bedG.gain.value = 0.55;
  {
    const a = formant(noise(0), [600, 1100, 2500], [1.4, 1.8, 2.2], [1.0, 0.7, 0.35]);
    const b = formant(noise(1.3), [420, 900, 2200], [1.6, 2.0, 2.5], [0.9, 0.6, 0.3]);
    const mod = AC.createGain(); mod.gain.value = 1;
    a.connect(mod); b.connect(mod); mod.connect(bedG); bedG.connect(bus);
    // ゆらぎ
    const l1 = AC.createOscillator(); l1.frequency.value = 0.21; const lg1 = AC.createGain(); lg1.gain.value = 0.18; l1.connect(lg1); lg1.connect(mod.gain); l1.start();
    const l2 = AC.createOscillator(); l2.frequency.value = 0.067; const lg2 = AC.createGain(); lg2.gain.value = 0.22; l2.connect(lg2); lg2.connect(mod.gain); l2.start();
  }
  // 2) 歓声のうねり（攻めると大きくなる）
  const roarG = AC.createGain(); roarG.gain.value = 0;
  const roarF = AC.createBiquadFilter(); roarF.type = 'lowpass'; roarF.frequency.value = 1200; roarF.Q.value = 0.6;
  {
    const a = formant(noise(2.1), [750, 1250, 2700], [1.0, 1.3, 1.8], [1.0, 0.8, 0.45]);
    a.connect(roarF); roarF.connect(roarG); roarG.connect(bus);
  }
  // 3) 声の合唱（チャント・ため息・歓声）：のこぎり波を少しずつずらして重ねる
  const voices = [];
  const choirIn = AC.createGain(); choirIn.gain.value = 1;
  const choirOut = AC.createGain(); choirOut.gain.value = 0;
  const vowel = { o: [[480, 850, 2500], [5, 6, 8], [1, 0.55, 0.12]], a: [[760, 1250, 2600], [5, 6, 8], [1, 0.7, 0.18]], u: [[330, 820, 2300], [5, 7, 8], [1, 0.35, 0.08]] };
  const vf = [0, 1, 2].map(() => { const f = AC.createBiquadFilter(); f.type = 'bandpass'; return f; });
  const vg = [0, 1, 2].map(() => AC.createGain());
  vf.forEach((f, i) => { choirIn.connect(f); f.connect(vg[i]); vg[i].connect(choirOut); });
  const breath = AC.createGain(); breath.gain.value = 0.25; noise(3.0).connect(breath); breath.connect(choirIn);
  choirOut.connect(bus);
  function setVowel(v, t = now(), k = 0.05) { const [fs, qs, gs] = vowel[v]; vf.forEach((f, i) => { f.frequency.setTargetAtTime(fs[i], t, k); f.Q.setTargetAtTime(qs[i], t, k); vg[i].gain.setTargetAtTime(gs[i] * 3.2, t, k); }); }
  setVowel('o');
  for (let i = 0; i < 26; i++) {
    const o = AC.createOscillator(); o.type = 'sawtooth';
    const base = i < 18 ? 1 : 2; // 下の声と上の声
    o.frequency.value = 160 * base;
    const det = (Math.random() - 0.5) * 70; o.detune.value = det;
    const vib = AC.createOscillator(); vib.frequency.value = 4 + Math.random() * 2.5; const vgn = AC.createGain(); vgn.gain.value = 9 + Math.random() * 8; vib.connect(vgn); vgn.connect(o.detune); vib.start();
    const g = AC.createGain(); g.gain.value = 0.045 / base;
    o.connect(g); g.connect(choirIn); o.start();
    voices.push({ o, base, det });
  }
  function choirPitch(hz, t, k = 0.03) { for (const v of voices) v.o.frequency.setTargetAtTime(hz * v.base * (v.base > 1 ? 0.75 : 1), t, k); }
  // 4) ブーイング（低い「ウー」）
  const booG = AC.createGain(); booG.gain.value = 0;
  {
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const fsum = formant(lp, [320, 760], [4, 5], [1, 0.4]);
    for (let i = 0; i < 16; i++) {
      const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 105 + Math.random() * 45;
      const vib = AC.createOscillator(); vib.frequency.value = 3 + Math.random() * 3; const vgn = AC.createGain(); vgn.gain.value = 14; vib.connect(vgn); vgn.connect(o.detune); vib.start();
      const g = AC.createGain(); g.gain.value = 0.06; o.connect(g); g.connect(lp); o.start();
    }
    const n = noise(0.7); const ng = AC.createGain(); ng.gain.value = 0.3; n.connect(ng); ng.connect(lp);
    fsum.connect(booG); booG.connect(bus);
  }
  // 手拍子
  const clapBuf = (() => { const n = Math.floor(AC.sampleRate * 0.06), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6); return b; })();
  const clapBus = AC.createBiquadFilter(); clapBus.type = 'bandpass'; clapBus.frequency.value = 1500; clapBus.Q.value = 0.7;
  const clapG = AC.createGain(); clapG.gain.value = 0.9; clapBus.connect(clapG); clapG.connect(bus);
  function clap(t, n = 10, vol = 1) {
    for (let i = 0; i < n; i++) {
      const s = AC.createBufferSource(); s.buffer = clapBuf; s.playbackRate.value = 0.8 + Math.random() * 0.5;
      const g = AC.createGain(); g.gain.value = (0.25 + Math.random() * 0.25) * vol;
      s.connect(g); g.connect(clapBus); s.start(t + Math.random() * 0.045);
    }
  }
  // 太鼓
  function drum(t, vol = 1) {
    const o = AC.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4);
    const s = AC.createBufferSource(); s.buffer = clapBuf; s.playbackRate.value = 0.25; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; const g2 = AC.createGain(); g2.gain.value = 0.5 * vol; s.connect(lp); lp.connect(g2); g2.connect(bus); s.start(t);
  }
  // 指笛
  function whistle(t, vol = 1) {
    const o = AC.createOscillator(); o.type = 'sine';
    const f = 2200 + Math.random() * 900; o.frequency.setValueAtTime(f * 0.8, t); o.frequency.linearRampToValueAtTime(f, t + 0.06); o.frequency.linearRampToValueAtTime(f * (Math.random() < .5 ? 1.15 : 0.9), t + 0.35);
    const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * vol, t + 0.03); g.gain.setValueAtTime(0.06 * vol, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 0.45);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.5);
  }

  // チャントの型（半音のずれ・長さ（拍）・手拍子）
  const CHANTS = [
    // オー、オオオー（応援歌ふう）
    { bpm: 132, notes: [[0, 1, 'o', 1], [0, 0.5, 'o', 0], [2, 0.5, 'o', 0], [4, 2, 'o', 1], [4, 1, 'o', 1], [2, 0.5, 'o', 0], [0, 0.5, 'o', 0], [-1, 2, 'o', 1]] },
    // 手拍子3つ＋「ニッポン」型の掛け声（チーム名の代わりに「アー・アー」）
    { bpm: 120, notes: [[null, 0.5, '', 1], [null, 0.5, '', 1], [null, 1, '', 1], [5, 0.5, 'a', 0], [5, 0.5, 'a', 0], [7, 1, 'a', 0]] },
    // ゆっくりの大合唱
    { bpm: 92, notes: [[0, 1.5, 'o', 1], [3, 0.5, 'o', 0], [5, 1, 'a', 1], [3, 1, 'o', 1], [0, 2, 'o', 1], [-2, 2, 'o', 1]] },
    // 太鼓だけで煽る
    { bpm: 150, notes: [[null, 0.5, '', 2], [null, 0.5, '', 2], [null, 0.5, '', 2], [null, 0.5, '', 0], [7, 1, 'a', 1], [7, 1, 'a', 1]] },
  ];
  const S = { ex: 0, anger: 0, roarT: 0, chant: null, chantNext: now() + 4, sched: 0, busyUntil: 0, whT: 0 };

  function startChant(intensity = 1) {
    const c = CHANTS[(Math.random() * CHANTS.length) | 0];
    const key = 150 + Math.random() * 40;
    S.chant = { c, key, i: 0, t: now() + 0.1, reps: 3 + ((Math.random() * 3) | 0), rep: 0, vol: intensity };
  }
  function scheduleChant() {
    const C = S.chant; if (!C) return;
    const beat = 60 / C.c.bpm;
    while (C.t < now() + 0.25) {
      const [semi, len, v, cl] = C.c.notes[C.i];
      const t = C.t, d = len * beat;
      if (semi != null) {
        setVowel(v, t, 0.02);
        choirPitch(C.key * Math.pow(2, semi / 12), t, 0.02);
        choirOut.gain.setTargetAtTime(0.55 * C.vol, t, 0.03);
        choirOut.gain.setTargetAtTime(0.12 * C.vol, t + d * 0.82, 0.04);
      } else choirOut.gain.setTargetAtTime(0.0, t, 0.05);
      if (cl) { clap(t, 14, C.vol); if (cl === 2 || Math.random() < 0.5) drum(t, 0.8 * C.vol); }
      C.t += d; C.i++;
      if (C.i >= C.c.notes.length) { C.i = 0; C.rep++; if (C.rep >= C.reps) { choirOut.gain.setTargetAtTime(0, C.t, 0.2); S.chant = null; S.chantNext = now() + 10 + Math.random() * 16; return; } }
    }
  }
  function stopChant() { if (S.chant) { S.chant = null; choirOut.gain.cancelScheduledValues(now()); } S.chantNext = now() + 8 + Math.random() * 10; }

  function swell(level, holdSec, decaySec) { // 一気に大きな声
    const t = now();
    roarG.gain.cancelScheduledValues(t); roarG.gain.setValueAtTime(roarG.gain.value, t);
    roarG.gain.linearRampToValueAtTime(level, t + 0.25);
    roarF.frequency.cancelScheduledValues(t); roarF.frequency.setValueAtTime(roarF.frequency.value, t); roarF.frequency.linearRampToValueAtTime(1500 + level * 2500, t + 0.25);
    S.busyUntil = t + holdSec + decaySec;
    roarG.gain.setValueAtTime(level, t + holdSec); roarG.gain.linearRampToValueAtTime(0.1, t + holdSec + decaySec);
    roarF.frequency.setValueAtTime(1500 + level * 2500, t + holdSec); roarF.frequency.linearRampToValueAtTime(1200, t + holdSec + decaySec);
  }
  function groan() { // 「あぁ〜」
    stopChant();
    const t = now();
    setVowel('a', t, 0.03);
    for (const v of voices) { v.o.frequency.cancelScheduledValues(t); v.o.frequency.setValueAtTime(260 * v.base * (v.base > 1 ? 0.75 : 1), t); v.o.frequency.exponentialRampToValueAtTime(150 * v.base * (v.base > 1 ? 0.75 : 1), t + 1.4); }
    choirOut.gain.cancelScheduledValues(t); choirOut.gain.setValueAtTime(choirOut.gain.value, t);
    choirOut.gain.linearRampToValueAtTime(0.75, t + 0.12); choirOut.gain.linearRampToValueAtTime(0.0, t + 1.6);
    swell(0.6, 0.2, 1.2);
  }
  function cheerVoice(sec = 3) { // 「ワー」
    stopChant();
    const t = now();
    setVowel('a', t, 0.02); choirPitch(300, t, 0.05);
    choirOut.gain.cancelScheduledValues(t); choirOut.gain.setValueAtTime(choirOut.gain.value, t);
    choirOut.gain.linearRampToValueAtTime(1.3, t + 0.15); choirOut.gain.setValueAtTime(1.3, t + sec); choirOut.gain.linearRampToValueAtTime(0, t + sec + 1.5);
    for (let k = 0; k < sec * 3; k++) whistle(t + Math.random() * sec, 1.2);
  }

  return {
    // 毎フレーム：ex は攻めの盛り上がり（0〜1）、anger は観客の怒り（0〜100）
    update(dt, ex, anger) {
      S.ex += (ex - S.ex) * Math.min(1, dt * 2.5);
      S.anger = anger;
      const t = now();
      if (t > S.busyUntil) {
        const lvl = 0.03 + S.ex * 0.6;
        roarG.gain.setTargetAtTime(lvl, t, 0.35);
        roarF.frequency.setTargetAtTime(900 + S.ex * 2600, t, 0.4);
      }
      bedG.gain.setTargetAtTime(0.3 + S.ex * 0.2, t, 0.5);
      booG.gain.setTargetAtTime(Math.max(0, (anger - 22) / 78) * 0.9, t, 0.6);
      // チャント（怒っているときはやめる）
      if (!S.chant && t > S.chantNext && t > S.busyUntil && anger < 45) startChant(0.85 + Math.random() * 0.3);
      if (S.chant && anger > 60) stopChant();
      scheduleChant();
      // 指笛（怒りで増える）
      S.whT -= dt;
      if (S.whT <= 0) { S.whT = 0.3 + Math.random() * (anger > 40 ? 1.2 : 7); if (anger > 40 || Math.random() < 0.4) whistle(t, anger > 40 ? 1.3 : 0.6); }
    },
    shot() { swell(1.4, 0.5, 0.6); stopChant(); },
    miss() { groan(); },
    save() { swell(1.3, 0.4, 1.2); for (let k = 0; k < 3; k++) whistle(now() + Math.random() * 0.6); clap(now() + 0.3, 30, 0.8); },
    goal() { swell(2.2, 4.5, 3.5); cheerVoice(4); for (let b = 0; b < 16; b++) { drum(now() + 0.6 + b * 0.24, 1); clap(now() + 0.6 + b * 0.24, 20, 1); } S.chantNext = now() + 9; },
    foul() { swell(0.9, 0.15, 0.6); for (let k = 0; k < 4; k++) whistle(now() + Math.random() * 0.5, 1.3); },
    card(cheer) { if (cheer) { swell(0.7, 0.4, 1); clap(now(), 30, 0.9); } else { swell(0.5, 0.2, 0.8); for (let k = 0; k < 6; k++) whistle(now() + Math.random() * 0.8, 1.4); } },
    ooh() { swell(0.8, 0.3, 0.8); },
  };
}
