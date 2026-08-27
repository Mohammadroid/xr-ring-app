/* XR Ring companion — full bench parity on the phone.
 *
 * Talks DIRECTLY to the ring over Web Bluetooth: the telemetry GATT
 * service carries TEL rows + console output (notify) and the console
 * command grammar (write). Firmware updates ride the ring's mcumgr
 * SMP service. No PC, no server, no bench in the middle.
 */
'use strict';

const APP_VERSION = '2.0.0';

/* ---- ring GATT ---- */
const SVC_TEL = '8f5a1b20-6d31-4c9e-9b77-1f2ad3c40002';
const CHR_TXT = '8f5a1b20-6d31-4c9e-9b77-1f2ad3c40003';
const CHR_CMD = '8f5a1b20-6d31-4c9e-9b77-1f2ad3c40004';
const SVC_SMP = '8d53dc1d-1db7-4cd3-868b-8a527460aa84';
const CHR_SMP = 'da2e7828-fbce-4e01-ae9e-261174997c48';

/* ---- tables mirrored from the firmware / bench ---- */
const BTN_NAMES = ['LFT', 'MID', 'RHT', 'SET', 'RST', 'DN', 'UP'];
const BTN_DEAD = [3, 4];                       /* pads proven dead on the dev board */
const GESTS = [[1, 'Tap'], [3, 'Tap & hold'], [4, 'Swipe ←'], [5, 'Swipe →'],
               [6, 'Swipe ↑'], [7, 'Swipe ↓'], [8, '2-finger tap'],
               [10, '2F swipe ←'], [11, '2F swipe →'], [12, '2F swipe ↑'],
               [13, '2F swipe ↓'], [14, 'Zoom in'], [15, 'Zoom out'],
               [2, 'Double tap (n/a)']];
const FT_COMPONENTS = [['trackpoint', 'tp'], ['scroll', 'scroll'], ['imu', 'imu'],
  ['touch', 'touch'], ['mic', 'mic'], ['battery_adc', 'bat'],
  ['power_rail', 'vdd'], ['flash_settings', 'flash'], ['ble', 'ble'],
  ['led', 'led'], ['buttons', 'btns']];
const SOURCES = ['trackpoint', 'scroll_surface', 'imu', 'touch_surface',
                 'buttons', 'pointer_test', 'mic'];
const CAPS = ['BUTTON', 'GESTURE', 'FORCE_2D', 'SCROLL_1D',
              'POINT_RELATIVE_2D', 'TOUCH_CONTACT', 'ORIENTATION'];
const ACTIONS = ['LEFT_CLICK', 'RIGHT_CLICK', 'MIDDLE_CLICK', 'SCROLL_UP_STEP',
  'SCROLL_DOWN_STEP', 'VOLUME_UP', 'VOLUME_DOWN', 'MUTE', 'PLAY_PAUSE',
  'NEXT_TRACK', 'PREV_TRACK', 'CAMERA_SHUTTER', 'SNIPER', 'SPEED_CYCLE',
  'MACRO_1', 'MACRO_2', 'MACRO_3', 'MACRO_4', 'HOST_CYCLE', 'PROFILE_SWITCH',
  'CLUTCH_PRESS', 'CLUTCH_RELEASE', 'CURSOR_MOVE', 'SCROLL_VERTICAL',
  'SCROLL_HORIZONTAL', 'DRAG_START', 'DRAG_END', 'XR_RAY_MOVE', 'XR_SELECT',
  'SYSTEM_SLEEP', 'SYSTEM_WAKE', 'PAIRING_START'];
const QUICK = ['?', 'f', 'm', 'L', 'i', 'p', 'T', 'btns', 'storage', 'selftest',
               'useprof', 'active', 'hostprof', 'osprof', 'kws', 'dict',
               'hidroute', 'speed', 'save'];
const SEEDS = ['#6750A4', '#0B57D0', '#146C2E', '#B3261E', '#7D5260', '#E8710A'];

const NAV = [
  { id: 'home', ic: '⌂', label: 'Home',
    pages: [['overview', 'Overview'], ['battery', 'Battery']] },
  { id: 'sensors', ic: '◎', label: 'Sensors',
    pages: [['tp', 'TrackPoint'], ['imu', 'IMU'], ['st', 'Scroll · Touch'],
            ['btn', 'Buttons']] },
  { id: 'audio', ic: '♪', label: 'Audio', pages: [['audio', 'Audio']] },
  { id: 'config', ic: '⚙', label: 'Config',
    pages: [['map', 'Mapping'], ['conn', 'Connections'], ['set', 'Settings']] },
  { id: 'tools', ic: '▣', label: 'Tools',
    pages: [['fact', 'Factory'], ['diag', 'Diagnostics'],
            ['exp', 'Experiments'], ['console', 'Console']] },
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const txt = (id, v, cls) => { const e = typeof id === 'string' ? $('#' + id) : id;
  if (!e) return; e.textContent = v; if (cls !== undefined) e.className = cls; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const num = v => { const n = parseFloat(v); return isNaN(n) ? undefined : n; };

/* ================= theme (M3 tonal from a seed) ==================== */
function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  return [h, d ? d / (1 - Math.abs(2 * l - 1)) * 100 : 0];
}
function applyTheme() {
  const seed = localStorage.getItem('seed') || SEEDS[0];
  const [h, s0] = hueOf(seed);
  const s = Math.max(s0, 40);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const T = (sat, l) => `hsl(${h.toFixed(0)} ${sat}% ${l}%)`;
  const R = document.documentElement.style, set = (k, v) => R.setProperty(k, v);
  if (dark) {
    set('--surface', T(14, 7)); set('--surface-1', T(13, 11));
    set('--surface-2', T(13, 14)); set('--surface-3', T(12, 19));
    set('--on-surface', T(10, 92)); set('--on-surface-var', T(9, 70));
    set('--primary', T(s, 78)); set('--on-primary', T(40, 16));
    set('--sec-c', T(20, 25)); set('--on-sec-c', T(18, 89));
    set('--outline', T(8, 38)); set('--divider', T(8, 22));
    set('--state', 'rgba(255,255,255,.09)');
    set('--ok', '#7ddb8a'); set('--ok-c', 'hsl(140 25% 22%)'); set('--on-ok-c', '#9ff0aa');
    set('--error', '#ffb4ab'); set('--err-c', 'hsl(6 35% 26%)'); set('--on-err-c', '#ffdad6');
    set('--warn', '#e8c46a'); set('--warn-c', 'hsl(42 30% 24%)'); set('--on-warn-c', '#ffe08a');
    set('--inv-surface', T(10, 90)); set('--inv-on-surface', T(12, 12));
  } else {
    set('--surface', T(30, 98)); set('--surface-1', T(28, 95));
    set('--surface-2', T(26, 93)); set('--surface-3', T(24, 89));
    set('--on-surface', T(22, 11)); set('--on-surface-var', T(12, 34));
    set('--primary', T(s, 40)); set('--on-primary', '#fff');
    set('--sec-c', T(30, 87)); set('--on-sec-c', T(28, 15));
    set('--outline', T(10, 60)); set('--divider', T(12, 86));
    set('--state', 'rgba(0,0,0,.07)');
    set('--ok', '#146C2E'); set('--ok-c', '#c8f0cd'); set('--on-ok-c', '#0a3d19');
    set('--error', '#B3261E'); set('--err-c', '#ffdad6'); set('--on-err-c', '#8c1d18');
    set('--warn', '#8a6100'); set('--warn-c', '#ffe08a'); set('--on-warn-c', '#5a3f00');
    set('--inv-surface', T(12, 18)); set('--inv-on-surface', T(14, 94));
  }
  const tc = document.querySelector('meta[name=theme-color]');
  if (tc) tc.setAttribute('content', dark ? T(13, 14) : T(26, 93));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

/* ================= helpers ========================================= */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800);
}
function meter(id, val, min, max, centered) {
  const e = $('#' + id); if (!e) return;
  if (val === undefined) { e.style.width = '0'; return; }
  const pct = clamp((val - min) / (max - min) * 100, 0, 100);
  if (centered) {
    const half = Math.abs(pct - 50);
    e.style.width = half + '%';
    e.style.marginLeft = (pct < 50 ? -half : 0) + '%';
  } else e.style.width = pct + '%';
}

/* ================= state =========================================== */
const S = {
  f: {},                 /* last TEL row */
  hosts: [], bonds: [], self: '',
  maps: [], profile: null, active: 'all', typeTarget: 'all',
  hist: {},              /* rolling series for charts */
  ft: {}, mem: {}, fatal: '',
  lastTelAt: 0, telRows: 0,
};
const HIST_N = 90;
function push(key, v) {
  const a = S.hist[key] || (S.hist[key] = []);
  a.push(v); if (a.length > HIST_N) a.shift();
}

/* ================= BLE ============================================= */
let dev = null, cmdChr = null, smpChr = null, connected = false, rxBuf = '';
const dec = new TextDecoder(), enc = new TextEncoder();

function setLink(on, label) {
  connected = on;
  $('#linkChip').classList.toggle('on', on);
  txt('linkTxt', label);
}

async function pickDevice(any) {
  return navigator.bluetooth.requestDevice(any
    ? { acceptAllDevices: true, optionalServices: [SVC_TEL, SVC_SMP, 'battery_service'] }
    : { filters: [{ namePrefix: 'XR Ring' }, { services: [SVC_TEL] }],
        optionalServices: [SVC_TEL, SVC_SMP, 'battery_service'] });
}

async function connect(device) {
  setLink(false, 'connecting');
  $('#spin').classList.add('on');
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService(SVC_TEL);
  const txtChr = await svc.getCharacteristic(CHR_TXT);
  cmdChr = await svc.getCharacteristic(CHR_CMD);
  await txtChr.startNotifications();
  txtChr.addEventListener('characteristicvaluechanged', e => {
    rxBuf += dec.decode(e.target.value);
    let i;
    while ((i = rxBuf.indexOf('\n')) >= 0) {
      handleLine(rxBuf.slice(0, i).replace(/\r/g, '').trim());
      rxBuf = rxBuf.slice(i + 1);
    }
    if (rxBuf.length > 4096) rxBuf = '';
  });
  smpChr = null;
  try {                                   /* optional: OTA transport */
    const ss = await server.getPrimaryService(SVC_SMP);
    smpChr = await ss.getCharacteristic(CHR_SMP);
    await smpChr.startNotifications();
    smpChr.addEventListener('characteristicvaluechanged', onSmpNotify);
  } catch (e) { /* firmware without mcumgr: OTA card stays disabled */ }
  device.addEventListener('gattserverdisconnected', onDrop, { once: true });
  dev = device;
  setLink(true, device.name || 'ring');
  $('#spin').classList.remove('on');
  $('#splash').classList.remove('on');
  showPage(curPage);
  $('#btnOta').disabled = !smpChr;
  if (!smpChr) txt('otaState', 'unavailable', 'badge warn');
  send('?'); setTimeout(() => send('L'), 700);
  setTimeout(() => send('m'), 1400);
  setTimeout(() => send('useprof'), 2000);
  if (localStorage.getItem('hello') !== 'off')
    setTimeout(() => send('hello android'), 2600);
  keepAwake(localStorage.getItem('wakelock') === 'on');
}

function onDrop() {
  setLink(false, 'reconnecting');
  let n = 0;
  const again = async () => {
    if (!dev || connected) return;
    try { await connect(dev); toast('reconnected'); }
    catch (e) {
      if (++n < 9) setTimeout(again, Math.min(1200 * n, 12000));
      else { setLink(false, 'offline'); toast('lost the ring'); }
    }
  };
  setTimeout(again, 900);
}

let sendQ = Promise.resolve();
function send(line) {
  if (!cmdChr) { toast('not connected'); return; }
  sendQ = sendQ.then(async () => {
    const b = enc.encode(line + '\n');
    for (let o = 0; o < b.length; o += 120) {
      const part = b.slice(o, o + 120);
      try {
        if (cmdChr.writeValueWithoutResponse) await cmdChr.writeValueWithoutResponse(part);
        else await cmdChr.writeValue(part);
      } catch (e) { toast('write failed'); return; }
    }
    log('> ' + line, 'cmd');
  }).catch(() => {});
}

/* ================= line handling =================================== */
let pendConn = null, pendBond = null, pendMaps = null;

function handleLine(line) {
  if (!line) return;
  if (line.startsWith('TEL ')) {
    const now = performance.now();
    if (S.lastTelAt) push('gap', now - S.lastTelAt);
    S.lastTelAt = now; S.telRows++;
    const prev = S.f; const f = {};
    for (const kv of line.slice(4).split(' ')) {
      const i = kv.indexOf('=');
      if (i > 0) f[kv.slice(0, i)] = kv.slice(i + 1);
    }
    S.f = f;
    /* rate derivations */
    const dt = (num(f.t) - num(prev.t)) / 1000;
    if (dt > 0 && dt < 5) {
      push('hid', Math.round((num(f.hid) - num(prev.hid)) / dt));
      push('qd', num(f.qd) || 0);
      push('mdc', num(f.mdc) || 0);
    }
    push('bat', num(f.vbt) || 0);
    push('pk', num(f.apk) || 0); push('rms', num(f.arm) || 0);
    push('lat', (num(f.lav) || 0) / 1000);
    push('ax', num(f.iax) || 0); push('ay', num(f.iay) || 0); push('az', num(f.iaz) || 0);
    push('sdy', num(f.sdy) || 0);
    if (expState.drift) expState.driftHid += Math.max(0, num(f.hid) - num(prev.hid) || 0);
    renderCurrent();
    return;
  }
  if (line.startsWith('SELF ')) { S.self = line.slice(5).trim(); return; }
  if (line.startsWith('CONN ')) {
    if (!pendConn) pendConn = [];
    const p = line.split(/\s+/), kv = {};
    for (const x of p) { const i = x.indexOf('='); if (i > 0) kv[x.slice(0, i)] = x.slice(i + 1); }
    const addr = (p.find(x => x.includes(':')) || '').slice(0, 17);
    pendConn.push({ addr, secured: kv.sec === '1',
                    ci: ((+kv.ci || 0) * 1.25).toFixed(1) });
    return;
  }
  if (line.startsWith('BOND ')) {
    if (!pendBond) pendBond = [];
    const p = line.split(/\s+/);
    pendBond.push((p.find(x => x.includes(':')) || '').slice(0, 17));
    return;
  }
  if (line === 'CONNEND') {
    S.hosts = pendConn || []; S.bonds = pendBond || [];
    pendConn = pendBond = null; renderHosts(); return;
  }
  if (line.startsWith('MAP ')) {
    if (!pendMaps) pendMaps = [];
    pendMaps.push(line.slice(4).trim()); return;
  }
  if (line === 'MAPEND') { S.maps = pendMaps || []; pendMaps = null; renderMaps(); return; }
  if (line.startsWith('[st] ')) { parseSelfTest(line); log(line); return; }
  if (line.startsWith('[mem] ')) { parseMem(line); log(line); return; }
  if (line.startsWith('[fatal]')) { S.fatal = line; txt('dgFatal', line); log(line, 'err'); return; }
  log(line, /ERR|FAIL|error/i.test(line) ? 'err' : '');

  let m;
  if ((m = line.match(/\[prof\].*profile (\d)/))) { S.profile = +m[1]; renderProfile(); }
  if ((m = line.match(/\[prof\] active=(\d)/))) { S.profile = +m[1]; renderProfile(); }
  if ((m = line.match(/\[kvm\] active host: (\S+)/))) { S.active = m[1]; renderHosts(); }
  if ((m = line.match(/\[kbd\] type target: (\S+)/))) { S.typeTarget = m[1]; renderTypeTo(); }
  if ((m = line.match(/^\[xr\] gen0 fw=(\S+)/))) { S.f.fw = m[1]; txt('otaFw', m[1]); }
  if ((m = line.match(/\[speed\] pointer (\d+)/))) markSeg('spdSeg', 's', m[1]);
  if ((m = line.match(/\[rate\].*?(\d+) Hz/))) markSeg('rateSeg', 'r', m[1]);
  if ((m = line.match(/\[hid\] route: (\w+)/))) markSeg('routeSeg', 'h', m[1]);
  if ((m = line.match(/\[pair\] confirm mode: (\w+)/))) markSeg('authSeg', 'a', m[1]);
  if (line.startsWith('[btns]')) {
    const box = $('#btnCensus');
    if (box) { box.textContent += (box.textContent ? '\n' : '') + line; }
  }
  if (line.startsWith('[st] battery') || line.startsWith('[st] power_rail'))
    txt('batTest', line.replace('[st] ', ''));
}

function parseSelfTest(line) {
  let m = line.match(/^\[st\] (\S+) (PASS|FAIL) ?(.*)$/);
  if (m) { S.ft[m[1]] = { ok: m[2] === 'PASS', detail: m[3] }; renderFactory(); return; }
  m = line.match(/RESULT (\d+)\/(\d+)/);
  if (m) {
    const good = m[1] === m[2];
    txt('ftVerdict', `${m[1]}/${m[2]} ` + (good ? 'BOARD GOOD' : 'CHECK'),
        'badge r ' + (good ? 'ok' : 'bad'));
  }
}
function parseMem(line) {
  for (const kv of line.slice(6).split(' ')) {
    const i = kv.indexOf('=');
    if (i > 0) S.mem[kv.slice(0, i)] = kv.slice(i + 1);
  }
  renderMem();
}

/* ================= console ========================================= */
const conEl = () => $('#console');
function log(s, cls) {
  const el = conEl(); if (!el) return;
  const stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 14;
  const d = document.createElement('div');
  d.textContent = s; if (cls) d.className = cls;
  el.appendChild(d);
  while (el.childNodes.length > 500) el.removeChild(el.firstChild);
  if (stick) el.scrollTop = el.scrollHeight;
}

/* ================= charts ========================================== */
function fitCanvas(c) {
  const r = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== w * r || c.height !== h * r) { c.width = w * r; c.height = h * r; }
  const x = c.getContext('2d');
  x.setTransform(r, 0, 0, r, 0, 0);
  x.clearRect(0, 0, w, h);
  return [x, w, h];
}
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function spark(canvas, series, opts = {}) {
  if (!canvas || !canvas.clientWidth) return;
  const [x, w, h] = fitCanvas(canvas);
  const all = series.flatMap(s => s.d).filter(v => isFinite(v));
  if (!all.length) return;
  let lo = opts.min !== undefined ? opts.min : Math.min(...all);
  let hi = opts.max !== undefined ? opts.max : Math.max(...all);
  if (hi - lo < 1e-6) { hi = lo + 1; }
  const pad = 6;
  const Y = v => h - pad - (clamp(v, lo, hi) - lo) / (hi - lo) * (h - pad * 2);
  x.strokeStyle = cssv('--divider'); x.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const yy = pad + (h - pad * 2) * i / 2;
    x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke();
  }
  for (const s of series) {
    if (!s.d.length) continue;
    const step = w / Math.max(HIST_N - 1, 1);
    x.beginPath();
    s.d.forEach((v, i) => {
      const xx = w - (s.d.length - 1 - i) * step;
      i ? x.lineTo(xx, Y(v)) : x.moveTo(xx, Y(v));
    });
    x.strokeStyle = s.c; x.lineWidth = s.w || 2;
    x.lineJoin = 'round'; x.stroke();
    if (s.fill) {
      x.lineTo(w, h); x.lineTo(w - (s.d.length - 1) * step, h);
      x.closePath(); x.globalAlpha = .14; x.fillStyle = s.c; x.fill(); x.globalAlpha = 1;
    }
  }
}

function padDot(canvas, nx, ny, label, trail) {
  if (!canvas || !canvas.clientWidth) return;
  const [x, w, h] = fitCanvas(canvas);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8;
  x.strokeStyle = cssv('--divider'); x.lineWidth = 1;
  x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.beginPath(); x.arc(cx, cy, r / 2, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy);
  x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
  if (trail && trail.length > 1) {
    x.beginPath();
    trail.forEach((p, i) => {
      const px = cx + clamp(p[0], -1, 1) * r, py = cy - clamp(p[1], -1, 1) * r;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.strokeStyle = cssv('--primary'); x.globalAlpha = .35; x.lineWidth = 2;
    x.stroke(); x.globalAlpha = 1;
  }
  if (nx !== undefined && ny !== undefined) {
    const px = cx + clamp(nx, -1, 1) * r, py = cy - clamp(ny, -1, 1) * r;
    x.beginPath(); x.arc(px, py, 9, 0, 7);
    x.fillStyle = cssv('--primary'); x.fill();
    x.beginPath(); x.arc(px, py, 15, 0, 7);
    x.strokeStyle = cssv('--primary'); x.globalAlpha = .35; x.stroke(); x.globalAlpha = 1;
  }
  if (label) {
    x.fillStyle = cssv('--on-surface-var'); x.font = '11px system-ui';
    x.fillText(label, 8, 14);
  }
}

function horizon(canvas, roll, pitch) {
  if (!canvas || !canvas.clientWidth) return;
  const [x, w, h] = fitCanvas(canvas);
  x.save();
  x.beginPath(); x.rect(0, 0, w, h); x.clip();
  x.translate(w / 2, h / 2); x.rotate(-roll * Math.PI / 180);
  const off = clamp(pitch, -60, 60) / 60 * (h / 2);
  x.fillStyle = cssv('--sec-c');
  x.fillRect(-w, off, w * 2, h * 2);
  x.strokeStyle = cssv('--primary'); x.lineWidth = 2;
  x.beginPath(); x.moveTo(-w, off); x.lineTo(w, off); x.stroke();
  x.restore();
  x.strokeStyle = cssv('--on-surface'); x.lineWidth = 2;
  x.beginPath();
  x.moveTo(w / 2 - 26, h / 2); x.lineTo(w / 2 - 8, h / 2);
  x.moveTo(w / 2 + 8, h / 2); x.lineTo(w / 2 + 26, h / 2);
  x.moveTo(w / 2, h / 2 - 8); x.lineTo(w / 2, h / 2 + 8);
  x.stroke();
}

/* ================= page rendering ================================== */
function renderCurrent() {
  const f = S.f;
  if (curPage === 'overview') renderOverview(f);
  else if (curPage === 'battery') renderBattery(f);
  else if (curPage === 'tp') renderTp(f);
  else if (curPage === 'imu') renderImu(f);
  else if (curPage === 'st') renderSt(f);
  else if (curPage === 'btn') renderButtons(f);
  else if (curPage === 'audio') renderAudio(f);
  else if (curPage === 'diag') renderDiag(f);
  else if (curPage === 'conn') { txt('otaFw', f.fw || '—'); }
  /* experiments update from their own timers, not per TEL row */
}

const HEALTH_KEYS = [['trackpoint', 'trackpoint'], ['scroll_surface', 'scroll'],
  ['imu', 'inertial'], ['touch_surface', 'touch'], ['buttons', 'buttons'],
  ['pointer_test', 'pointer test'], ['mic', 'microphone']];

function renderOverview(f) {
  const vbt = num(f.vbt), vbp = num(f.vbp);
  const usb = vbt > 4400, none = vbt !== undefined && vbt < 2800;
  if (vbp !== undefined) {
    txt('ovPct', usb ? '⚡' : vbp + '%');
    txt('ovV', usb ? 'USB' : none ? 'no cell' : (vbt / 1000).toFixed(2) + ' V');
    const arc = $('#gArc');
    if (arc) {
      arc.style.strokeDashoffset = 283 - 283 * (usb ? 1 : vbp) / 100;
      arc.style.stroke = (!usb && vbp <= 15) ? cssv('--error') : cssv('--primary');
    }
  }
  txt('ovFw', f.fw || '—');
  const t = num(f.t);
  txt('ovUp', t === undefined ? '—' :
      t > 3600000 ? (t / 3600000).toFixed(1) + ' h' :
      t > 60000 ? (t / 60000).toFixed(0) + ' min' : (t / 1000).toFixed(0) + ' s');
  txt('ovPwr', f.ps === '3' ? 'deep sleep' : f.ps === '2' ? 'rest' : 'active');
  txt('ovProf', S.profile === null ? '—' : 'P' + S.profile);
  const hid = S.hist.hid || [];
  txt('ovHidNow', (hid.length ? hid[hid.length - 1] : 0) + '/s', 'r badge');
  spark($('#cvHid'), [
    { d: hid, c: cssv('--primary'), fill: true },
    { d: S.hist.qd || [], c: cssv('--error'), w: 1.5 },
  ], { min: 0 });
  /* activity tiles */
  const flags = $('#ovFlags');
  if (flags && !flags.childNodes.length) {
    for (const n of ['buttons', 'trackpoint', 'scroll', 'touch', 'gestures', 'mic'])
      flags.insertAdjacentHTML('beforeend',
        `<div class="tile" id="fl_${n}"><div class="n">${n}</div><div class="v">—</div></div>`);
  }
  const bump = (id, val, prevKey) => {
    const e = $('#fl_' + id); if (!e) return;
    const p = S['_p' + prevKey];
    S['_p' + prevKey] = val;
    e.querySelector('.v').textContent = val === undefined ? '—' : val;
    if (p !== undefined && val !== undefined && val !== p) {
      e.classList.add('hot'); clearTimeout(e._t);
      e._t = setTimeout(() => e.classList.remove('hot'), 320);
    }
  };
  bump('buttons', num(f.btp), 'btp'); bump('trackpoint', num(f.tps), 'tps');
  bump('scroll', num(f.scs), 'scs'); bump('touch', num(f.tw), 'tw');
  bump('gestures', num(f.tgl), 'tgl'); bump('mic', num(f.abl), 'abl');
  /* health */
  const hb = $('#ovHealth');
  if (hb) {
    hb.innerHTML = HEALTH_KEYS.map(([k, label]) => {
      const v = f[k];
      const cls = v === 'ok' ? 'ok' : (v === 'FAILED' ? 'bad' : v ? 'warn' : '');
      return `<div class="stat"><s>${label}</s><span class="badge ${cls}">${v || '—'}</span></div>`;
    }).join('');
  }
  const us = v => v === undefined ? '—' : (v / 1000).toFixed(2) + ' ms';
  txt('vLatL', us(num(f.lus))); txt('vLatA', us(num(f.lav))); txt('vLatM', us(num(f.lmx)));
  meter('mLatL', num(f.lus) / 1000, 0, 20); meter('mLatA', num(f.lav) / 1000, 0, 20);
  meter('mLatM', num(f.lmx) / 1000, 0, 20);
}

function renderBattery(f) {
  const vbt = num(f.vbt), vbp = num(f.vbp), usb = vbt > 4400, none = vbt < 2800;
  txt('batBigV', vbt === undefined ? '—' : (vbt / 1000).toFixed(2) + ' V');
  txt('batState', usb ? 'USB rail' : none ? 'no cell' : 'on cell',
      'r badge ' + (usb ? 'warn' : none ? '' : 'ok'));
  txt('batPct', vbp === undefined ? '—' : vbp + ' %');
  meter('batBar', usb || none ? 0 : vbp, 0, 100);
  const bb = $('#batBar');
  if (bb) bb.style.background = (!usb && vbp <= 15) ? cssv('--error')
    : (!usb && vbp <= 30) ? cssv('--warn') : cssv('--primary');
  txt('batVdd', f.vdd ? (num(f.vdd) / 1000).toFixed(2) + ' V' : '—');
  txt('batTmp', f.tmp ? (num(f.tmp) / 10).toFixed(1) + ' °C' : '—');
  txt('batCpu', f.cpu ? f.cpu + ' %' : '—');
  const b = (S.hist.bat || []).filter(v => v > 2800 && v < 4400);
  spark($('#cvBat'), [{ d: b, c: cssv('--primary'), fill: true }],
        { min: 3300, max: 4300 });
}

function renderTp(f) {
  const rx = num(f.trx) || 0, ry = num(f.try) || 0;
  const R = 250;
  push('tpTrail', [rx / R, ry / R]);
  const trail = (S.hist.tpTrail || []).slice(-40);
  padDot($('#cvTp'), rx / R, ry / R, 'raw ±' + R, trail);
  txt('tpSamples', (f.tps || 0) + ' samples', 'r badge');
  const p = num(f.tpp) || 0;
  meter('mTpP', p, 0, 1000); txt('vTpP', p);
  meter('mTrx', rx, -R, R, true); txt('vTrx', rx);
  meter('mTry', ry, -R, R, true); txt('vTry', ry);
  meter('mTrz', num(f.trz), -R, R, true); txt('vTrz', f.trz ?? '—');
  txt('tpDelta', `${f.tpx ?? '—'}, ${f.tpy ?? '—'}`);
  txt('tpProbe', `${f.tpo ?? '—'} ok / ${f.trc ?? '—'} reconf`);
}

function renderImu(f) {
  const qw = (num(f.iqw) || 1000) / 1000, qx = (num(f.iqx) || 0) / 1000;
  const qy = (num(f.iqy) || 0) / 1000, qz = (num(f.iqz) || 0) / 1000;
  const D = 180 / Math.PI;
  const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)) * D;
  const sp = clamp(2 * (qw * qy - qz * qx), -1, 1);
  const pitch = Math.asin(sp) * D;
  const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * D;
  horizon($('#cvImu'), roll, pitch);
  txt('imRoll', roll.toFixed(0) + '°'); txt('imPitch', pitch.toFixed(0) + '°');
  txt('imYaw', yaw.toFixed(0) + '°');
  const G = 500;
  for (const [k, id] of [['igx', 'Gx'], ['igy', 'Gy'], ['igz', 'Gz']]) {
    meter('m' + id, num(f[k]), -G, G, true); txt('v' + id, f[k] ?? '—');
  }
  const A = 9000;
  for (const [k, id] of [['iax', 'Ax'], ['iay', 'Ay'], ['iaz', 'Az']]) {
    meter('m' + id, num(f[k]), -A, A, true); txt('v' + id, f[k] ?? '—');
  }
  spark($('#cvImuA'), [
    { d: S.hist.ax || [], c: cssv('--primary') },
    { d: S.hist.ay || [], c: cssv('--ok') },
    { d: S.hist.az || [], c: cssv('--warn') },
  ], { min: -A, max: A });
  txt('imEdges', f.iie ?? '—');
  txt('imProbe', `0x${(+f.ipa || 0).toString(16)} / ${f.ipn ?? '—'}`);
  txt('imRec', f.irc ?? '—');
}

function renderSt(f) {
  spark($('#cvScroll'), [{ d: S.hist.sdy || [], c: cssv('--primary'), fill: true }]);
  txt('scSamples', (f.scs || 0) + ' samples', 'r badge');
  meter('mSdx', num(f.sdx), -40, 40, true); txt('vSdx', f.sdx ?? '—');
  meter('mSdy', num(f.sdy), -40, 40, true); txt('vSdy', f.sdy ?? '—');
  txt('scAcc', f.sac ?? '—');
  const tx = (num(f.tox) || 0) / 128, ty = (num(f.toy) || 0) / 128;
  padDot($('#cvTouch'), tx, ty, 'relative');
  txt('toFingers', (f.tfg || 0) + ' finger(s)', 'r badge');
  txt('toPos', `${f.tox ?? '—'}, ${f.toy ?? '—'}`);
  txt('toWin', `${f.tw ?? '—'} / ${f.tfe ?? '—'}`);
  const tiles = $('#gestTiles');
  if (tiles && !tiles.childNodes.length)
    for (const [id, name] of GESTS)
      tiles.insertAdjacentHTML('beforeend',
        `<div class="tile${id === 2 ? ' dead' : ''}" id="g_${id}">
           <div class="n">${name}</div><div class="v">0</div>
           <div class="a" id="ga_${id}"></div></div>`);
  const tgs = String(f.tgs || '').split(',').map(Number);
  for (const [id] of GESTS) {
    const ix = id <= 8 ? id - 1 : id - 2;
    const c = tgs[ix] || 0, e = $('#g_' + id); if (!e) continue;
    e.querySelector('.v').textContent = c;
    const k = '_g' + id;
    if (S[k] !== undefined && c !== S[k]) {
      e.classList.add('hot'); clearTimeout(e._t);
      e._t = setTimeout(() => e.classList.remove('hot'), 400);
    }
    S[k] = c;
  }
}

function renderButtons(f) {
  for (const [box, idx] of [[$('#btnStick'), [0, 1, 2, 5, 6]], [$('#btnAux'), [3, 4]]]) {
    if (box && !box.childNodes.length)
      for (const i of idx)
        box.insertAdjacentHTML('beforeend',
          `<div class="tile${BTN_DEAD.includes(i) ? ' dead' : ''}" id="b_${i}">
             <div class="n">${BTN_NAMES[i]}</div><div class="v">0</div>
             <div class="a" id="ba_${i}"></div></div>`);
  }
  const mask = num(f.btn) || 0;
  const bte = String(f.bte || '').split(',').map(Number);
  for (let i = 0; i < 7; i++) {
    const e = $('#b_' + i); if (!e) continue;
    e.classList.toggle('hot', !!(mask & (1 << i)));
    e.querySelector('.v').textContent = bte[i] || 0;
  }
}

function renderAudio(f) {
  const pk = num(f.apk) || 0, rms = num(f.arm) || 0;
  spark($('#cvMic'), [
    { d: S.hist.pk || [], c: cssv('--primary'), fill: true },
    { d: S.hist.rms || [], c: cssv('--ok'), w: 1.5 },
  ], { min: 0 });
  meter('mPk', pk, 0, 4000); txt('vPk', pk);
  meter('mRms', rms, 0, 2000); txt('vRms', rms);
  txt('micBlk', `${f.abl ?? '—'} / ${f.aer ?? '—'}`);
  txt('micState', (num(f.abl) > 0 ? 'capturing' : 'idle'), 'r badge ' +
      (num(f.abl) > 0 ? 'ok' : ''));
  txt('kwN', f.kwn ?? '—');
  txt('kwD', `${f.kwd ?? '—'} / ${f.kwu ?? '—'}`);
  const sc = num(f.kws), th = num(f.kwt);
  txt('kwS', (sc !== undefined ? (sc / 100).toFixed(2) : '—') + ' / ' +
             (th !== undefined ? (th / 100).toFixed(2) : '—'));
  meter('mVad', num(f.kwv), 0, 1); txt('vVad', f.kwv === '1' ? 'voice' : 'quiet');
  txt('dicState', f.dic === '1' ? 'streaming' : 'idle');
  txt('dicBlk', `${f.dcs ?? '—'} / ${f.dcd ?? '—'}`);
}

function renderDiag(f) {
  spark($('#cvPipe'), [
    { d: S.hist.hid || [], c: cssv('--primary'), fill: true },
    { d: S.hist.qd || [], c: cssv('--error'), w: 1.5 },
    { d: S.hist.mdc || [], c: cssv('--warn'), w: 1.5 },
  ], { min: 0 });
  txt('dgQd', f.qd ?? '—');
  txt('dgNbm', f.nbm !== undefined ? (num(f.nbm) / 1000).toFixed(1) + ' ms' : '—');
  txt('dgNef', f.nef ?? '—');
  txt('dgMdc', f.mdc ?? '—');
  txt('dgTfe', f.tfe ?? '—');
  txt('dgTab', `${f.tea ?? '—'} / ${f.teb ?? '—'}`);
  txt('dgRec', `${f.trc ?? '—'} / ${f.irc ?? '—'}`);
  txt('dgUhs', f.uhs ?? '—');
  txt('dgKty', f.kty ?? '—');
}

function renderMem() {
  const m = S.mem; if (!m.slot0) return;
  const KB = n => (n / 1024).toFixed(1) + ' KB';
  const segs = [['boot', 49152, '#8957e5'], ['slot0', 380928, cssv('--primary')],
                ['slot1', 376832, '#4493f8'], ['spare', 4096, cssv('--outline')],
                ['settings', 32768, cssv('--warn')], ['USB', 49152, cssv('--error')]];
  const tot = segs.reduce((a, x) => a + x[1], 0);
  const bar = $('#memBar');
  if (bar && !bar.dataset.done) {
    bar.dataset.done = '1';
    bar.innerHTML = segs.map(x =>
      `<div style="width:${100 * x[1] / tot}%;background:${x[2]};display:grid;
        place-items:center;overflow:hidden">${x[1] > 60000 ? x[0] : ''}</div>`).join('');
    $('#memLegend').innerHTML = segs.map(x =>
      `<span><i style="background:${x[2]}"></i>${x[0]} ${KB(x[1])}</span>`).join('');
  }
  txt('memS0', +m.slot0 ? KB(+m.slot0) + ' (' + Math.round(100 * m.slot0 / 380928) + '%)' : 'empty');
  txt('memS1', +m.slot1 ? KB(+m.slot1) : 'empty');
  if (m.free !== undefined)
    txt('memFree', KB(+m.free) + ' of 32 KB');
  txt('memWrites', (m.writes_this_boot ?? '—') + ' writes', 'r badge');
  const items = [['bindings', 'maps'], ['trackpoint cal', 'tpcal'],
    ['wake-word model', 'kws'], ['profile P0', 'p0'], ['profile P1', 'p1'],
    ['profile P2', 'p2'], ['profile P3', 'p3'], ['macros', 'm'],
    ['host rules', 'hp'], ['os rules', 'os']];
  const t = $('#memCfg');
  if (t && m.maps !== undefined)
    t.innerHTML = items.map(([n, k]) => `<tr><td>${n}</td><td class="mono">${m[k] || 0} B</td></tr>`).join('');
}

function renderFactory() {
  const body = $('#ftBody'); if (!body) return;
  if (!body.childNodes.length)
    body.innerHTML = FT_COMPONENTS.map(([n, c]) =>
      `<tr><td>${n}</td><td id="ft_${n}"><span class="badge">—</span>
       <div class="mono" id="ftd_${n}" style="color:var(--on-surface-var)"></div></td>
       <td style="text-align:right"><button class="btn outline sm" data-cfg="${
         c === 'btns' ? 'btns test' : 'selftest ' + c}">test</button></td></tr>`).join('');
  for (const [n] of FT_COMPONENTS) {
    const r = S.ft[n]; if (!r) continue;
    const cell = $('#ft_' + n);
    if (cell) cell.querySelector('.badge').outerHTML =
      `<span class="badge ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'PASS' : 'FAIL'}</span>`;
    txt('ftd_' + n, r.detail || '');
  }
}

function renderHosts() {
  txt('connCount', S.hosts.length + ' linked', 'r badge');
  const mk = h => `
    <div class="stat">
      <s class="mono" style="font-size:11.5px">${h.addr}</s>
      <span class="row" style="gap:6px">
        <span class="badge ${h.secured ? 'ok' : 'warn'}">${h.secured ? h.ci + ' ms' : 'linking'}</span>
        <button class="btn ${S.active.startsWith(h.addr) ? '' : 'outline'} sm"
          data-act="${h.addr}">${S.active.startsWith(h.addr) ? 'active' : 'make active'}</button>
      </span></div>`;
  const cl = $('#connList');
  if (cl) {
    cl.innerHTML = (S.hosts.length ? S.hosts.map(mk).join('') : 'no hosts connected') +
      (S.self ? `<div class="hint">ring address: <b class="mono">${S.self}</b></div>` : '');
    cl.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      send('active ' + b.dataset.act); send('typeto ' + b.dataset.act);
      toast('input → ' + b.dataset.act);
    });
  }
  const bl = $('#bondList');
  if (bl) bl.innerHTML = S.bonds.length
    ? S.bonds.map(a => `<div class="stat"><s class="mono">${a}</s>
        <span class="badge">bonded</span></div>`).join('')
    : 'no bonds stored';
  renderTypeTo();
}

function renderTypeTo() {
  const sel = $('#typeTo'); if (!sel) return;
  const want = ['all', ...S.hosts.map(h => h.addr)];
  if (sel.dataset.k !== want.join()) {
    sel.dataset.k = want.join();
    sel.innerHTML = want.map(a =>
      `<option value="${a}">${a === 'all' ? 'all hosts' : a}</option>`).join('');
  }
  sel.value = want.includes(S.typeTarget) ? S.typeTarget : 'all';
}

function renderMaps() {
  txt('mapCount', S.maps.length + '', 'r badge');
  const el = $('#mapList'); if (!el) return;
  el.innerHTML = S.maps.length ? S.maps.map(m => {
    const [src, act] = m.split('->').map(s => s.trim());
    return `<div class="stat"><s class="mono">${src}</s><b>${act || ''}</b></div>`;
  }).join('') : 'no mappings';
  /* annotate button/gesture tiles with their bound action */
  for (const m of S.maps) {
    let mm = /^buttons\.BUTTON\.(\d+)\s*->\s*(\S+)/.exec(m);
    if (mm) txt('ba_' + mm[1], mm[2].replace(/_/g, ' ').toLowerCase());
    mm = /^touch_surface\.GESTURE\.(\d+)\s*->\s*(\S+)/.exec(m);
    if (mm) txt('ga_' + mm[1], mm[2].replace(/_/g, ' ').toLowerCase());
  }
}

function renderProfile() {
  $$('#profSeg button').forEach(b => b.classList.toggle('sel', +b.dataset.p === S.profile));
  txt('ovProf', S.profile === null ? '—' : 'P' + S.profile);
}
function markSeg(id, attr, val) {
  $$('#' + id + ' button').forEach(b => b.classList.toggle('sel', b.dataset[attr] === String(val)));
}

/* ================= navigation ====================================== */
let curGroup = 'home', curPage = 'overview';
function buildNav() {
  $('#nav').innerHTML = NAV.map(g =>
    `<button data-g="${g.id}"><span class="ic">${g.ic}</span>${g.label}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => selectGroup(b.dataset.g));
  selectGroup('home', true);
}
function selectGroup(id, silent) {
  curGroup = id;
  $$('#nav button').forEach(b => b.classList.toggle('sel', b.dataset.g === id));
  const g = NAV.find(x => x.id === id);
  $('#subtabs').innerHTML = g.pages.length > 1 ? g.pages.map(([p, label]) =>
    `<button data-p="${p}">${label}</button>`).join('') : '';
  $$('#subtabs button').forEach(b => b.onclick = () => showPage(b.dataset.p));
  showPage(g.pages[0][0], silent);
}
function showPage(p, silent) {
  curPage = p;
  const g = NAV.find(x => x.pages.some(([id]) => id === p));
  if (g && g.id !== curGroup) { selectGroup(g.id); return; }
  $$('.page').forEach(e => e.classList.toggle('on', e.id === 'p-' + p && connected));
  $$('#subtabs button').forEach(b => b.classList.toggle('sel', b.dataset.p === p));
  const label = (g ? g.pages.find(([id]) => id === p) : null);
  txt('barTitle', label ? label[1] : 'XR Ring');
  if (!connected) { $('#splash').classList.add('on'); return; }
  $('#splash').classList.remove('on');
  if (!silent) {
    if (p === 'map') { send('m'); send('useprof'); }
    if (p === 'conn') { send('L'); send('active'); }
    if (p === 'diag') send('storage');
    if (p === 'set') { send('speed'); send('hidroute'); send('authmode'); send('typeto'); }
    if (p === 'btn') send('btns');
  }
  renderCurrent(); renderFactory(); renderMaps(); renderHosts(); renderMem();
}

/* ================= UI wiring ======================================= */
function wire() {
  buildNav();
  /* generic command buttons */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd],[data-cfg]');
    if (!b) return;
    if (b.dataset.cmd !== undefined) send(b.dataset.cmd);
    else send(b.dataset.cfg);
  });

  $('#btnConnect').onclick = async () => {
    try { await connect(await pickDevice(false)); }
    catch (err) { $('#spin').classList.remove('on'); txt('splashNote', err.message); }
  };
  $('#btnConnectAny').onclick = async () => {
    try { await connect(await pickDevice(true)); }
    catch (err) { $('#spin').classList.remove('on'); txt('splashNote', err.message); }
  };
  $('#btnDisconnect').onclick = () => {
    if (dev && dev.gatt.connected) dev.gatt.disconnect();
    dev = null; setLink(false, 'offline'); closeSheet();
    $$('.page').forEach(p => p.classList.remove('on'));
    $('#splash').classList.add('on');
  };

  /* profiles / mapping */
  $$('#profSeg button').forEach(b => b.onclick = () => send('useprof ' + b.dataset.p));
  const fill = (sel, arr) => { $(sel).innerHTML = arr.map(v => `<option>${v}</option>`).join(''); };
  fill('#mSrc', SOURCES); fill('#mCap', CAPS); fill('#mAct', ACTIONS);
  const subOpts = () => {
    const cap = $('#mCap').value;
    let arr = ['*'];
    if (cap === 'BUTTON') arr = ['*', ...BTN_NAMES.map((n, i) => i + '')];
    if (cap === 'GESTURE') arr = ['*', ...GESTS.map(([id]) => id + '')];
    $('#mSub').innerHTML = arr.map(v => `<option>${v}</option>`).join('');
  };
  $('#mCap').onchange = subOpts; subOpts();
  const bindLine = () => {
    const sub = $('#mSub').value;
    return `${$('#mSrc').value}.${$('#mCap').value}` + (sub && sub !== '*' ? '.' + sub : '');
  };
  $('#btnBind').onclick = () => { send(`bind ${bindLine()} ${$('#mAct').value}`); setTimeout(() => send('m'), 400); };
  $('#btnUnbind').onclick = () => { send(`unbind ${bindLine()}`); setTimeout(() => send('m'), 400); };

  /* connections */
  $('#btnForget').onclick = () => { send('Z'); toast('bonds cleared — re-pair to reconnect'); };
  $('#btnHello').onclick = () => send('hello android');
  $('#btnOsProf').onclick = () => send(`osprof ${$('#osSel').value} ${$('#osProf').value}`);

  /* settings */
  $$('#spdSeg button').forEach(b => b.onclick = () => send('speed ' + b.dataset.s));
  $$('#rateSeg button').forEach(b => b.onclick = () => send('cap ' + b.dataset.r));
  $$('#routeSeg button').forEach(b => b.onclick = () => send('hidroute ' + b.dataset.h));
  $$('#authSeg button').forEach(b => b.onclick = () => send('authmode ' + b.dataset.a));
  $('#typeTo').onchange = e => send('typeto ' + e.target.value);
  $('#btnVdiv').onclick = () => { const v = $('#vdivIn').value.trim(); if (v) send('vdiv ' + v); };
  $('#btnMacSave').onclick = () => {
    let n = 0;
    for (let i = 1; i <= 4; i++) {
      const v = $('#mac' + i).value.trim();
      if (v) { send(`setmacro ${i} ${v}`); n++; }
    }
    toast(n ? `${n} macro(s) stored` : 'nothing to store');
  };
  $('#btnWipe').onclick = () => {
    if (confirm('Factory-reset all ring settings? Bindings, calibration, ' +
                'wake-word model, macros and profiles are cleared.')) send('wipecfg');
  };

  /* trackpoint calibration */
  $('#btnCalApply').onclick = () => {
    const map = { rangexy: 'calRangexy', rangez: 'calRangez',
                  press: 'calPress', release: 'calRelease' };
    let n = 0;
    for (const k in map) {
      const v = $('#' + map[k]).value.trim();
      if (v) { send(`cal ${k} ${v}`); n++; }
    }
    toast(n ? 'calibration sent — save to keep' : 'fill a value first');
  };

  /* audio */
  $('#btnKwTh').onclick = () => { const v = $('#kwTh').value.trim(); if (v !== '') send('kws thr ' + v); };
  $('#btnPhoneType').onclick = () => {
    const t = $('#phoneDictTxt').value.trim();
    if (t) { send('type ' + t); toast('ring typing…'); }
  };
  $('#btnPhoneDict').onclick = phoneDictate;

  /* factory */
  $('#ftRunAll').onclick = () => {
    S.ft = {}; txt('ftVerdict', 'running…', 'r badge warn');
    $('#ftBody').innerHTML = ''; renderFactory(); send('selftest');
  };

  /* console */
  $('#quickChips').innerHTML = QUICK.map(c => `<button class="chip">${c}</button>`).join('');
  $$('#quickChips .chip').forEach(c => c.onclick = () => send(c.textContent));
  const doSend = () => {
    const v = $('#cmdIn').value.trim();
    if (v) { send(v); $('#cmdIn').value = ''; }
  };
  $('#btnSend').onclick = doSend;
  $('#cmdIn').addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
  $('#btnClearLog').onclick = () => { conEl().innerHTML = ''; };
  $('#btnCopyLog').onclick = async () => {
    try { await navigator.clipboard.writeText(conEl().innerText); toast('log copied'); }
    catch (e) { toast('clipboard blocked'); }
  };

  /* experiments */
  $('#dsStart').onclick = startDrift;
  $('#bpStart').onclick = startBtnTest;
  $('#lqStart').onclick = startLinkSoak;
  $('#ktLatin').onclick = () => send('type the quick brown fox 12345');
  $('#ktArabic').onclick = () => send('type مرحبا بالعالم');

  /* OTA */
  $('#otaFile').onchange = e => {
    otaImage = e.target.files[0] || null;
    $('#btnOta').disabled = !otaImage || !smpChr;
    if (otaImage) txt('otaMsg', `${otaImage.name} — ${(otaImage.size / 1024).toFixed(0)} KB`);
  };
  $('#btnOta').onclick = otaStart;

  /* sheet */
  $('#btnSheet').onclick = () => { $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); };
  $('#scrim').onclick = closeSheet;
  txt('appVer', 'v' + APP_VERSION);
  $('#seeds').innerHTML = SEEDS.map(s =>
    `<button class="seed" data-s="${s}" style="background:${s}"></button>`).join('');
  const markSeed = () => $$('.seed').forEach(b =>
    b.classList.toggle('sel', b.dataset.s === (localStorage.getItem('seed') || SEEDS[0])));
  $$('.seed').forEach(b => b.onclick = () => {
    localStorage.setItem('seed', b.dataset.s); applyTheme(); markSeed();
  });
  markSeed();
  $('#swHello').checked = localStorage.getItem('hello') !== 'off';
  $('#swHello').onchange = e => localStorage.setItem('hello', e.target.checked ? 'on' : 'off');
  $('#swWake').checked = localStorage.getItem('wakelock') === 'on';
  $('#swWake').onchange = e => {
    localStorage.setItem('wakelock', e.target.checked ? 'on' : 'off');
    keepAwake(e.target.checked);
  };

  window.addEventListener('resize', () => renderCurrent());
}
const closeSheet = () => { $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); };

/* wake lock */
let wl = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wl = await navigator.wakeLock.request('screen');
    else if (wl) { wl.release(); wl = null; }
  } catch (e) { /* denied — harmless */ }
}

/* ================= phone dictation ================================= */
function phoneDictate() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('no speech recogniser in this browser'); return; }
  const r = new SR();
  r.lang = navigator.language || 'en-US';
  r.interimResults = false; r.maxAlternatives = 1;
  txt('phoneDictState', 'listening…', 'badge warn');
  r.onresult = ev => {
    const t = ev.results[0][0].transcript;
    $('#phoneDictTxt').value = t;
    txt('phoneDictState', 'ready', 'badge ok');
  };
  r.onerror = ev => txt('phoneDictState', ev.error, 'badge bad');
  r.onend = () => { if ($('#phoneDictState').textContent === 'listening…')
    txt('phoneDictState', 'idle', 'badge'); };
  r.start();
}

/* ================= experiments ===================================== */
const expState = { drift: false, driftHid: 0 };
function startDrift() {
  expState.drift = true; expState.driftHid = 0;
  txt('dsState', 'running', 'badge warn'); txt('dsCount', '—');
  const t0 = Date.now();
  const iv = setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / 30000);
    $('#dsBar').style.width = (p * 100) + '%';
    txt('dsCount', expState.driftHid);
    if (p >= 1) {
      clearInterval(iv); expState.drift = false;
      const bad = expState.driftHid > 0;
      txt('dsState', bad ? 'phantom motion' : 'clean', 'badge ' + (bad ? 'bad' : 'ok'));
    }
  }, 250);
}
function startBtnTest() {
  const base = String(S.f.bte || '').split(',').map(Number);
  txt('bpState', 'press now', 'badge warn');
  const t0 = Date.now();
  const iv = setInterval(() => {
    const now = String(S.f.bte || '').split(',').map(Number);
    const d = now.reduce((a, v, i) => a + Math.max(0, v - (base[i] || 0)), 0);
    txt('bpCount', d);
    if (Date.now() - t0 > 5000) {
      clearInterval(iv);
      txt('bpState', d ? 'done' : 'nothing seen', 'badge ' + (d ? 'ok' : 'bad'));
    }
  }, 200);
}
function startLinkSoak() {
  const rows0 = S.telRows, t0 = Date.now();
  S.hist.gap = [];
  txt('lqState', 'walking test', 'badge warn');
  const iv = setInterval(() => {
    const secs = (Date.now() - t0) / 1000;
    const got = S.telRows - rows0, want = Math.round(secs * 4);
    txt('lqRows', `${got} / ${want}`);
    const worst = Math.max(0, ...(S.hist.gap || []));
    txt('lqGap', (worst / 1000).toFixed(1) + ' s');
    if (secs > 60) {
      clearInterval(iv);
      const ratio = got / Math.max(want, 1);
      txt('lqState', ratio > .9 ? 'solid link' : ratio > .6 ? 'lossy' : 'poor',
          'badge ' + (ratio > .9 ? 'ok' : ratio > .6 ? 'warn' : 'bad'));
    }
  }, 500);
}

/* ================= OTA over mcumgr/SMP ============================= */
let otaImage = null, smpSeq = 0, smpWaiters = new Map();

function cborEnc(obj) {
  const out = [];
  const u = (major, n) => {
    if (n < 24) out.push(major | n);
    else if (n < 256) out.push(major | 24, n);
    else if (n < 65536) out.push(major | 25, n >> 8, n & 255);
    else out.push(major | 26, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  };
  const enc1 = v => {
    if (typeof v === 'number') { u(0x00, v); }
    else if (typeof v === 'boolean') out.push(v ? 0xf5 : 0xf4);
    else if (typeof v === 'string') { const b = new TextEncoder().encode(v); u(0x60, b.length); out.push(...b); }
    else if (v instanceof Uint8Array) { u(0x40, v.length); out.push(...v); }
    else if (v && typeof v === 'object') {
      const k = Object.keys(v); u(0xa0, k.length);
      for (const key of k) { enc1(key); enc1(v[key]); }
    }
  };
  enc1(obj);
  return new Uint8Array(out);
}
function cborDec(buf) {
  let i = 0;
  const rd = () => {
    const b = buf[i++], major = b & 0xe0, ai = b & 0x1f;
    const len = () => ai < 24 ? ai : ai === 24 ? buf[i++]
      : ai === 25 ? ((buf[i++] << 8) | buf[i++])
      : ((buf[i++] << 24) | (buf[i++] << 16) | (buf[i++] << 8) | buf[i++]) >>> 0;
    if (major === 0x00) return len();
    if (major === 0x20) return -1 - len();
    if (major === 0x40) { const n = len(); const v = buf.slice(i, i + n); i += n; return v; }
    if (major === 0x60) { const n = len(); const v = new TextDecoder().decode(buf.slice(i, i + n)); i += n; return v; }
    if (major === 0x80) { const n = len(); const a = []; for (let k = 0; k < n; k++) a.push(rd()); return a; }
    if (major === 0xa0) { const n = len(); const o = {}; for (let k = 0; k < n; k++) { const key = rd(); o[key] = rd(); } return o; }
    if (b === 0xf4) return false; if (b === 0xf5) return true;
    if (b === 0xf6 || b === 0xf7) return null;
    return null;
  };
  return rd();
}
function smpFrame(op, group, id, payload) {
  const seq = (smpSeq = (smpSeq + 1) & 0xff);
  const h = new Uint8Array(8);
  h[0] = op; h[1] = 0;
  h[2] = (payload.length >> 8) & 255; h[3] = payload.length & 255;
  h[4] = (group >> 8) & 255; h[5] = group & 255;
  h[6] = seq; h[7] = id;
  const f = new Uint8Array(8 + payload.length);
  f.set(h); f.set(payload, 8);
  return { frame: f, seq };
}
let smpRx = new Uint8Array(0);
function onSmpNotify(e) {
  const v = new Uint8Array(e.target.value.buffer);
  const merged = new Uint8Array(smpRx.length + v.length);
  merged.set(smpRx); merged.set(v, smpRx.length);
  smpRx = merged;
  while (smpRx.length >= 8) {
    const len = (smpRx[2] << 8) | smpRx[3];
    if (smpRx.length < 8 + len) return;
    const seq = smpRx[6], body = smpRx.slice(8, 8 + len);
    smpRx = smpRx.slice(8 + len);
    const w = smpWaiters.get(seq);
    if (w) { smpWaiters.delete(seq); try { w.resolve(cborDec(body)); } catch (err) { w.reject(err); } }
  }
}
function smpRequest(op, group, id, obj) {
  return new Promise(async (resolve, reject) => {
    const { frame, seq } = smpFrame(op, group, id, cborEnc(obj));
    if (frame.length > 240) return reject(new Error('frame too large'));
    const to = setTimeout(() => { smpWaiters.delete(seq); reject(new Error('timeout')); }, 8000);
    smpWaiters.set(seq, { resolve: v => { clearTimeout(to); resolve(v); },
                          reject: e => { clearTimeout(to); reject(e); } });
    try { await smpChr.writeValueWithoutResponse(frame); }
    catch (e) { clearTimeout(to); smpWaiters.delete(seq); reject(e); }
  });
}
async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(h);
}
async function otaStart() {
  if (!otaImage || !smpChr) return;
  const btn = $('#btnOta'); btn.disabled = true;
  txt('otaState', 'uploading', 'badge warn');
  try {
    const data = new Uint8Array(await otaImage.arrayBuffer());
    const hash = await sha256(data);
    let off = 0, t0 = Date.now();
    while (off < data.length) {
      const first = off === 0;
      /* size the chunk so the whole SMP frame fits one GATT write */
      let chunk = first ? 96 : 160;
      let rsp = null;
      for (;;) {
        const body = first
          ? { image: 0, len: data.length, off, sha: hash.slice(0, 32),
              data: data.slice(off, off + chunk) }
          : { off, data: data.slice(off, off + chunk) };
        const enc = cborEnc(body);
        if (enc.length + 8 > 240) { chunk -= 24; continue; }
        rsp = await smpRequest(0x02, 1, 1, body);
        break;
      }
      if (rsp && rsp.rc) throw new Error('ring rejected chunk (rc=' + rsp.rc + ')');
      off = (rsp && typeof rsp.off === 'number') ? rsp.off : off + chunk;
      const pct = 100 * off / data.length;
      $('#otaBar').style.width = pct + '%';
      const kbps = off / 1024 / Math.max((Date.now() - t0) / 1000, .1);
      txt('otaState', pct.toFixed(0) + '% · ' + kbps.toFixed(1) + ' KB/s', 'badge warn');
    }
    txt('otaState', 'testing', 'badge warn');
    const st = await smpRequest(0x00, 1, 0, {});
    const slot1 = (st.images || []).find(i => i.slot === 1);
    if (!slot1) throw new Error('image not staged');
    await smpRequest(0x02, 1, 0, { hash: slot1.hash, confirm: false });
    await smpRequest(0x02, 0, 5, {});          /* reset */
    txt('otaState', 'rebooting', 'badge ok');
    txt('otaMsg', 'Ring is swapping slots. It must run 30 s to self-confirm, ' +
                  'otherwise it reverts to the previous firmware.');
  } catch (e) {
    txt('otaState', 'failed', 'badge bad');
    txt('otaMsg', 'Upload failed: ' + e.message);
  } finally { btn.disabled = false; }
}

/* ================= boot ============================================ */
wire();
if (!navigator.bluetooth) {
  $('#splash').innerHTML =
    '<div class="logo">&#9888;</div><h2>Web Bluetooth unavailable</h2>' +
    '<p>Open this app in <b>Chrome</b> (or Edge) on Android. Safari and ' +
    'iOS do not implement Web Bluetooth.</p>';
}
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js').catch(() => {});

/* test hook: feed synthetic ring output without hardware */
window.__feed = line => handleLine(line);
window.__state = S;
window.__demo = () => {          /* UI walkthrough without hardware */
  connected = true; setLink(true, 'demo ring');
  $('#splash').classList.remove('on'); showPage(curPage, true);
};
window.__page = p => showPage(p, true);
