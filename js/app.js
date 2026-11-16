(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- 数据 ---------------- */
  const KEY = "cc_2026";
  const LINES_KEY = "cc_photo_lines";
  // ?reset=1：清空本地试用痕迹（上传照片、备注、猫名、功德、抽签、隐藏照片、文案覆盖）；
  // 内置初始愿望和笔记由首次进站流程自动重新生成，不在此清除。
  try {
    if (/[?&]reset=1\b/.test(location.search)) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LINES_KEY);
      location.replace(location.pathname + location.hash);
    }
  } catch (e) {}
  const DEFAULT = {
    catName: "", merit: 0, wishes: [], notes: [], visits: 0, lastVisit: "",
    candle: false, lamp: false, signs: [], sound: true
  };
  function load() {
    try { return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return Object.assign({}, DEFAULT); }
  }
  let data = load();
  // 相册：内置照片 + 六张表情 + 上传，统一用稳定 key
  const POSES = [
    [11, "在吹蜡烛"], [12, "在敲木鱼"], [13, "在摇签筒"],
    [21, "抱着小猫"], [22, "抱着枕头"], [23, "坐着发呆"]
  ];
  if (Array.isArray(data.photos)) {
    data.photos = data.photos.map((x, i) => (typeof x === "string" ? { id: "u" + i, src: x } : x));
  } else {
    data.photos = [];
  }
  if (!Array.isArray(data.hidden)) data.hidden = [];
  if (data.albumNotes) {
    const conv = {};
    Object.keys(data.albumNotes).forEach((k) => {
      conv[/^\d+$/.test(k) ? "p" + k : k] = data.albumNotes[k];
    });
    data.albumNotes = conv;
  }
  data.candle = false; // 蜡烛每次进站都是点着的
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  const firstVisit = !data.visits;
  data.visits += 1;
  data.lastVisit = new Date().toISOString();
  save();

  // 第一次进来，本子里先有一点内容
  if (!data.seeded) {
    data.seeded = true;
    const day = 86400000;
    const push = (arr, list) => {
      list.forEach(([text, ago]) => arr.push({ t: Date.now() - ago * day, text }));
    };
    if (!data.wishes.length) {
      push(data.wishes, [
        ["希望今天能够睡个好觉", 2],
        ["希望考试顺利", 5],
        ["希望生活作息变得规律", 3],
        ["今天的工作学习收获很多", 7]
      ]);
    }
    if (!data.notes.length) {
      push(data.notes, [
        ["今天下班路上下雨了，但闻起来很好", 1],
        ["路边买了一杯热豆浆，捧在手里很暖", 4]
      ]);
    }
    save();
  }

  /* ---------------- 小工具 ---------------- */
  function toast(text, ms = 3200) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("on"), ms);
  }

  /* 桌面引导提示：层/浮层打开期间不弹出，等回到桌面停留片刻后再显示 */
  const TIP_OVERLAYS = ["welcome", "photoedit", "catname", "letter", "viewer", "record", "cardview"];
  let pendingTip = null, tipTimer = null;
  function onDesktop() {
    if (current) return false;
    return TIP_OVERLAYS.every((id) => { const el = document.getElementById(id); return !el || el.hidden; });
  }
  function flushPendingTip() {
    if (!pendingTip) return;
    if (!onDesktop()) return;
    const [text, ms] = pendingTip;
    pendingTip = null;
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    setTimeout(() => toast(text, ms), 800);
  }
  function scheduleTip(text, ms, delay) {
    pendingTip = [text, ms];
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    if (onDesktop()) tipTimer = setTimeout(flushPendingTip, delay);
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dayLabel(key) {
    if (!key || key === "old") return "以前";
    const now = Date.now();
    if (key === dayKey(now)) return "今天";
    if (key === dayKey(now - 86400000)) return "昨天";
    const parts = key.split("-");
    return Number(parts[1]) + " 月 " + Number(parts[2]) + " 日";
  }
  const buzz = (ms) => { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } };

  function ripple(host, x, y, cls = "ripple") {
    const d = document.createElement("i");
    d.className = cls;
    d.style.left = x + "px";
    d.style.top = y + "px";
    host.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
  function floatText(host, x, y, text) {
    const d = document.createElement("b");
    d.className = "float";
    d.textContent = text;
    d.style.left = x + "px";
    d.style.top = y + "px";
    host.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }
  function smoke(host, x, y) {
    const s = document.createElement("i");
    s.className = "smoke";
    s.style.left = x + "px";
    s.style.top = y + "px";
    host.appendChild(s);
    setTimeout(() => s.remove(), 2600);
  }

  /* ---------------- 声音 ---------------- */
  const soundBtn = $("#sound");
  function syncSound() {
    soundBtn.setAttribute("aria-pressed", String(!!data.sound));
    Sound.setEnabled(!!data.sound);
  }
  soundBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    data.sound = !data.sound;
    save();
    syncSound();
  buildRope();
    if (data.sound) { Sound.chime(); Sound.bgmStart(); } else Sound.bgmStop();
  });
  document.addEventListener("pointerdown", () => {
    Sound.unlock();
  }, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { Sound.bgmStop(); Sound.purr(false); }
    else if (data.sound) Sound.bgmStart();
  });

  /* ---------------- 层 ---------------- */
  const layer = $("#layer");
  const layerBody = $("#layerBody");
  let current = null;
  let cakeGreeted = false;
  let welcomedThisSession = false;
  let boxPlayed = false;

  // 只有“按下的那一刻就在背景上”的点击才算关闭，
  // 这样抬手后补发的那个 click 不会把刚弹出的东西关掉
  let downTarget = null, downAt = 0;
  document.addEventListener("pointerdown", (e) => { downTarget = e.target; downAt = Date.now(); }, true);
  function canCloseBackdrop(el) {
    if (Date.now() - downAt > 400) return true;
    return downTarget === el;
  }

  const SIGNS = [
    "今天开始，好事会排队来找你。",
    "会有一些小事，刚好顺你的意。",
    "日子会慢慢变好的，它一向如此。",
    "该来的都在路上，别急。",
    "会有一件小事，让你突然笑出来。",
    "慢一点也没关系，路不会跑。",
    "睡个好觉，明天再说。",
    "你已经做得比你以为的多。"
  ];

  const PHOTOS = [
    "r02", "r03", "r04", "r05", "r06", "r07", "r08",
    "r09", "r10", "r12", "r13", "r14", "r15", "r16",
    "r17", "r19", "r21", "r22", "r23", "r24",
    "r25", "r26", "r27", "r28", "r29", "r30", "r31", "r32",
    "r33", "r34", "r35",
    "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"
  ];
  // 除六张自制 Q 版表情包（POSES）外，其余照片不设内置文案；如需补文案在 lines-editor 里写
  const LINES = [
    "", "", "", "", "", "", "", "", "", "",
    "", "", "", "", "", "", "", "", "", "",
    "", "", "", "", "", "", "", "", "", ""
  ];

  const MILE = {
    1: "功德 +1，烦恼 −1。",
    10: "100 亿% 没问题！\n—— 石纪元",
    18: "吃饭，是活着的证明。\n—— 迷宫饭",
    21: "生日快乐，今年也要好好过。",
    28: "我相信你。\n—— 只有我不存在的城市",
    30: "过去无法改变，但未来可以。\n—— 时光代理人",
    38: "为你，所向披靡。\n—— 天官赐福",
    42: "燃起来吧！\n—— 普罗米亚",
    50: "我不想当什么英雄，只想保护想保护的人。\n—— 一人之下",
    58: "不管重来多少次，我都会救下所有人。\n—— 夏日重现",
    66: "天下之大，何处不能去。\n—— 罗小黑战记",
    68: "我不想再逃避了。\n—— 文豪野犬",
    78: "你真是一个好孩子。\n—— 床边的小豆豆",
    88: "人与人之间的缘分，会让人变得温柔。\n—— 夏目友人帐",
    98: "生命不是用来理解的，是用来感受的。\n—— 虫师",
    100: "信，是把心意送到对方手里的东西。\n—— 紫罗兰永恒花园",
    108: "哪怕只有一瞬间，也要把它记住。\n—— 葬送的芙莉莲",
    1000: "这一千下，都替你记着。"
  };

  function bubble(host, text, ms = 2600) {
    let b = host.querySelector(".bubble");
    if (!b) { b = document.createElement("p"); b.className = "bubble"; host.appendChild(b); }
    b.innerHTML = "";
    const parts = String(text).split("\n");
    const main = document.createElement("span");
    main.textContent = parts[0];
    b.appendChild(main);
    if (parts[1]) {
      const src = document.createElement("small");
      src.textContent = parts[1];
      b.appendChild(src);
    }
    b.classList.add("on");
    clearTimeout(bubble._t);
    bubble._t = setTimeout(() => b.classList.remove("on"), ms);
  }

  function drawLists(host) {
    const fill = (el, arr, empty) => {
      el.innerHTML = "";
      if (!arr.length) {
        const li = document.createElement("li");
        li.textContent = empty;
        el.appendChild(li);
        return;
      }
      const groups = {};
      arr.forEach((it) => {
        const k = it.t ? dayKey(it.t) : "old";
        (groups[k] = groups[k] || []).push(it);
      });
      Object.keys(groups)
        .sort((a, b) => {
          if (a === "old") return 1;
          if (b === "old") return -1;
          return a < b ? 1 : -1;
        })
        .forEach((k) => {
          const head = document.createElement("li");
          head.className = "day";
          head.textContent = dayLabel(k);
          el.appendChild(head);
          groups[k].slice().reverse().forEach((it) => {
            const li = document.createElement("li");
            li.textContent = it.text;
            el.appendChild(li);
          });
        });
    };
    fill($("#wishList", host), data.wishes || [], "（还没有写愿望）");
    fill($("#noteList", host), data.notes || [], "（还没有写）");
  }

  function albumList() {
    const out = [];
    POSES.forEach(([n, line]) => out.push({ key: "pose" + n, src: `assets/photos/pose-${n}.webp`, line }));
    PHOTOS.forEach((p, i) => out.push({ key: "p" + i, src: `assets/photos/${p}.webp`, line: LINES[i] || "" }));
    (data.photos || []).forEach((u) => out.push({ key: u.id, src: u.src, line: "" }));
    // 文案编辑页（lines-editor.html）写入的覆盖文案，实时生效；空字符串表示这张不要文案
    try {
      const ov = JSON.parse(localStorage.getItem(LINES_KEY) || "null");
      if (ov) out.forEach((it) => {
        const m = /^p(\d+)$/.exec(it.key || "");
        if (!m) return;
        const name = PHOTOS[Number(m[1])];
        if (name && Object.prototype.hasOwnProperty.call(ov, name)) it.line = ov[name] || "";
      });
    } catch (e) {}
    return out.filter((it) => (data.hidden || []).indexOf(it.key) < 0);
  }
  function buildRope() {
    const track = $("#ropeTrack");
    if (!track) return;
    const all = albumList();
    track.innerHTML = all.map((it) => `
      <div class="rope-item">
        <img class="rope-clip" src="assets/arts/prop-clip.webp" alt="">
        <img class="rope-photo" src="${it.src}" alt="" data-key="${it.key}">
      </div>`).join("");
    $$(".rope-photo", track).forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = img.dataset.key;
        Sound.paper();
        openLayer("album");
        setTimeout(() => openViewer(key, null), 430);
      });
    });
  }
  let viewerKey = null, viewerCell = null;
  let recordUrl = null;
  /* 页面一加载就把两个字体拉下来：点开卡片/记录时字体已就绪，避免画布落到系统字体 */
  (function prewarmFonts() {
    try {
      document.fonts.load('64px "CC Title"', '成灿，生日快乐。');
      document.fonts.load('42px "CC Hand"', '愿你以后翻相册，翻到的都是好日子。');
      document.fonts.load('48px "CC Title"', '成灿，21 岁生日快乐。');
      document.fonts.load('30px "CC Hand"', '2026.11.17');
    } catch (e) {}
  })();
  async function buildRecord() {
    try {
      await Promise.all([
        document.fonts.load('48px "CC Title"', '成灿，21 岁生日快乐。2026.11.17'),
        document.fonts.load('30px "CC Hand"', '2026.11.17')
      ]);
      await document.fonts.ready;
    } catch (e) {}

    const W = 1080;
    const H = Math.round(W * 932 / 430);
    const SH = H;   // 整幅都是场景，文字说明放到外面的奶油纸边上
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");

    const load = (src) => new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });

    g.fillStyle = "#1B1512";
    g.fillRect(0, 0, W, H);

    g.save();
    g.beginPath();
    g.rect(0, 0, W, SH);
    g.clip();

    const bg = g.createRadialGradient(W / 2, SH * 0.08, 0, W / 2, SH * 0.08, SH * 0.8);
    bg.addColorStop(0, "#4A382E");
    bg.addColorStop(0.5, "#2E2520");
    bg.addColorStop(1, "#1B1512");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, SH);

    const drawBottom = (im, cx, bottomPct, wPct) => {
      if (!im) return;
      const w = W * wPct / 100;
      const h = im.height * w / im.width;
      g.drawImage(im, cx - w / 2, SH - SH * bottomPct / 100 - h, w, h);
    };

    // 桌子
    const deskTop = SH * 0.66;
    g.beginPath();
    g.moveTo(0, deskTop + SH * 0.02);
    g.quadraticCurveTo(W / 2, deskTop - SH * 0.022, W, deskTop + SH * 0.02);
    g.lineTo(W, SH); g.lineTo(0, SH); g.closePath();
    g.fillStyle = "#6B4630"; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 46; i++) {
      g.fillStyle = "rgba(0,0,0,0.05)";
      g.fillRect((W / 46) * i, deskTop - SH * 0.03, W * 0.0018, SH);
    }
    g.restore();

    // 窗
    const win = await load("assets/arts/prop-window.webp");
    if (win) {
      const w = W * 0.33;
      const h = win.height * w / win.width;
      g.drawImage(win, (W - w) / 2, SH * 0.036, w, h);
    }

    // 麻绳
    const rope = await load("assets/arts/prop-rope-tile.webp");
    if (rope) {
      const rh = SH * 0.024;
      const rw = rope.width * rh / rope.height;
      for (let x = -rw; x < W + rw; x += rw) g.drawImage(rope, x, SH * 0.202, rw, rh);
    }

    // 四张拍立得：今天自己放进来的照片优先（最新在最左），不够才用内置那几张
    const mine = albumList().filter((it) => (data.photos || []).some((u) => u.id === it.key));
    const others = albumList().filter((it) => mine.indexOf(it) < 0);
    const items = mine.slice(-4).reverse().concat(others).slice(0, 4);
    const pics = await Promise.all(items.map((it) => load(it.src)));
    const clip = await load("assets/arts/prop-clip.webp");
    const pw = W * 0.215;
    const ph = pw * 1.194;                 // 相纸 620×740：上传的图不管什么比例都居中裁成这个
    const gap = W * 0.026;
    let px = (W - (pw * 4 + gap * 3)) / 2;
    const py = SH * 0.232;
    pics.forEach((im) => {
      if (im) {
        const s = Math.max(pw / im.width, ph / im.height);
        const sw = pw / s, sh = ph / s;
        g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, px, py, pw, ph);
      }
      px += pw + gap;
    });

    // 夹子：和主页绳子上那排同一张图、同一个压边比例（夹住照片上沿）
    if (clip) {
      const cw = pw * 0.1531, chh = cw * (313 / 145);
      let cx = (W - (pw * 4 + gap * 3)) / 2;
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(cx + pw / 2, py - chh * 0.787);
        g.rotate(-2 * Math.PI / 180);
        g.drawImage(clip, -cw / 2, 0, cw, chh);
        g.restore();
        cx += pw + gap;
      }
    }

    // 人物
    const ch = await load("assets/arts/ch-23.webp");
    if (ch) {
      const hh = SH * 0.26;
      const ww = ch.width * hh / ch.height;
      g.drawImage(ch, W / 2 - ww / 2 - W * 0.03, SH - SH * 0.33 - hh, ww, hh);
    }

    // 桌面物件
    drawBottom(await load("assets/arts/prop-woodfish.webp"), W * 0.125, 26, 15);
    drawBottom(await load("assets/arts/prop-sign.webp"), W * 0.87, 30, 14);
    drawBottom(await load("assets/arts/prop-camera.webp"), W * 0.115, 17, 15);
    const cakeIm = await load("assets/arts/prop-cake-new.webp");
    drawBottom(cakeIm, W * 0.5, 19, 27);
    // 蛋糕素材本身没有火苗，这里补一支（形状照着主页那支来）
    if (cakeIm) {
      const cwC = W * 0.27;
      const chC = cakeIm.height * cwC / cakeIm.width;
      const fcx = W * 0.5 + cwC * 0.004;
      const fBottom = (SH - SH * 0.19 - chC) + chC * 0.055;
      const fH = chC * 0.075;
      const fTop = fBottom - fH;
      // 暖光晕
      const gl = g.createRadialGradient(fcx, fBottom - fH * 0.45, 0, fcx, fBottom - fH * 0.45, fH * 1.7);
      gl.addColorStop(0, "rgba(255,196,92,0.30)");
      gl.addColorStop(1, "rgba(255,196,92,0)");
      g.fillStyle = gl;
      g.beginPath(); g.arc(fcx, fBottom - fH * 0.45, fH * 1.7, 0, Math.PI * 2); g.fill();
      // 外焰
      g.beginPath();
      g.moveTo(fcx, fTop);
      g.bezierCurveTo(fcx + fH * 0.20, fTop + fH * 0.40, fcx + fH * 0.17, fTop + fH * 0.86, fcx, fBottom);
      g.bezierCurveTo(fcx - fH * 0.17, fTop + fH * 0.86, fcx - fH * 0.20, fTop + fH * 0.40, fcx, fTop);
      g.closePath();
      g.fillStyle = "#FFB347"; g.fill();
      // 内焰
      g.beginPath();
      g.moveTo(fcx, fTop + fH * 0.32);
      g.bezierCurveTo(fcx + fH * 0.09, fTop + fH * 0.56, fcx + fH * 0.075, fTop + fH * 0.88, fcx, fBottom - fH * 0.06);
      g.bezierCurveTo(fcx - fH * 0.075, fTop + fH * 0.88, fcx - fH * 0.09, fTop + fH * 0.56, fcx, fTop + fH * 0.32);
      g.closePath();
      g.fillStyle = "#FFF0C9"; g.fill();
    }
    drawBottom(await load("assets/arts/cat-31.webp"), W * 0.22, 5.5, 16);
    drawBottom(await load("assets/arts/prop-yarn.webp"), W * 0.36, 4, 12);
    drawBottom(await load("assets/arts/prop-envelope.webp"), W * 0.82, 21, 13);
    drawBottom(await load("assets/arts/prop-book.webp"), W * 0.76, 6.5, 24);

    // 笔
    const pencil = await load("assets/arts/prop-pencil.webp");
    if (pencil) {
      const pw2 = W * 0.10;
      const ph2 = pencil.height * pw2 / pencil.width;
      g.save();
      g.translate(W * 0.855, SH - SH * 0.065 - ph2 * 0.55);
      g.rotate(0.28);
      g.drawImage(pencil, -pw2 / 2, -ph2 / 2, pw2, ph2);
      g.restore();
    }

    g.restore();

    /* ---------------- plog 外页：把整幅场景当成"今天的照片"贴到奶油纸页上 -------------- */
    const FF = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
    const PX = 66;                     // 左右纸边
    const PT = 132;                    // 顶部纸边
    const PB = 300;                    // 底部写字区
    const PW = W + PX * 2;
    const PH = H + PT + PB;
    const out = document.createElement("canvas");
    out.width = PW; out.height = PH;
    const o = out.getContext("2d");

    // 圆角矩形路径（不用 roundRect，老机型也稳）
    const rr = (c, x, y, w, h, r) => {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    };
    // 手绘十字小星
    const crossStar = (c, x, y, r, col) => {
      c.save();
      c.strokeStyle = col;
      c.lineWidth = Math.max(1.6, r * 0.34);
      c.beginPath();
      c.moveTo(x - r, y); c.lineTo(x + r, y);
      c.moveTo(x, y - r); c.lineTo(x, y + r);
      c.stroke();
      c.restore();
    };
    // 手绘波浪线
    const handWave = (c, x, y, w, amp, waves, col, lw) => {
      c.save();
      c.strokeStyle = col; c.lineWidth = lw;
      c.beginPath();
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const xx = x + w * t;
        const yy = y + Math.sin(t * Math.PI * waves) * amp;
        if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.stroke();
      c.restore();
    };
    // 和纸胶带
    const tape = (c, x, y, w, h, ang, col) => {
      c.save();
      c.translate(x, y); c.rotate(ang);
      c.fillStyle = col;
      rr(c, -w / 2, -h / 2, w, h, 2); c.fill();
      c.fillStyle = "rgba(255,255,255,.40)";
      c.fillRect(-w / 2, -h / 2, w * 0.34, h);
      c.restore();
    };
    /* ---- 手绘感装饰工具（seeded 随机，同一版式每次画出来一致） ---- */
    let hseed = 20261117;
    const hrnd = () => { hseed = (hseed * 16807) % 2147483647; return (hseed - 1) / 2147483646; };
    // 抖动直线：像铅笔一笔画出来、带轻微歪斜
    const handLine = (c, x1, y1, x2, y2, col, lw, jit) => {
      c.save();
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.lineJoin = "round";
      const n = 9;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const xx = x1 + (x2 - x1) * t + (hrnd() - .5) * jit * 2;
        const yy = y1 + (y2 - y1) * t + (hrnd() - .5) * jit * 2;
        if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.stroke();
      c.restore();
    };
    // 手绘相框：四个角略微出头、抖动、双遍描线
    const handFrame = (c, x, y, w, h, col, lw) => {
      const ox = 7; // 角落出头量
      for (let pass = 0; pass < 2; pass++) {
        const j = pass ? 1.6 : 2.6;
        handLine(c, x - ox, y, x + w + ox, y, col, lw, j);
        handLine(c, x + w, y - ox, x + w, y + h + ox, col, lw, j);
        handLine(c, x + w + ox, y + h, x - ox, y + h, col, lw, j);
        handLine(c, x, y + h + ox, x, y - ox, col, lw, j);
      }
    };
    // 手绘爱心：两段圆弧 + 尖底
    const handHeart = (c, x, y, r, col, lw) => {
      c.save();
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round";
      c.beginPath();
      c.moveTo(x, y + r * 0.9);
      c.bezierCurveTo(x - r * 1.25, y - r * 0.15, x - r * 0.55, y - r * 1.1, x, y - r * 0.3);
      c.bezierCurveTo(x + r * 0.55, y - r * 1.1, x + r * 1.25, y - r * 0.15, x, y + r * 0.9);
      c.stroke();
      c.restore();
    };
    // 手绘歪五角星：折线 + 抖动
    const handStar = (c, cx, cy, r, col, lw) => {
      c.save();
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.lineJoin = "round";
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + i * (Math.PI * 4 / 5);
        const rr2 = r * (0.92 + hrnd() * 0.16);
        pts.push([cx + Math.cos(ang) * rr2, cy + Math.sin(ang) * rr2]);
      }
      c.beginPath();
      pts.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
      c.stroke();
      c.restore();
    };
    // 猫爪印：掌垫 + 四趾，可旋转
    const pawPrint = (c, x, y, s, ang, col) => {
      c.save();
      c.translate(x, y); c.rotate(ang);
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(0, s * 0.42, s * 0.52, s * 0.4, 0, 0, Math.PI * 2); c.fill();
      [[-0.46, -0.28, 0.17], [-0.16, -0.46, 0.19], [0.16, -0.46, 0.19], [0.46, -0.28, 0.17]].forEach((t) => {
        c.beginPath();
        c.ellipse(t[0] * s, t[1] * s, t[2] * s, t[2] * s * 1.18, 0, 0, Math.PI * 2); c.fill();
      });
      c.restore();
    };
    // 邮戳：手绘双圈椭圆，微歪
    const postmark = (c, cx, cy, rx, ry, col) => {
      for (let pass = 0; pass < 2; pass++) {
        c.save();
        c.translate(cx, cy); c.rotate(pass ? 0.035 : -0.02);
        c.strokeStyle = col; c.lineWidth = pass ? 1.6 : 2.4; c.lineCap = "round";
        c.beginPath();
        const seg = 26;
        for (let i = 0; i <= seg; i++) {
          const t = i / seg, a = t * Math.PI * 2;
          const ex = Math.cos(a) * rx + (hrnd() - .5) * 4;
          const ey = Math.sin(a) * ry + (hrnd() - .5) * 4;
          if (i) c.lineTo(ex, ey); else c.moveTo(ex, ey);
        }
        c.stroke();
        c.restore();
      }
    };
    // 蜡笔荧光：粗圆头、微波浪、半透明，垫在字底下
    const crayonHi = (c, x, y, w, col) => {
      c.save();
      c.strokeStyle = col; c.lineWidth = 40; c.lineCap = "round"; c.globalAlpha = 1;
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const xx = x + w * t;
        const yy = y + Math.sin(t * Math.PI * 3) * 3.5 + (hrnd() - .5) * 3;
        if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.stroke();
      c.restore();
    };
    // 手绘小箭头：主杆抖动 + 两笔箭头
    const handArrow = (c, x1, y1, x2, y2, col, lw) => {
      handLine(c, x1, y1, x2, y2, col, lw, 1.6);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const ah = 14;
      handLine(c, x2 - Math.cos(ang - 0.5) * ah, y2 - Math.sin(ang - 0.5) * ah, x2, y2, col, lw, 1);
      handLine(c, x2 - Math.cos(ang + 0.5) * ah, y2 - Math.sin(ang + 0.5) * ah, x2, y2, col, lw, 1);
    };

    // 纸底
    o.fillStyle = "#FBF3E6";
    o.fillRect(0, 0, PW, PH);

    // 纸纹：很淡的横线，像手账纸
    o.save();
    o.strokeStyle = "rgba(176,140,102,.065)";
    o.lineWidth = 1;
    for (let yl = 0; yl < PH; yl += 34) {
      o.beginPath(); o.moveTo(0, yl); o.lineTo(PW, yl); o.stroke();
    }
    o.restore();

    // 顶部柔光
    const glow = o.createRadialGradient(PW * 0.26, -PH * 0.03, 0, PW * 0.26, -PH * 0.03, PW * 1.05);
    glow.addColorStop(0, "rgba(255,255,255,.58)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    o.fillStyle = glow; o.fillRect(0, 0, PW, PH);

    // 场景照片：投影 → 圆角 → 微歪（贴上去的手账感）
    const ROT = -1.1 * Math.PI / 180;
    const ccx = PX + W / 2, ccy = PT + H / 2;
    o.save();
    o.translate(ccx, ccy);
    o.rotate(ROT);
    o.shadowColor = "rgba(74,50,34,.30)";
    o.shadowBlur = 44; o.shadowOffsetY = 18;
    o.fillStyle = "#241A15";
    rr(o, -W / 2, -H / 2, W, H, 18); o.fill();
    o.restore();

    o.save();
    o.translate(ccx, ccy);
    o.rotate(ROT);
    rr(o, -W / 2, -H / 2, W, H, 18);
    o.save();
    o.clip();
    o.drawImage(cv, -W / 2, -H / 2);
    o.restore();
    o.strokeStyle = "rgba(255,251,242,.5)";
    o.lineWidth = 3;
    rr(o, -W / 2 + 1.5, -H / 2 + 1.5, W - 3, H - 3, 17);
    o.stroke();
    o.restore();

    // 手绘相框：贴着照片外圈再画一圈铅笔线，角上出头
    o.save();
    o.translate(ccx, ccy);
    o.rotate(ROT);
    handFrame(o, -W / 2 - 12, -H / 2 - 12, W + 24, H + 24, "rgba(122,97,81,.55)", 2.4);
    o.restore();

    // 两角胶带
    tape(o, PX + 46, PT + 46, 118, 44, -0.42, "rgba(246,199,74,.46)");
    tape(o, PX + W - 50, PT + H - 50, 122, 46, -0.36, "rgba(233,142,110,.38)");
    // 胶带上补两道撕边斜线，更像手撕的
    handLine(o, PX + 8, PT + 34, PX + 92, PT + 60, "rgba(255,255,255,.55)", 2, 2);
    handLine(o, PX + W - 96, PT + H - 64, PX + W - 12, PT + H - 38, "rgba(255,255,255,.55)", 2, 2);

    /* 顶部纸边：今天 + 日期 */
    o.textAlign = "left";
    o.textBaseline = "alphabetic";
    // 蜡笔荧光垫在「今天」底下
    crayonHi(o, PX + 2, 76, 128, "rgba(246,199,74,.30)");
    o.fillStyle = "#4B3325";
    o.font = '46px "CC Title", ' + FF;
    o.fillText("今天", PX + 4, 90);

    handWave(o, PX + 4, 106, 118, 3.2, 4, "rgba(233,142,110,.60)", 2.6);

    crossStar(o, PX + 116, 56, 9, "rgba(246,199,74,.95)");
    crossStar(o, PX + 148, 94, 6, "rgba(233,142,110,.52)");
    // 星星旁边补一颗手绘歪五角星，破掉十字星的工整感
    handStar(o, PX + 180, 62, 13, "rgba(246,199,74,.80)", 2.4);

    // 「今天」指向照片的手绘箭头
    handArrow(o, PX + 60, 112, PX + 118, PT + 34, "rgba(122,97,81,.45)", 2.2);

    o.textAlign = "right";
    o.fillStyle = "rgba(75,51,37,.60)";
    o.font = '30px "CC Hand", ' + FF;
    o.fillText("11 / 17", PW - PX, 90);

    /* 底部纸边：祝福 + 日期 + 涂鸦 */
    const baseY = PT + H;

    o.textAlign = "center";
    o.fillStyle = "#4B3325";
    o.font = '62px "CC Title", ' + FF;
    o.fillText("成灿，21 岁生日快乐。", PW / 2, baseY + 92);

    handWave(o, PW / 2 - 152, baseY + 116, 304, 4, 5, "rgba(233,142,110,.70)", 3.2);
    handWave(o, PW / 2 - 104, baseY + 130, 208, 2.8, 4, "rgba(233,142,110,.32)", 2.2);
    // 标题两侧的手绘歪星 + 爱心外移，别压到字
    handStar(o, PW / 2 - 356, baseY + 74, 16, "rgba(246,199,74,.85)", 2.6);
    handStar(o, PW / 2 + 356, baseY + 74, 14, "rgba(246,199,74,.85)", 2.6);
    handHeart(o, PW / 2 - 340, baseY + 78, 13, "rgba(233,142,110,.60)", 2.4);
    handHeart(o, PW / 2 + 340, baseY + 78, 13, "rgba(233,142,110,.60)", 2.4);

    o.fillStyle = "rgba(75,51,37,.55)";
    o.font = '30px "CC Hand", ' + FF;
    o.fillText("2026.11.17", PW / 2, baseY + 184);

    o.fillStyle = "rgba(75,51,37,.34)";
    o.font = '26px "CC Hand", ' + FF;
    o.fillText("今天的小房间，存一张", PW / 2, baseY + 236);

    // 右下：猫爪印一串（朝左上走），替代原来的单圈手绘圈
    pawPrint(o, PW - PX - 34, baseY + 196, 15, 0.5, "rgba(233,142,110,.34)");
    pawPrint(o, PW - PX - 70, baseY + 222, 13, 0.4, "rgba(233,142,110,.26)");
    pawPrint(o, PW - PX - 102, baseY + 244, 11, 0.3, "rgba(233,142,110,.18)");
    // 右下角保留一颗手绘歪星
    handStar(o, PW - PX - 22, baseY + 172, 11, "rgba(246,199,74,.80)", 2.2);

    // 左下：三个小圆点 + 一颗爱心收尾
    o.fillStyle = "rgba(233,142,110,.40)";
    [[PX + 18, baseY + 232, 4], [PX + 34, baseY + 226, 3], [PX + 48, baseY + 232, 2.6]].forEach((pt) => {
      o.beginPath(); o.arc(pt[0], pt[1], pt[2], 0, Math.PI * 2); o.fill();
    });
    handHeart(o, PX + 76, baseY + 228, 10, "rgba(233,142,110,.42)", 2);

    recordUrl = out.toDataURL("image/jpeg", 0.9);
    return recordUrl;
  }

  function openRecord(url) {
    $("#recordImg").src = url;
    const box = $("#record");
    box.hidden = false;
    document.getElementById("phone").classList.add("viewing");
    requestAnimationFrame(() => box.classList.add("on"));
  }
  function closeRecord() {
    const box = $("#record");
    if (!box || box.hidden) return;
    box.classList.remove("on");
    document.getElementById("phone").classList.remove("viewing");
    setTimeout(() => { box.hidden = true; }, 280);
  }
  $("#record").addEventListener("click", (e) => {
    if (e.target.id === "record" && canCloseBackdrop(e.target)) closeRecord();
  });

  function openCatName() {
    const box = $("#catname");
    const inp = $("#catNameInput");
    inp.value = data.catName || "";
    box.hidden = false;
    box._openedAt = Date.now();
    requestAnimationFrame(() => box.classList.add("on"));
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 320);
  }
  function closeCatName() {
    const box = $("#catname");
    box.classList.remove("on");
    setTimeout(() => { box.hidden = true; }, 280);
  }
  $("#catNameSave").addEventListener("click", (e) => {
    e.stopPropagation();
    const v = $("#catNameInput").value.trim();
    if (!v) { $("#catNameInput").focus(); return; }
    data.catName = v;
    save();
    closeCatName();
    Sound.paper();
    setTimeout(() => Sound.chime(), 160);
    toast("「" + v + "」记住了。", 2400);
  });
  $("#catNameSkip").addEventListener("click", (e) => {
    e.stopPropagation();
    closeCatName();
    Sound.paper();
  });
  $("#catname").addEventListener("click", (e) => {
    // pointerdown 开层后，同一次点击的 click 会落在刚出现的遮罩上，开层瞬间不能关
    if (e.target.id === "catname" && Date.now() - (e.currentTarget._openedAt || 0) > 400) closeCatName();
  });

  /* ---- 照片背面 + 弧形旋转按钮：动态挂载，不写进 index.html（不动源码结构） ---- */
  (function initViewerFlip() {
    const box = $("#viewer");
    if (!box || box.querySelector(".v-flip-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "v-flip-btn";
    btn.setAttribute("aria-label", "翻到照片背面");
    // 手绘贴纸星星：圆胖五角、五个角长短不一、整体微歪，暖黄渐变 + 左上柔光 + 细橙描边
    var starD = "M14.15 25.36Q14.52 26.66 15.16 25.47L17.76 20.60Q18.26 19.67 19.30 19.53L24.05 18.89Q25.39 18.71 24.47 17.73L21.26 14.33Q20.54 13.56 20.60 12.52L20.92 7.32Q21.00 5.97 19.92 6.78L15.90 9.79Q15.06 10.42 14.11 9.97L9.90 7.96Q8.69 7.38 9.00 8.69L10.09 13.33Q10.33 14.35 9.67 15.17L6.56 19.01Q5.71 20.06 7.06 20.00L11.47 19.81Q12.52 19.76 12.81 20.77L14.15 25.36Z";
    btn.innerHTML = '<svg viewBox="5.1 5.35 20.9 21.9" width="34" height="34" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="vsLin" x1="18%" y1="5%" x2="72%" y2="100%">' +
      '<stop offset="0" stop-color="#FFF0BF"/><stop offset="0.4" stop-color="#FFD868"/><stop offset="1" stop-color="#FFBE38"/>' +
      '</linearGradient>' +
      '<radialGradient id="vsRad" cx="33%" cy="26%" r="45%">' +
      '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.6"/>' +
      '<stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.2"/>' +
      '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<path d="' + starD + '" fill="url(#vsLin)" stroke="#F2A83C" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="' + starD + '" fill="url(#vsRad)" stroke="none"/>' +
      '</svg>';
    box.appendChild(btn);

    const back = document.createElement("div");
    back.className = "v-back";
    back.innerHTML = '<p class="v-back-note"></p>';
    box.appendChild(back);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      box.classList.toggle("show-back");
      Sound.paper();
    });
    back.addEventListener("click", (e) => {
      e.stopPropagation();
      box.classList.remove("show-back");
      Sound.paper();
    });
    window.addEventListener("resize", placeFlipBtn);
  })();

  /* 把按钮钉在照片右上角、把背面纸对齐照片本身（照片尺寸随图片变化，只能运行时量） */
  function placeFlipBtn() {
    const img = $("#viewerImg"), btn = $("#viewer .v-flip-btn"), back = $("#viewer .v-back"), box = $("#viewer");
    if (!img || !btn || !box) return;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // 全部换算成 #viewer 内部的坐标（#phone 没有 transform，屏幕坐标可直接减）
    const vr = box.getBoundingClientRect();
    let x = r.left - vr.left, y = r.top - vr.top, w = r.width, h = r.height;
    // 先扣除图片内边距，得到真正的内容盒（contain 是在内容盒里留边的）
    const ics = getComputedStyle(img);
    const ipl = parseFloat(ics.paddingLeft) || 0, ipt = parseFloat(ics.paddingTop) || 0;
    const ipr = parseFloat(ics.paddingRight) || 0, ipb = parseFloat(ics.paddingBottom) || 0;
    x += ipl; y += ipt; w -= ipl + ipr; h -= ipt + ipb;
    // object-fit: contain 会在框里留边，把留边去掉，让背面正好是"照片本身"那么大
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (nw && nh) {
      const s = Math.min(w / nw, h / nh), cw = nw * s, ch = nh * s;
      if (cw > 0 && ch > 0) { x += (w - cw) / 2; y += (h - ch) / 2; w = cw; h = ch; }
    }
    // 星星中心对齐相纸右上角：压入一半、探出一半（34px 各 17px）
    btn.style.left = Math.round(x + w - 17) + "px";
    btn.style.top = Math.round(y - 17) + "px";
    btn.style.right = "auto";
    btn.style.bottom = "auto";
    // 背面直接盖在照片原来的位置上：同 left/top，同宽高，不再自己居中
    if (back) {
      back.style.left = Math.round(x) + "px";
      back.style.top = Math.round(y) + "px";
      back.style.width = Math.round(w) + "px";
      back.style.height = Math.round(h) + "px";
      back.style.setProperty("--vb-dx", "0px");
      back.style.setProperty("--vb-dy", "0px");
    }
  }

  function openViewer(key, cell) {
    const it = albumList().find((x) => x.key === key);
    if (!it) return;
    viewerKey = key;
    viewerCell = cell || null;
    $("#viewerImg").src = it.src;
    const note = (data.albumNotes && data.albumNotes[key]) || "";
    $("#viewerNote").textContent = note || it.line;
    const backNote = $("#viewer .v-back-note");
    if (backNote) backNote.textContent = note || it.line;
    const box = $("#viewer");
    box.classList.remove("show-back");
    box.hidden = false;
    document.getElementById("phone").classList.add("viewing");
    requestAnimationFrame(() => box.classList.add("on"));
    const vImg = $("#viewerImg");
    if (vImg && !vImg.complete) vImg.addEventListener("load", placeFlipBtn, { once: true });
    setTimeout(placeFlipBtn, 30);
  }
  function closeViewer() {
    const box = $("#viewer");
    if (!box || box.hidden) return;
    box.classList.remove("on");
    box.classList.remove("show-back");
    document.getElementById("phone").classList.remove("viewing");
    setTimeout(() => { box.hidden = true; }, 280);
  }
  $("#viewerEdit").addEventListener("click", (e) => {
    e.stopPropagation();
    const k = viewerKey, c = viewerCell;
    closeViewer();
    Sound.paper();
    setTimeout(() => openPhotoEdit(k, c), 140);
  });
  $("#viewer").addEventListener("click", (e) => {
    if (e.target.id === "viewer" && canCloseBackdrop(e.target)) closeViewer();
  });

  function openPhotoEdit(key, el) {
    const it = albumList().find((x) => x.key === key);
    if (!it) return;
    const box = $("#photoedit");
    const ta = $("#peTa");
    const btn = $("#peSave");
    $("#peImg").src = it.src;
    ta.value = (data.albumNotes && data.albumNotes[key]) || "";
    const sync = () => btn.classList.toggle("dim", !ta.value.trim());
    sync();
    ta.oninput = sync;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add("on"));
    btn.onclick = (e) => {
      e.stopPropagation();
      const v = ta.value.trim();
      data.albumNotes = data.albumNotes || {};
      if (v) data.albumNotes[key] = v; else delete data.albumNotes[key];
      save();
      box.classList.remove("on");
      setTimeout(() => { box.hidden = true; }, 280);
      if (el) {
        const cap = el.querySelector(".wp-cap");
        if (cap) cap.textContent = v;
        const back = el.querySelector(".wp-back p");
        if (back) back.textContent = v || it.line;
        el.classList.toggle("has-note", !!v);
        el.classList.remove("flipped");
      }
      buildRope();
      Sound.paper();
    };
  }

  /* ---------------- 各层内容 ---------------- */
  const LAYERS = {
    cake: {
      build() {
        return `
          <p class="tip" id="cakeTip">许个愿，吹灭它</p>
          <img class="act-ch" src="assets/arts/ch-11.webp" alt="">
          <div class="big big-cake">
            <div class="cake-wrap">
              <img src="assets/arts/prop-cake-new.webp" alt="生日蛋糕">
              <svg class="cake-flame" id="cakeFlame" viewBox="0 0 40 74" aria-hidden="true">
                <path d="M20 2c11 17 13 30 0 40c-13-10-11-23 0-40z" fill="#FFB347"/>
                <path d="M20 16c5.5 9 5.5 16 0 21c-5.5-5-5.5-12 0-21z" fill="#FFF0C9"/>
              </svg>
            </div>
          </div>
          <p class="sub" id="cakeSub">点一下蜡烛，就能吹灭</p>
          <button class="mini" id="cakeWish" hidden>看看愿望</button>
          <button class="mini" id="cakeRecord" hidden>存一张今天的记录</button>`;
      },
      init() {
        const wrap = $(".cake-wrap", layerBody);
        const flame = $("#cakeFlame", layerBody);
        const tip = $("#cakeTip", layerBody);
        const sub = $("#cakeSub", layerBody);
        const wishBtn = $("#cakeWish", layerBody);
        let done = false;

        const out = () => {
          if (done) return;
          done = true;
          flame.style.opacity = "0";
          flame.style.transform = "translateX(-50%) scale(.2)";
          const r = wrap.getBoundingClientRect();
          const lr = layerBody.getBoundingClientRect();
          smoke(layerBody, r.left - lr.left + r.width / 2, r.top - lr.top + r.height * 0.12);
          Sound.blow();
          if (homeFlame) homeFlame.classList.remove("on");
          tip.textContent = "愿望已收好";
          sub.textContent = "愿你所愿皆所成。";
          wishBtn.hidden = false;
          const recBtn = $("#cakeRecord", layerBody);
          if (recBtn) recBtn.hidden = false;
          data.candle = true; save();
        };

        wrap.addEventListener("pointerdown", (e) => { e.stopPropagation(); out(); });
        wishBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); openWishSheet(); });
        const recBtn2 = $("#cakeRecord", layerBody);
        if (recBtn2) {
          recBtn2.addEventListener("click", async (e) => {
            e.stopPropagation();
            toast("正在生成…", 1200);
            const url = await buildRecord();
            close();
            setTimeout(() => openRecord(url), 320);
          });
        }

        if (!data.stage || data.stage <= 1) {
          data.stage = 2;
          save();
          cakeGreeted = true;
          setTimeout(() => {
            toast("你可以许个愿望了。", 4200);
            try { Sound.birthdayBox(); } catch (e) {}
          }, 320);
          setTimeout(() => openWishSheet(false, "现在可以闭上眼睛，许个愿了。"), 3000);
        }
        if (data.candle) {
          flame.style.opacity = "0";
          tip.textContent = "愿望已收好";
          sub.textContent = "愿你所愿皆所成。";
          wishBtn.hidden = false;
          done = true;
        }
      }
    },

    wood: {
      build() {
        return `
          <p class="tip">敲一下</p>
          <div class="big big-wood">
            <img src="assets/arts/ch-12.webp" alt="敲木鱼">
          </div>
          <p class="merit">功德 <b id="meritNum">${data.merit}</b></p>
          <p class="sub">点她，或者点木鱼</p>`;
      },
      init() {
        const big = $(".big-wood", layerBody);
        const num = $("#meritNum", layerBody);
        const hit = (e) => {
          e.stopPropagation();
          data.merit += 1; save();
          if (num) num.textContent = data.merit;
          Sound.wood(); buzz(9);
          const r = layerBody.getBoundingClientRect();
          ripple(layerBody, e.clientX - r.left, e.clientY - r.top);
          floatText(layerBody, e.clientX - r.left, e.clientY - r.top, "+1");
          const m = MILE[data.merit];
          if (m) { bubble(layerBody, m, 2800); setTimeout(() => Sound.chime(), 220); }
          big.classList.remove("knock"); void big.offsetWidth; big.classList.add("knock");
        };
        big.addEventListener("pointerdown", hit);
        const mallet = $(".mallet", layerBody);
        if (mallet) mallet.addEventListener("pointerdown", hit);
      }
    },

    sign: {
      build() {
        return `
          <p class="tip">摇一摇，抽一根签</p>
          <div class="big big-sign"><img src="assets/arts/ch-13.webp" alt="摇签筒"></div>
          <button class="mini" id="drawSign">抽一根</button>
          <p class="sub">是盲盒签筒</p>`;
      },
      init() {
        const big = $(".big-sign", layerBody);
        const draw = () => {
          big.classList.remove("shake"); void big.offsetWidth; big.classList.add("shake");
          Sound.sign();
          const text = SIGNS[Math.floor(Math.random() * SIGNS.length)];
          const card = document.createElement("div");
          card.className = "sign-card";
          const roll = Math.random();
          const tier = roll < 0.4 ? "上上签" : roll < 0.75 ? "上签" : "中签";
          card.innerHTML = text + '<small>— ' + tier + ' —</small>';
          layerBody.appendChild(card);
          requestAnimationFrame(() => card.classList.add("on"));
          setTimeout(() => { card.classList.remove("on"); setTimeout(() => card.remove(), 400); }, 3600);
        };
        $("#drawSign", layerBody).addEventListener("click", (e) => { e.stopPropagation(); draw(); });
        big.addEventListener("pointerdown", (e) => { e.stopPropagation(); draw(); });
      }
    },

    read: {
      build() {
        return `
          <div class="card">
            <img class="card-jar" src="assets/arts/prop-jar.webp" alt="">
            <h3>本子里抄着</h3>
            <span class="sec-label">愿望</span>
            <ul class="list wishes" id="wishList"></ul>
            <span class="sec-label">随笔</span>
            <ul class="list notes" id="noteList"></ul>
          </div>
          <div class="note-actions">
            <button class="mini" id="toWrite">写点什么</button>
            <button class="mini" id="makeCard">存一张卡片</button>
          </div>`;
      },
      init() {
        drawLists(layerBody);
        $("#toWrite", layerBody).addEventListener("click", (e) => {
          e.stopPropagation();
          close();
          setTimeout(() => openLayer("write"), 280);
        });
        $("#makeCard", layerBody).addEventListener("click", async (e) => {
          e.stopPropagation();
          const url = await buildCard();
          $("#cardimg").src = url;
          const cv = $("#cardview");
          cv.hidden = false;
          requestAnimationFrame(() => cv.classList.add("on"));
        });
      }
    },

    write: {
      build() {
        return `
          <div class="card">
            <h3>写点什么</h3>
            <div class="tabs">
              <button class="tab on" data-t="wish">愿望</button>
              <button class="tab" data-t="note">随笔</button>
            </div>
            <textarea class="ta" id="writeTa" placeholder="写一句愿望…"></textarea>
            <div class="card-foot"><button class="mini" id="saveText">收下愿望</button></div>
          </div>`;
      },
      init() {
        let kind = "wish";
        const ta = $("#writeTa", layerBody);
        const btn = $("#saveText", layerBody);
        $$(".tab", layerBody).forEach((tab) => {
          tab.addEventListener("click", (e) => {
            e.stopPropagation();
            $$(".tab", layerBody).forEach((x) => x.classList.remove("on"));
            tab.classList.add("on");
            kind = tab.dataset.t;
            if (kind === "wish") { ta.placeholder = "写一句愿望…"; btn.textContent = "收下愿望"; }
            else { ta.placeholder = "写点什么…"; btn.textContent = "收进本子"; }
            ta.focus();
          });
        });
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const v = ta.value.trim();
          if (!v) { toast("先写点什么吧。", 1800); return; }
          if (kind === "wish") { data.wishes.push({ t: Date.now(), text: v }); }
          else { data.notes.push({ t: Date.now(), text: v }); }
          save();
          ta.value = "";
          Sound.paper();
          toast(kind === "wish" ? "愿望收好了。" : "已经收进本子里了。", 1800);
          setTimeout(() => { close(); setTimeout(() => openLayer("read"), 280); }, 700);
        });
        setTimeout(() => ta.focus(), 320);
      }
    },
    album: {
      build() {
        const all = albumList();
        const notes = data.albumNotes || {};
        const cells = all.map((it) => {
          const note = notes[it.key] || "";
          return `
          <div class="wall-cell">
            <button class="del" data-del="${it.key}" aria-label="删掉">×</button>
            <div class="wall-photo${note ? " has-note" : ""}" data-key="${it.key}">
              <div class="wp-inner">
                <div class="wp-face"><img src="${it.src}" alt=""></div>
                <div class="wp-face wp-back"><p>${note || it.line}</p></div>
              </div>
              <div class="wp-cap">${note}</div>
            </div>
          </div>`;
        }).join("");
        return `
          <p class="tip">照片墙</p>
          <div class="wall-bar">
            <button class="mini" id="addPhoto">＋ 放一张</button>
            <button class="mini ghost" id="editToggle">管理</button>
          </div>
          <div class="wall-grid">${cells}</div>
          <input type="file" id="fileInput" accept="image/*" hidden>`;
      },
      init() {
        const body = layerBody;
        let editing = false;
        const toggle = $("#editToggle", body);
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          editing = !editing;
          body.classList.toggle("editing", editing);
          toggle.textContent = editing ? "完成" : "管理";
        });

        $$(".wall-photo", body).forEach((el) => {
          el.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            const key = el.dataset.key;
            const x0 = e.clientX, y0 = e.clientY;
            let fired = false;
            const up = (ev) => {
              document.removeEventListener("pointerup", up);
              document.removeEventListener("pointercancel", up);
              if (fired) return;
              fired = true;
              if (Math.abs(ev.clientX - x0) > 12 || Math.abs(ev.clientY - y0) > 12) return;
              const go = () => {
                if (editing) { openPhotoEdit(key, el); return; }
                Sound.paper();
                openViewer(key, el);
              };
              setTimeout(go, 0);
            };
            document.addEventListener("pointerup", up);
            document.addEventListener("pointercancel", up);
          });
        });

        $$(".del", body).forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const key = btn.dataset.del;
            if (key.charAt(0) === "u") {
              data.photos = (data.photos || []).filter((x) => x.id !== key);
            } else {
              data.hidden = (data.hidden || []).concat([key]);
            }
            if (data.albumNotes) delete data.albumNotes[key];
            save();
            body.innerHTML = LAYERS.album.build();
            LAYERS.album.init();
            buildRope();
            Sound.paper();
            toast("删掉了。", 1500);
          });
        });

        const file = $("#fileInput", body);
        $("#addPhoto", body).addEventListener("click", (e) => { e.stopPropagation(); file.click(); });
        file.addEventListener("change", (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const img = new Image();
          img.onload = () => {
            const W = 620, H = 740, pad = 40, side = 540;
            const cv = document.createElement("canvas");
            cv.width = W; cv.height = H;
            const g = cv.getContext("2d");
            g.fillStyle = "#FFFDF7"; g.fillRect(0, 0, W, H);
            const sc = Math.max(side / img.width, side / img.height);
            const sw = side / sc, sh = side / sc;
            g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, pad, pad, side, side);
            g.strokeStyle = "#E8DDCE"; g.lineWidth = 1;
            g.strokeRect(pad - 0.5, pad - 0.5, side + 1, side + 1);
            const url = cv.toDataURL("image/jpeg", 0.85);
            const prev = data.photos || [];
            const item = { id: "u" + Date.now().toString(36), src: url };
            data.photos = prev.concat([item]);
            try {
              localStorage.setItem(KEY, JSON.stringify(data));
            } catch (err) {
              data.photos = prev;
              toast("手机空间不够了，这张先不放了。", 2600);
              return;
            }
            body.innerHTML = LAYERS.album.build();
            LAYERS.album.init();
            buildRope();
            Sound.paper();
            toast("放上去了，点它可以写一句。", 2200);
          };
          img.onerror = () => toast("这张图读不出来。", 2000);
          img.src = URL.createObjectURL(f);
        });
      }
    }
  };

  function openLayer(name) {
    if (close._t) { clearTimeout(close._t); close._t = null; }
    const def = LAYERS[name];
    if (!def || current) return;
    current = name;
    layerBody.innerHTML = def.build();
    layerBody.dataset.layer = name;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add("on"));
    if (def.init) def.init();
    const hint = $("#homeHint");
    if (hint) hint.style.opacity = "0";
  }

  function close() {
    // 关层时顺手把可能压在上面的备注层也收掉，避免「被卡住」
    const pe = document.getElementById("photoedit");
    if (pe && !pe.hidden) { pe.classList.remove("on"); pe.hidden = true; }
    if (!current) return;
    current = null;
    flushPendingTip();
    layer.classList.remove("on");
    if (close._t) clearTimeout(close._t);
    close._t = setTimeout(() => {
      if (current) return;            // 期间又打开了别的层，就别清内容
      layer.hidden = true;
      layerBody.innerHTML = "";
      delete layerBody.dataset.layer;
    }, 280);
  }

  layer.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { close(); return; }
    if (e.target === layerBody && canCloseBackdrop(layerBody)) close();   // 点放大层里的空白也能退回
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); closeWelcome(); hideCard(); closeCatName(); }
  });

  /* ---------------- 主页 ---------------- */
  $$("[data-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      Sound.paper();
      openLayer(btn.dataset.open);
    });
  });

  // 窗子彩蛋
  const windowArt = $("#windowArt");
  if (windowArt) {
    windowArt.addEventListener("click", (e) => {
      e.stopPropagation();
      Sound.chime();
      const chHome = document.getElementById("homeCh");
      if (chHome && !chHome._hold) {
        chHome._hold = true; chHome._paused = true;
        chHome.src = "assets/arts/ch-22.webp";
        setTimeout(() => {
          chHome.src = "assets/arts/ch-23.webp";
          chHome._hold = false; chHome._paused = false;
        }, 4600);
      }
      const lines = [
        "晚安。今天到这里就好。",
        "夜深了，晚安。",
        "把今天放下，睡吧，晚安。"
      ];
      toast(lines[Math.floor(Math.random() * lines.length)], 4200);
    });
  }

  // 桌上的小彩蛋
  // 纸飞机 = 全局返回键
  const planeBtn = document.getElementById("planeBtn");
  if (planeBtn) {
    planeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!layer.hidden) { close(); return; }
      const v = document.getElementById("viewer");
      if (v && !v.hidden) { closeViewer(); return; }
      const pe = document.getElementById("photoedit");
      if (pe && !pe.hidden) {
        pe.classList.remove("on");
        setTimeout(() => { pe.hidden = true; }, 280);
        return;
      }
      const lt = document.getElementById("letter");
      if (lt && !lt.hidden) { closeLetter(); return; }
      const rv = document.getElementById("record");
      if (rv && !rv.hidden) { closeRecord(); return; }
      const cv = document.getElementById("cardview");
      if (cv && !cv.hidden) { hideCard(); return; }
      const w = document.getElementById("welcome");
      if (w && !w.hidden) { closeWelcome(); return; }
      Sound.paper();
      const words = [
        "愿你前程明亮，路越走越宽。",
        "往后的日子，好好生活。",
        "想做的事，慢慢都会做成。",
        "前路很长，一路顺遂。"
      ];
      toast(words[Math.floor(Math.random() * words.length)], 3000);
    });
  }

  const EGGS = {};

  // 星星信封：翻开之前写下的愿望
  function openLetter() {
    const box = $("#letter");
    const list = $("#letterList");
    const ws = (data.wishes || []).filter((w) => w.text && w.text.trim());
    list.innerHTML = ws.length
      ? ws.map((w) => `<li>${w.text}</li>`).join("")
      : "<li class='empty'>这里还空着。去点蛋糕，把愿望写下来吧。</li>";
    $("#letterTitle").textContent = ws.length ? "写给 21 岁的自己" : "信封还是空的";
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add("on"));
    Sound.paper();
    setTimeout(() => Sound.chime(), 160);
  }
  function closeLetter() {
    const box = $("#letter");
    box.classList.remove("on");
    setTimeout(() => { box.hidden = true; }, 280);
  }
  const envelopeEl = document.getElementById("eggEnvelope");
  if (envelopeEl) {
    envelopeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      openLetter();
    });
  }
  Object.keys(EGGS).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      Sound.chime();
      toast(EGGS[id], 2800);
    });
  });

  /* ---------------- 窗台的猫 ---------------- */
  const catBtn = $("#catBtn");
  const cat = $("#catImg");
  const CAT_FACES = ["cat-31", "cat-14", "cat-33", "cat-32", "cat-21", "cat-13"];
  let catIdx = 0, catTimer = null;
  let catTaps = 0, catTapTimer = null;
  catBtn.addEventListener("pointerdown", (e) => {
    if (!data.catName) {
      e.stopPropagation();
      Sound.meow();
      openCatName();
      return;
    }
    e.stopPropagation();
    if (catTimer) return;
    catIdx = (catIdx + 1) % CAT_FACES.length;
    cat.src = "assets/arts/" + CAT_FACES[catIdx] + ".webp";
    const chHome = document.getElementById("homeCh");
    if (chHome && !chHome._hold) {
      chHome._hold = true; chHome._paused = true;
      chHome.src = "assets/arts/ch-21.webp";
      setTimeout(() => {
        chHome.src = "assets/arts/ch-23.webp";
        chHome._hold = false; chHome._paused = false;
      }, 1800);
    }
    // 连着点会不耐烦
    catTaps += 1;
    clearTimeout(catTapTimer);
    catTapTimer = setTimeout(() => { catTaps = 0; }, 2600);
    if (catTaps >= 4) {
      Sound.annoy();
    } else if (catTaps === 3) {
      Sound.whine();
      Sound.purr(true);
    } else {
      // 平时叫声随机换着叫（meow 为主、偶尔哼唧一声）
      if (Math.random() < 0.7) Sound.meow(); else Sound.whine();
      Sound.purr(true);
    }
    if (data.catName && Math.random() < 0.35) toast(data.catName + "蹭了蹭你。", 2000);
    buzz(10);
    catTimer = setTimeout(() => {
      Sound.purr(false);
      cat.src = "assets/arts/cat-31.webp";
      catTimer = null;
    }, 1600);
  });

  /* ---------------- 欢迎 + 许愿 ---------------- */
  const welcome = $("#welcome");
  const wishRows = $("#wish-rows");

  function addRow(value = "") {
    if (wishRows.children.length >= 8) return null;
    const row = document.createElement("label");
    row.className = "wish-row";
    row.innerHTML = '<span class="dot"></span><input maxlength="26" placeholder="写一条…"><span class="del">×</span>';
    row.querySelector("input").value = value;
    row.querySelector(".del").addEventListener("click", (e) => {
      e.preventDefault();
      if (wishRows.children.length > 1) row.remove();
    });
    wishRows.appendChild(row);
    return row;
  }

  function openWishSheet(prefill = true, subtitle) {
    const subEl = document.querySelector(".w-sub");
    if (subEl) subEl.textContent = subtitle || "给 21 岁的你，许一个生日愿望吧。";
    wishRows.innerHTML = "";
    const list = (prefill && data.wishes.length) ? data.wishes.map((w) => w.text) : [""];
    list.forEach((t) => addRow(t));
    welcome.hidden = false;
    requestAnimationFrame(() => welcome.classList.add("on"));
    setTimeout(() => wishRows.querySelector("input")?.focus(), 360);
  }
  function closeWelcome() {
    welcome.classList.remove("on");
    setTimeout(() => { welcome.hidden = true; flushPendingTip(); }, 300);
    data.greeted = 1;
    save();
  }

  function collectWishes() {
    const out = [];
    $$(".wish-row input", wishRows).forEach((inp) => {
      const v = inp.value.trim();
      if (v) out.push({ t: Date.now(), text: v });
    });
    return out;
  }

  $("#w-skip").addEventListener("click", (e) => {
    e.stopPropagation();
    closeWelcome();
    toast("点点桌上的东西", 2200);
  });
  welcome.addEventListener("click", (e) => {
    if (e.target === welcome && canCloseBackdrop(welcome)) { closeWelcome(); toast("点点桌上的东西", 2200); }
  });

  $("#add-wish").addEventListener("click", (e) => {
    e.stopPropagation();
    const r = addRow();
    r?.querySelector("input").focus();
    Sound.paper();
  });

  $("#w-save").addEventListener("click", (e) => {
    e.stopPropagation();
    const list = collectWishes();
    if (list.length) data.wishes = list;
    save();
    closeWelcome();
    data.stage = 3;
    save();
    setTimeout(() => flyToCat(), 220);
    setTimeout(() => toast("生日快乐，祝你所愿皆所成。", 4600), 1400);
    scheduleTip("可以点一下桌面上的物品，在这里玩一玩。", 5200, 2500);
  });

  function flyToCat() {
    const phone = $("#phone");
    const pr = phone.getBoundingClientRect();
    const card = document.createElement("div");
    card.className = "flycard";
    card.textContent = "愿望";
    card.style.left = (pr.width / 2 - 45) + "px";
    card.style.top = (pr.height * 0.46) + "px";
    phone.appendChild(card);

    const cr = card.getBoundingClientRect();
    const tr = cat.getBoundingClientRect();
    const dx = (tr.left + tr.width / 2) - (cr.left + cr.width / 2);
    const dy = (tr.top + tr.height * 0.6) - (cr.top + cr.height / 2);

    requestAnimationFrame(() => {
      card.animate([
        { transform: "translate(0,0) scale(1) rotate(-3deg)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.25 - 40}px) scale(.7) rotate(8deg)`, opacity: 1, offset: .55 },
        { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(16deg)`, opacity: 0 }
      ], { duration: 880, easing: "cubic-bezier(.4,0,.35,1)", fill: "forwards" });
    });
    setTimeout(() => { Sound.meow(); cat.src = "assets/arts/cat-14.webp"; }, 640);
    setTimeout(() => { card.remove(); setTimeout(() => { cat.src = "assets/arts/cat-31.webp"; }, 900); }, 950);
  }

  /* ---------------- 结尾卡 ---------------- */
    function cardWishes() {
    const todayKey = dayKey(Date.now());
    return (data.wishes || [])
      .filter((w) => w.text && w.text.trim() && w.t && dayKey(w.t) === todayKey)
      .map((w) => w.text.trim());
  }

  function wrapText(g, font, text, maxW) {
    g.font = font;
    const out = [];
    let line = "";
    for (const ch of text) {
      if (line && g.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
      else line += ch;
    }
    if (line) out.push(line);
    return out;
  }

  const CARD_TPL = [
    { src: "assets/card/template.jpg", titleY: 508, bodyY: 640, gap: 70, dateY: 1082, maxW: 700 },
    { src: "assets/card/template2.jpg", titleY: 560, bodyY: 700, gap: 70, dateY: 1030, maxW: 620 },
    { src: "assets/card/template3.jpg", titleY: 600, bodyY: 742, gap: 66, dateY: 1032, maxW: 520 }
  ];

  async function buildCard(tpl) {
    try {
      await Promise.all([
        document.fonts.load('64px "CC Title"', '成灿，生日快乐。'),
        document.fonts.load('42px "CC Hand"', '愿你以后翻相册，翻到的都是好日子。')
      ]);
      await document.fonts.ready;
    } catch (e) {}

    const W = 1080, H = 1350;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");

    const idx = typeof tpl === "number" ? tpl : Math.floor(Math.random() * CARD_TPL.length);
    const cfg = CARD_TPL[idx];
    buildCard.lastIndex = idx;
    const paper = await new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = cfg.src;
    });

    if (paper) {
      const sc = Math.max(W / paper.width, H / paper.height);
      const pw = paper.width * sc, ph = paper.height * sc;
      g.drawImage(paper, (W - pw) / 2, (H - ph) / 2, pw, ph);
    } else {
      g.fillStyle = "#FFFBF2";
      g.fillRect(0, 0, W, H);
    }

    const cx = W / 2;

    g.textAlign = "center";
    g.fillStyle = "#5A463C";
    g.font = '64px "CC Title", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
    g.fillText("成灿，生日快乐。", cx, cfg.titleY);

    const ws = cardWishes();
    const bodyFont = '42px "CC Hand", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
    let lines;
    if (ws.length) {
      lines = [];
      ws.slice(0, 3).forEach((t) => {
        lines = lines.concat(wrapText(g, bodyFont, t, cfg.maxW));
      });
      lines = lines.slice(0, 5);
    } else {
      lines = ["愿你以后翻相册，", "翻到的都是好日子。"];
    }

    g.font = bodyFont;
    g.fillStyle = "#6B5344";
    lines.forEach((t, i) => g.fillText(t, cx, cfg.bodyY + i * cfg.gap));

    g.font = '30px "CC Hand", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
    g.fillStyle = "#B09880";
    g.fillText("2026.11.17", cx, cfg.dateY);

    return cv.toDataURL("image/jpeg", 0.92);
  }

function hideCard() {
    const cv = $("#cardview");
    cv.classList.remove("on");
    setTimeout(() => { cv.hidden = true; }, 280);
  }
  $("#card-shuffle").addEventListener("click", async (e) => {
    e.stopPropagation();
    let next = Math.floor(Math.random() * CARD_TPL.length);
    if (next === buildCard.lastIndex) next = (next + 1) % CARD_TPL.length;
    $("#cardimg").src = await buildCard(next);
    Sound.paper();
  });
  $("#card-close").addEventListener("click", hideCard);
  $("#cardview").addEventListener("click", (e) => { if (e.target.id === "cardview") hideCard(); });
  $("#peCancel").addEventListener("click", (e) => {
    e.stopPropagation();
    const box = $("#photoedit");
    box.classList.remove("on");
    setTimeout(() => { box.hidden = true; }, 280);
  });
  $("#photoedit").addEventListener("click", (e) => {
    if (e.target.id === "photoedit" && canCloseBackdrop(e.target)) {
      e.currentTarget.classList.remove("on");
      setTimeout(() => { e.currentTarget.hidden = true; }, 280);
    }
  });

  // 统一用事件委托处理所有「关闭」类操作，避免绑定漏掉
  document.addEventListener("click", (e) => {
    if (e.target.closest("#peCancel")) {
      const b = document.getElementById("photoedit");
      b.classList.remove("on");
      setTimeout(() => { b.hidden = true; }, 280);
      return;
    }
    if (e.target.closest("#w-skip")) {
      closeWelcome(); toast("点点桌上的东西", 2200); return;
    }
    if (e.target.closest("#card-close")) { hideCard(); return; }
    if (e.target.closest("#letterClose")) { closeLetter(); return; }
    if (e.target.id === "letter") { if (canCloseBackdrop(e.target)) closeLetter(); return; }
    if (e.target.id === "photoedit" && canCloseBackdrop(e.target)) {
      const b = e.target; b.classList.remove("on");
      setTimeout(() => { b.hidden = true; }, 280);
      return;
    }
    if (e.target.id === "cardview") { hideCard(); }
  });
  /* ---------------- 开屏：礼物盒 ---------------- */
  const UNLOCK_AT = new Date(2026, 10, 17, 0, 0, 0).getTime();
  const qsAll = location.search;
  const skipGate = qsAll.includes("static");
  const forceUnlock = qsAll.includes("unlock");
  const forceLock = qsAll.includes("lock=1");
  let unlocked = forceUnlock || (!forceLock && Date.now() >= UNLOCK_AT);

  const gateEl = $("#gate");
  const giftEl = $("#gift");
  const gateHint = $("#gateHint");
  const cakeSpot = $("#cakeSpot");
  const homeFlame = $("#homeFlame");
  let gateTaps = 0;
  let introPlayed = false;

  function afterIntro() {
    if (data.sound) setTimeout(() => { try { Sound.bgmStart(); } catch (e) {} }, 600);
    if (!data.stage) {
      data.stage = 1;
      save();
      setTimeout(() => toast("今天是你的 21 岁生日，点一下蛋糕看看吧。", 5200), 420);
    } else {
      setTimeout(() => toast("点点桌上的东西", 2600), 700);
    }
  }

  function playIntro(done) {
    if (!homeFlame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (homeFlame) homeFlame.classList.add("on");
      if (done) done();
      return;
    }
    if (introPlayed) { if (done) done(); return; }
    introPlayed = true;
    const phone = $("#phone");
    phone.classList.add("intro");
    setTimeout(() => {
      phone.classList.add("cake-on");
      if (cakeSpot) cakeSpot.classList.add("on");
    }, 900);
    setTimeout(() => {
      if (homeFlame) {
        homeFlame.classList.add("on");
        homeFlame.classList.add("flick");
      }
      Sound.lighter();
    }, 2150);
    setTimeout(() => {
      phone.classList.remove("intro");
      phone.classList.remove("cake-on");
      if (cakeSpot) cakeSpot.classList.remove("on");
    }, 3000);
    setTimeout(() => { if (done) done(); }, 4100);
  }

  function openGate() {
    if (!gateEl || gateEl.hidden) return;
    if (giftEl) giftEl.classList.add("open");
    Sound.paper();
    setTimeout(() => Sound.chime(), 280);
    setTimeout(() => {
      gateEl.classList.add("off");
      playIntro(afterIntro);
      setTimeout(() => { gateEl.hidden = true; }, 900);
    }, 640);
  }

  if (giftEl) {
    giftEl.addEventListener("click", () => {
      Sound.unlock();
      if (!gateEl || gateEl.hidden) return;
      if (!unlocked) {
        toast("礼物将会在 11 月 17 号 00:00 准时送达。", 3800);
        Sound.gift();
        giftEl.classList.remove("shake");
        void giftEl.offsetWidth;
        giftEl.classList.add("shake");
        return;
      }
      gateTaps += 1;
      Sound.gift();
      giftEl.classList.remove("shake");
      void giftEl.offsetWidth;
      giftEl.classList.add("shake");
      if (gateTaps >= 3) openGate();
    });
  }

  function startGate() {
    if (!gateEl) return false;
    if (skipGate) {
      gateEl.hidden = true;
      if (homeFlame) homeFlame.classList.add("on");
      return false;
    }
    gateEl.hidden = false;
    // 开屏期间就让里面保持全暗，淡出时不会先亮一下
    const ph = $("#phone");
    if (ph) ph.classList.add("intro");
    if (gateHint) gateHint.textContent = unlocked ? "连点三下，打开礼物" : "礼物将会在 11 月 17 号 00:00 准时送达";
    return true;
  }

  // Keep checking the clock while the page stays open, so the gate flips at unlock time without a reload.
  function syncUnlock() {
    if (unlocked || forceLock || !gateEl || gateEl.hidden) return;
    const left = UNLOCK_AT - Date.now();
    if (left > 0) {
      setTimeout(syncUnlock, Math.min(left + 30, 1000));
      return;
    }
    unlocked = true;
    if (gateHint) gateHint.textContent = "连点三下，打开礼物";
    toast("礼物送达了，连点三下打开吧。", 5200);
  }

  /* ---------------- 启动 ---------------- */
  syncSound();
  buildRope();

  const veil = $("#veil");
  if (location.search.includes("static")) {
    if (veil) veil.remove();
  } else {
    const drop = () => {
      if (!veil || veil._done) return;
      veil._done = true;
      setTimeout(() => { veil.classList.add("off"); setTimeout(() => veil.remove(), 800); }, 160);
    };
    if (document.readyState === "complete") drop();
    else window.addEventListener("load", drop, { once: true });
    setTimeout(drop, 2600);
  }

  const gateOn = startGate();
  if (gateOn) syncUnlock();
  if (!gateOn) {
    if (!location.search.includes("nowelcome")) {
      setTimeout(() => afterIntro(), 300);
    } else {
      scheduleTip("点点桌上的东西", 2600, 1400);
    }
  }

  if (location.search.includes("wish")) openWishSheet(false);
  if (location.search.includes("layer")) openLayer(location.search.split("layer=")[1].split("&")[0]);

  window.__cc = { data, openWishSheet, openLayer, close, closeWelcome, buildCard, cardWishes, buildRecord };
})();
