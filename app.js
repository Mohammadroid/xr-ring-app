/* XR Ring companion — PWA over Web Bluetooth.
 *
 * Talks DIRECTLY to the ring's telemetry GATT service (no PC, no
 * server): TXT notifications carry TEL rows + console lines, CMD
 * writes carry the same console grammar the bench speaks.
 */
'use strict';

const APP_VERSION = '1.0.0';
const SVC = '8f5a1b20-6d31-4c9e-9b77-1f2ad3c40002';
const CHR_TXT = '8f5a1b20-6d31-4c9e-9b77-1f2ad3c40003';
const CHR_CMD = '8f5a1b20-6d31-4c9e-9b77-1f2ad3c40004';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ================= Material 3 tonal palette from a seed =============
 * True Material-You wallpaper color is not reachable from the web; a
 * seed picker with tonal derivation is the honest web equivalent. */
const SEEDS = ['#6750A4', '#0B57D0', '#146C2E', '#B3261E', '#7D5260', '#E8710A'];

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s * 100, l * 100];
}
const tone = (h, s, l) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l}%)`;

function applyTheme() {
  const seed = localStorage.getItem('seed') || SEEDS[0];
  const [h, s] = hexToHsl(seed);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const R = document.documentElement.style;
  const set = (k, v) => R.setProperty(k, v);
  if (dark) {
    set('--surface', tone(h, 15, 8));
    set('--surface-1', tone(h, 14, 13));
    set('--surface-2', tone(h, 13, 18));
    set('--on-surface', tone(h, 12, 92));
    set('--on-surface-var', tone(h, 10, 72));
    set('--primary', tone(h, Math.max(s, 45), 80));
    set('--on-primary', tone(h, 40, 18));
    set('--secondary-c', tone(h, 22, 26));
    set('--on-secondary-c', tone(h, 20, 88));
    set('--outline', tone(h, 8, 40));
    set('--inverse-surface', tone(h, 12, 90));
    set('--inverse-on-surface', tone(h, 14, 14));
  } else {
    set('--surface', tone(h, 30, 98));
    set('--surface-1', tone(h, 28, 95));
    set('--surface-2', tone(h, 26, 91));
    set('--on-surface', tone(h, 25, 12));
    set('--on-surface-var', tone(h, 12, 35));
    set('--primary', tone(h, Math.max(s, 45), 40));
    set('--on-primary', '#ffffff');
    set('--secondary-c', tone(h, 32, 88));
    set('--on-secondary-c', tone(h, 30, 16));
    set('--outline', tone(h, 10, 55));
    set('--inverse-surface', tone(h, 14, 18));
    set('--inverse-on-surface', tone(h, 16, 94));
  }
  set('--ok', dark ? '#7ddb8a' : '#146C2E');
  set('--error', dark ? '#ffb4ab' : '#B3261E');
  document.querySelector('meta[name=theme-color]')
    .setAttribute('content', dark ? tone(h, 15, 8) : tone(h, 30, 98));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

/* ================= BLE core ======================================== */
let dev = null, cmdChr = null, connected = false;
let rxBuf = '';
const dec = new TextDecoder(), enc = new TextEncoder();

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

function setLink(on, txt) {
  connected = on;
  $('#linkChip').classList.toggle('on', on);
  $('#linkTxt').textContent = txt;
}

async function pickDevice(anyMode) {
  const opts = anyMode
    ? { acceptAllDevices: true, optionalServices: [SVC, 'battery_service'] }
    : { filters: [{ namePrefix: 'XR Ring' }],
        optionalServices: [SVC, 'battery_service'] };
  return navigator.bluetooth.requestDevice(opts);
}

async function connect(device) {
  setLink(false, 'connecting…');
  $('#spin').style.display = 'block';
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService(SVC);
  const txt = await svc.getCharacteristic(CHR_TXT);
  cmdChr = await svc.getCharacteristic(CHR_CMD);
  await txt.startNotifications();
  txt.addEventListener('characteristicvaluechanged', e => {
    rxBuf += dec.decode(e.target.value);
    let i;
    while ((i = rxBuf.indexOf('\n')) >= 0) {
      handleLine(rxBuf.slice(0, i).trim());
      rxBuf = rxBuf.slice(i + 1);
    }
  });
  device.addEventListener('gattserverdisconnected', onDisconnected,
                          { once: true });
  dev = device;
  setLink(true, device.name || 'ring');
  $('#spin').style.display = 'none';
  $('#splash').style.display = 'none';
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#page-' + currentPage).classList.add('active');
  send('?');
  if (localStorage.getItem('autoHello') !== 'off')
    setTimeout(() => send('hello android'), 800);
  setTimeout(() => send('L'), 1500);
}

let retryTimer = null;
function onDisconnected() {
  setLink(false, 'reconnecting…');
  const attempt = async (n) => {
    if (!dev || connected) return;
    try { await connect(dev); toast('reconnected'); }
    catch (e) {
      if (n < 8) retryTimer = setTimeout(() => attempt(n + 1),
                                         Math.min(1000 * 2 ** n, 15000));
      else setLink(false, 'disconnected');
    }
  };
  attempt(0);
}

async function send(line) {
  if (!cmdChr) { toast('not connected'); return; }
  try {
    const bytes = enc.encode(line + '\n');
    // chunk under a conservative 100 B (ring reassembles on newline)
    for (let o = 0; o < bytes.length; o += 100) {
      const part = bytes.slice(o, o + 100);
      if (cmdChr.writeValueWithoutResponse)
        await cmdChr.writeValueWithoutResponse(part);
      else await cmdChr.writeValue(part);
    }
    if (line.length === 1 || !line.startsWith('TEL'))
      logLine('> ' + line, true);
  } catch (e) { toast('write failed: ' + e.message); }
}

/* ================= line handling =================================== */
const state = { fields: {}, hosts: [] };
let pendingHosts = null;

function handleLine(line) {
  if (!line) return;
  if (line.startsWith('TEL ')) {
    for (const kv of line.slice(4).split(' ')) {
      const i = kv.indexOf('=');
      if (i > 0) state.fields[kv.slice(0, i)] = kv.slice(i + 1);
    }
    renderTel();
    return;
  }
  if (line.startsWith('CONN ') || line.startsWith('BOND ')) {
    if (!pendingHosts) pendingHosts = [];
    if (line.startsWith('CONN ')) {
      const kv = {};
      const parts = line.split(' ');
      for (const p of parts) {
        const i = p.indexOf('=');
        if (i > 0) kv[p.slice(0, i)] = p.slice(i + 1);
      }
      const addr = parts.filter(p => p.includes(':')).join('');
      pendingHosts.push({
        addr: addr.slice(0, 17),
        secured: kv.sec === '1',
        ci: (parseInt(kv.ci || 0) * 1.25).toFixed(1),
      });
    }
    return;
  }
  if (line === 'CONNEND' || line === 'BONDEND') {
    if (pendingHosts) { state.hosts = pendingHosts; pendingHosts = null; renderHosts(); }
    return;
  }
  logLine(line, false);
  const m = line.match(/\[prof\] profile (\d) active/);
  if (m) markProfile(+m[1]);
  const m2 = line.match(/^\[xr\] gen0 fw=(\S+)/);
  if (m2) { state.fields.fw = m2[1]; renderTel(); }
}

/* ================= rendering ======================================= */
function renderTel() {
  const f = state.fields;
  const vbt = +f.vbt || 0, vbp = +f.vbp;
  const usb = vbt > 4400, none = vbt && vbt < 2800;
  if (vbp !== undefined && !isNaN(vbp)) {
    $('#batPct').textContent = usb ? '⚡' : vbp + '%';
    $('#batV').textContent = usb ? 'USB power'
      : none ? 'no cell' : (vbt / 1000).toFixed(2) + ' V';
    const off = 327 - 327 * (usb ? 1 : vbp) / 100;
    $('#gArc').style.strokeDashoffset = off;
    $('#gArc').style.stroke = (!usb && vbp <= 15)
      ? 'var(--error)' : 'var(--primary)';
  }
  if (f.fw) $('#fFw').textContent = f.fw;
  $('#fPwr').textContent = f.ps === '0' ? 'active'
    : f.ps === '1' ? 'active' : f.ps === '2' ? 'rest' : f.ps ?? '—';
  $('#fTel').textContent = 'live';
  const H = (v, okv) => v === undefined ? '—' : (v === okv ? 'ok' : v);
  $('#sTp').textContent = H(f.trackpoint, 'ok');
  $('#sSc').textContent = H(f.scroll_surface, 'ok');
  $('#sImu').textContent = H(f.imu, 'ok');
  $('#sTo').textContent = H(f.touch_surface, 'ok');
}

function renderHosts() {
  const mk = (el, withRadio) => {
    el.innerHTML = state.hosts.length ? '' : 'no hosts connected';
    for (const h of state.hosts) {
      const row = document.createElement('div');
      row.className = 'hostrow';
      row.innerHTML =
        `<span class="addr">${h.addr}</span>` +
        `<span style="font-size:12px;color:var(--on-surface-var)">` +
        `${h.secured ? '🔒 ' + h.ci + ' ms' : 'linking…'}</span>` +
        (withRadio
          ? `<button class="btn tonal small" data-act="${h.addr}">make active</button>`
          : '');
      el.appendChild(row);
    }
    if (withRadio)
      el.querySelectorAll('[data-act]').forEach(b =>
        b.onclick = () => { send('active ' + b.dataset.act); toast('active: ' + b.dataset.act); });
  };
  mk($('#hostList'), false);
  mk($('#kvmList'), true);
}

const consoleEl = $('#console');
function logLine(s, isCmd) {
  const stick = consoleEl.scrollTop + consoleEl.clientHeight >=
                consoleEl.scrollHeight - 12;
  const div = document.createElement('div');
  div.textContent = s;
  if (isCmd) div.style.color = 'var(--primary)';
  consoleEl.appendChild(div);
  while (consoleEl.childNodes.length > 400)
    consoleEl.removeChild(consoleEl.firstChild);
  if (stick) consoleEl.scrollTop = consoleEl.scrollHeight;
}

function markProfile(n) {
  $$('#profSeg button').forEach(b =>
    b.classList.toggle('sel', +b.dataset.p === n));
  $('#fProf').textContent = 'P' + n;
}

/* ================= UI wiring ======================================= */
let currentPage = 'status';
$$('#nav button').forEach(b => b.onclick = () => {
  currentPage = b.dataset.page;
  $$('#nav button').forEach(x => x.classList.toggle('sel', x === b));
  $$('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + currentPage));
  if (!connected) return;
  if (currentPage === 'status' || currentPage === 'control') send('L');
});

$('#btnConnect').onclick = async () => {
  try { await connect(await pickDevice(false)); }
  catch (e) { $('#spin').style.display = 'none'; toast(e.message); }
};
$('#btnConnectAny').onclick = async () => {
  try { await connect(await pickDevice(true)); }
  catch (e) { $('#spin').style.display = 'none'; toast(e.message); }
};
$('#btnDisconnect').onclick = () => {
  if (dev?.gatt.connected) dev.gatt.disconnect();
  dev = null; clearTimeout(retryTimer);
  setLink(false, 'disconnected');
  closeSheet();
  $('#splash').style.display = 'flex';
  $$('.page').forEach(p => p.classList.remove('active'));
};

$$('#profSeg button').forEach(b =>
  b.onclick = () => send('useprof ' + b.dataset.p));
$('#btnAllHosts').onclick = () => { send('active all'); toast('broadcasting to all hosts'); };
$('#btnHosts').onclick = () => send('L');
$$('[data-cc]').forEach(b => b.onclick = () => send('cc ' + b.dataset.cc));
$('#btnMacSave').onclick = () => {
  for (let i = 1; i <= 4; i++) {
    const v = $('#mac' + i).value.trim();
    if (v) send(`setmacro ${i} ${v}`);
  }
  toast('macros stored on ring');
};
$$('#quickChips .chip').forEach(c =>
  c.onclick = () => { send(c.dataset.cmd); });
$('#cmdIn').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    send(e.target.value.trim());
    e.target.value = '';
  }
});

/* settings sheet */
const sheet = $('#sheet'), scrim = $('#scrim');
const closeSheet = () => { sheet.classList.remove('open'); scrim.classList.remove('open'); };
$('#btnSettings').onclick = () => { sheet.classList.add('open'); scrim.classList.add('open'); };
scrim.onclick = closeSheet;
$('#appVer').textContent = 'app v' + APP_VERSION;

const seedsEl = $('#seeds');
for (const s of SEEDS) {
  const b = document.createElement('button');
  b.className = 'seed';
  b.style.background = s;
  if ((localStorage.getItem('seed') || SEEDS[0]) === s) b.classList.add('sel');
  b.onclick = () => {
    localStorage.setItem('seed', s);
    $$('.seed').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    applyTheme();
  };
  seedsEl.appendChild(b);
}
$('#swHello').checked = localStorage.getItem('autoHello') !== 'off';
$('#swHello').onchange = e =>
  localStorage.setItem('autoHello', e.target.checked ? 'on' : 'off');

/* capability check */
if (!navigator.bluetooth) {
  $('#splash').innerHTML =
    '<div class="ringlogo">&#9888;</div><p><b>Web Bluetooth unavailable</b></p>' +
    '<p>Open this app in <b>Chrome on Android</b> (or Edge). ' +
    'iOS Safari does not support Web Bluetooth.</p>';
}

/* PWA */
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js');
