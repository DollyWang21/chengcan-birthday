/* 木鱼与猫叫用真实录音（assets/audio/*.mp3），其余音效仍由 Web Audio 合成 */
window.Sound = (function () {
  let ctx = null, master = null, enabled = true, purrNode = null;
  const files = {};
  let loading = false;

  const SRC = {
    wood: "assets/audio/woodfish.mp3",
    sign: "assets/audio/sign-shake.mp3",
    lighter: "assets/audio/lighter.mp3",
    meow: "assets/audio/cat-meow.mp3",
    purr: "assets/audio/cat-purr.mp3",
    whine: "assets/audio/cat-whine.mp3",
    annoy: "assets/audio/cat-annoy.mp3"
  };
  /* =====================================================================
     音量总控 —— 调音量只需要改这一段，别的地方不用动
     ----------------------------------------------------------------------
     v2：按 7 个 mp3 的实测 RMS/峰值重新配平（decodeAudioData 实测，非估算）。
     目标：木鱼与猫叫并列主角，其余按“事件 > 情绪 > 持续音 > 背景”递减。
     ===================================================================== */
  const MASTER_VOL = 0.95;          // 总音量（所有声音一起放大/缩小，含背景音与八音盒）
  const AMB_VOL = 0.72;             // 背景音（环境音）相对音量
  /* play() 内部还有一层 0.55 的固定系数（历史遗留，未动），
     所以下面填的是“扣掉 0.55 之后”的倍数，实际输出 = GAIN × 0.55 × MASTER_VOL。
     v2：按 7 个 mp3 的实测 RMS/峰值重新配平（decodeAudioData 实测，非估算）。
     目标：木鱼与猫叫并列主角，其余按“事件 > 情绪 > 持续音 > 背景”递减。 */
  const GAIN = {                    // 各个音效的音量倍数
    wood: 1.64,                     // 木鱼（实际输出 -19.9 dBFS / 峰值 0.84）
    sign: 1.10,                     // 摇签筒（0.52s 实录：摇 + 落签，峰值约 0.58）
    lighter: 1.15,                  // 打火机“唰”（0.39s 实录，峰值 -4.8 dBFS）
    meow: 2.36,                     // 小猫叫（-20.1 / 0.75，与木鱼持平，不再压过它）
    purr: 1.41,                     // 小猫呼噜（-26.1 / 0.40，持续音压到底噪层；不走 0.55）
    whine: 1.22,                    // 小猫哼唧（-22.7 / 0.25，原全场最响，已降）
    annoy: 2.27                     // 小猫不耐烦（-21.0 / 0.66）
  };
  /* ==================== 音量总控结束（下面别动） ==================== */

  /* 背景音与八音盒原来走 HTMLAudio 的绝对音量，和音效的 master 是两条平行链路，
     总音量一动，背景/音效的比例就漂。这里把它们也接到 master，合成一条链路。
     只做“挂载”，不改音量曲线、不改播放时序。 */
  let ambSrc = null, boxSrc = null;
  function hookMedia() {
    if (!ctx || !master) return;
    try {
      if (amb && !ambSrc) {
        ambSrc = ctx.createMediaElementSource(amb);
        ambSrc.connect(master);
      }
      if (box && !boxSrc) {
        boxSrc = ctx.createMediaElementSource(box);
        boxSrc.connect(master);
      }
    } catch (e) {}
  }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_VOL;
    master.connect(ctx.destination);
    hookMedia();
    return ctx;
  }

  function preload() {
    const c = ensure();
    if (!c || loading) return;
    loading = true;
    Object.keys(SRC).forEach((k) => {
      fetch(SRC[k])
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("404"))))
        .then((ab) => c.decodeAudioData(ab))
        .then((b) => { files[k] = b; })
        .catch(() => {});
    });
  }

  function unlock() {
    const c = ensure();
    preload();
    if (!c) return;
    if (c.state === "suspended") c.resume();
  }

  function noise(dur) {
    const c = ensure();
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function gate() { return enabled && ensure(); }

  function play(name, opt) {
    const o = opt || {};
    if (!gate() || !files[name]) return null;
    const c = ctx, t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = files[name];
    s.loop = !!o.loop;
    s.playbackRate.value = o.rate || 1;
    const g = c.createGain();
    const peak = Math.max((o.gain || 1) * (GAIN[name] || 1) * 0.55, 0.0002);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    s.connect(g); g.connect(master);
    s.start(t);
    return { s, g };
  }

  /* ---------- 背景音与八音盒：用真实录音 ---------- */
  const amb = typeof Audio !== "undefined" ? new Audio("assets/audio/ambient.mp3") : null;
  if (amb) { amb.loop = true; amb.preload = "auto"; amb.volume = 0; }
  const box = typeof Audio !== "undefined" ? new Audio("assets/audio/birthday-box.mp3") : null;
  if (box) { box.preload = "auto"; box.volume = 0.9; }
  let ambFade = null;

  function fadeAmb(to, ms) {
    if (!amb) return;
    clearInterval(ambFade);
    const from = amb.volume;
    const steps = Math.max(1, Math.round(ms / 60));
    let i = 0;
    ambFade = setInterval(() => {
      i += 1;
      amb.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
      if (i >= steps) {
        clearInterval(ambFade);
        ambFade = null;
        if (to === 0) { try { amb.pause(); } catch (e) {} }
      }
    }, 60);
  }

  function bgmStart() {
    if (!enabled || !amb) return;
    /* 合并到 master 之后，音频上下文若还是挂起状态，背景音会完全没声（原来是原生音频，
       挂起也能响）。这里补一次 resume，时序不变。 */
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    if (!amb.paused && amb.volume > 0.01) return;
    const pr = amb.play();
    if (pr && pr.then) pr.then(() => fadeAmb(AMB_VOL, 1200)).catch(() => {});
  }

  function bgmStop() {
    if (!amb) return;
    fadeAmb(0, 700);
  }

  function birthdayBox() {
    if (!enabled || !box) return;
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    if (amb && !amb.paused) {
      amb.dataset.duck = "1";
      fadeAmb(0.1, 500);
    }
    box.onended = () => {
      if (amb && !amb.paused && amb.dataset.duck === "1") {
        delete amb.dataset.duck;
        fadeAmb(AMB_VOL, 1400);
      }
    };
    try { box.currentTime = 0; } catch (e) {}
    const pr = box.play();
    if (pr && pr.catch) pr.catch(() => {});
  }

  function stopAmbientNow() {
    clearInterval(ambFade);
    ambFade = null;
    if (amb) { try { amb.pause(); } catch (e) {} }
    if (box) { try { box.pause(); } catch (e) {} }
  }

  function stopPurr(fade) {
    if (!purrNode) return;
    const n = purrNode; purrNode = null;
    const c = ctx, t = c.currentTime, f = fade || 0.35;
    try {
      const g = n.g || n.out;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + f);
      n.s.stop(t + f + 0.05);
      if (n.lfo) n.lfo.stop(t + f + 0.05);
    } catch (e) {}
  }

  const api = {
    setEnabled(v) {
      enabled = v;
      if (master) master.gain.value = v ? MASTER_VOL : 0;
      if (!v) { stopPurr(0.2); stopAmbientNow(); } else { bgmStart(); }
    },
    get enabled() { return enabled; },
    bgmStart, bgmStop, birthdayBox, unlock, preload,
    state() {
      return {
        amb: amb ? { paused: amb.paused, volume: +amb.volume.toFixed(2) } : null,
        box: box ? { paused: box.paused, time: +box.currentTime.toFixed(2) } : null,
        enabled
      };
    },
    debug() { return Object.keys(files); },

    wood() {
      if (!gate()) return;
      if (files.wood) {
        play("wood", { rate: 0.94 + Math.random() * 0.12, gain: 1 });
        return;
      }
      const c = ctx, t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noise(0.12);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 820; bp.Q.value = 7;
      const g = c.createGain();
      src.connect(bp); bp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      src.start(t); src.stop(t + 0.13);

      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(105, t + 0.09);
      const g2 = c.createGain();
      o.connect(g2); g2.connect(master);
      g2.gain.setValueAtTime(0.5, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.start(t); o.stop(t + 0.15);
    },

    /* 点燃蜡烛：打火机“唰”——金属砂轮“嚓”接一小股气流“呼” */
    lighter() {
      if (files.lighter) { play("lighter", { rate: 1, gain: 1 }); return; }
      if (!gate()) return;
      const c = ctx, t = c.currentTime;
      const n = c.createBufferSource(); n.buffer = noise(0.42);
      const bp = c.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = 1600; bp.Q.value = 2.2;
      const g = c.createGain();
      n.connect(bp); bp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);
      n.start(t); n.stop(t + 0.42);
    },

    /* 戳礼物盒：软木塞“啵” + 两声小铃，音高每次略随机，连点三下不会像复读 */
    gift() {
      if (!gate()) return;
      const c = ctx, t = c.currentTime;
      const r = 0.92 + Math.random() * 0.16;

      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(760 * r, t);
      o.frequency.exponentialRampToValueAtTime(300 * r, t + 0.075);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.40, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.21);

      const bells = [{ d: 0, f: 1620 }, { d: 0.07, f: 1080 }];
      bells.forEach((b) => {
        const o2 = c.createOscillator(); o2.type = "triangle";
        o2.frequency.value = b.f * r;
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, t + b.d);
        g2.gain.exponentialRampToValueAtTime(0.11, t + b.d + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + b.d + 0.26);
        o2.connect(g2); g2.connect(master);
        o2.start(t + b.d); o2.stop(t + b.d + 0.28);
      });

      if (Math.random() < 0.5) {
        const o3 = c.createOscillator(); o3.type = "sine";
        o3.frequency.setValueAtTime(1000 * r, t + 0.05);
        o3.frequency.exponentialRampToValueAtTime(1500 * r, t + 0.15);
        const g3 = c.createGain();
        g3.gain.setValueAtTime(0.0001, t + 0.05);
        g3.gain.exponentialRampToValueAtTime(0.055, t + 0.09);
        g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o3.connect(g3); g3.connect(master);
        o3.start(t + 0.05); o3.stop(t + 0.28);
      }
    },

    /* 摇签筒：0.52s 录音（摇 + 落签），正好配 0.5s 的抖动动画 */
    sign() {
      if (!gate()) return;
      if (files.sign) { play("sign", { rate: 0.98 + Math.random() * 0.06, gain: 1 }); return; }
      const c = ctx, t = c.currentTime;
      for (let i = 0; i < 5; i++) {
        const d = i * 0.075 + Math.random() * 0.03;
        const s = c.createBufferSource(); s.buffer = noise(0.05);
        const bp = c.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = 2200 + Math.random() * 1600; bp.Q.value = 3;
        const gg = c.createGain();
        s.connect(bp); bp.connect(gg); gg.connect(master);
        gg.gain.setValueAtTime(0.5, t + d);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.06);
        s.start(t + d); s.stop(t + d + 0.07);
      }
    },

    meow() {
      if (!gate()) return;
      if (files.meow) { play("meow", { rate: 0.96 + Math.random() * 0.09, gain: 1 }); return; }
      const c = ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(430, t);
      o.frequency.linearRampToValueAtTime(780, t + 0.13);
      o.frequency.exponentialRampToValueAtTime(420, t + 0.42);
      const f1 = c.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 1050; f1.Q.value = 3;
      const f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 2500; f2.Q.value = 5;
      const g = c.createGain();
      o.connect(f1); o.connect(f2);
      f1.connect(g); f2.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.52);
    },

    whine() {
      if (!gate()) return;
      play("whine", { rate: 0.97 + Math.random() * 0.07, gain: 1 });
    },

    annoy() {
      if (!gate()) return;
      play("annoy", { rate: 0.98 + Math.random() * 0.05, gain: 1 });
    },

    coin() {
      if (!gate()) return;
      const c = ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.22);
      const g = c.createGain();
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.start(t); o.stop(t + 0.5);

      const s = c.createBufferSource(); s.buffer = noise(0.25);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
      const g2 = c.createGain();
      s.connect(lp); lp.connect(g2); g2.connect(master);
      g2.gain.setValueAtTime(0.10, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      s.start(t); s.stop(t + 0.3);
    },

    chime() {
      if (!gate()) return;
      const c = ctx, t = c.currentTime;
      [880, 1320, 1760].forEach((hz, i) => {
        const o = c.createOscillator(); o.type = "sine"; o.frequency.value = hz;
        const g = c.createGain();
        o.connect(g); g.connect(master);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12 / (i + 1), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 - i * 0.2);
        o.start(t + i * 0.03); o.stop(t + 1.6);
      });
    },

    paper() {
      if (!gate()) return;
      const c = ctx, t = c.currentTime;
      const s = c.createBufferSource(); s.buffer = noise(0.12);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(1800, t);
      bp.frequency.exponentialRampToValueAtTime(5200, t + 0.1);
      const g = c.createGain();
      s.connect(bp); bp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      s.start(t); s.stop(t + 0.15);
    },

    blow() {
      if (!gate()) return;
      const c = ctx, t = c.currentTime;
      const s = c.createBufferSource(); s.buffer = noise(0.6);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(300, t);
      lp.frequency.linearRampToValueAtTime(900, t + 0.25);
      lp.frequency.linearRampToValueAtTime(300, t + 0.55);
      const g = c.createGain();
      s.connect(lp); lp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      s.start(t); s.stop(t + 0.62);
    },

    purr(on) {
      if (on) {
        if (purrNode || !gate()) return;
        if (files.purr) {
          const c = ctx, t = c.currentTime;
          const s = c.createBufferSource();
          s.buffer = files.purr;
          s.loop = true;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.32 * GAIN.purr, t + 0.4);
          s.connect(g); g.connect(master);
          s.start(t);
          purrNode = { s, g };
          return;
        }
        const c = ctx;
        const s = c.createBufferSource(); s.buffer = noise(2.4); s.loop = true;
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
        const am = c.createGain(); am.gain.value = 0.5;
        const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 26;
        const lfoGain = c.createGain(); lfoGain.gain.value = 0.28;
        lfo.connect(lfoGain); lfoGain.connect(am.gain);
        const out = c.createGain(); out.gain.value = 0.0001;
        s.connect(lp); lp.connect(am); am.connect(out); out.connect(master);
        s.start(); lfo.start();
        out.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.5);
        purrNode = { s, lfo, out };
      } else {
        stopPurr(0.35);
      }
    }
  };

  // 页面加载就开始解码，等第一次交互时已经就绪（此时音频上下文还是挂起的）
  if (typeof window !== "undefined") setTimeout(preload, 300);

  return api;
})();
