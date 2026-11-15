'use strict';

const NAV_LEFT_PX = 262;
const FOV         = 720;
const ZOOM        = (1.5 * (720 / FOV)).toFixed(2);
const API_BASE    = 'https://hardtofindapi.vercel.app/api/search-spherex';

const BAND_DATA = {
  d1:{ label:'D1', wl:'0.75 – 1.10 µm', heading:'Near-Infrared Optical Boundary', desc:'Ideal for detecting low-mass stars, brown dwarfs, and young stellar objects.', flux:'142.5 mJy', snr:'31.8 σ', color:'#10b981', range:[0,17] },
  d2:{ label:'D2', wl:'1.10 – 1.60 µm', heading:'H-Band Infrared Window', desc:'Deep analysis of distant galaxies and trans-Neptunian objects with methane reflectance.', flux:'188.2 mJy', snr:'38.4 σ', color:'#06b6d4', range:[17,34] },
  d3:{ label:'D3', wl:'1.60 – 2.40 µm', heading:'K-Band Thermal Mapping', desc:'Sensitive to thermal emissions and molecular signatures of water vapor at solar system boundaries.', flux:'96.4 mJy',  snr:'27.1 σ', color:'#f59e0b', range:[34,51] },
  d4:{ label:'D4', wl:'2.40 – 3.40 µm', heading:'Mid-IR Hydrocarbon Band', desc:'Crucial range for volatile organic compounds and parallax tracking of distant gas planets.', flux:'64.1 mJy',  snr:'22.5 σ', color:'#f78166', range:[51,68] },
  d5:{ label:'D5', wl:'3.40 – 4.50 µm', heading:'Planet X Thermal Signature', desc:'Key frequency where cold gas giants exhibit blackbody emission peak at 35–40 K.', flux:'215.8 mJy', snr:'45.2 σ', color:'#bc8cff', range:[68,85] },
  d6:{ label:'D6', wl:'4.50 – 5.00 µm', heading:'Deep Thermal Infrared Limit', desc:'Upper SPHEREx limit — cosmic background scanning and highly reddened source detection.', flux:'118.9 mJy', snr:'29.6 σ', color:'#38bdf8', range:[85,102] },
};

const PRESETS = [
  { id: 'barnard', name: "Barnard's Star", ra: 269.45208, dec: 4.69333, band: 'd5', radius: 60, fov: '0.15°', type: 'Red Dwarf', flux: '142.5 mJy', desc: "Red Dwarf with extreme proper motion across the sky.", image: 'images/barnard.jpg' },
  { id: 'epsilon', name: "Epsilon Indi B", ra: 331.04375, dec: -56.78278, band: 'd3', radius: 60, fov: '0.20°', type: 'Brown Dwarf', flux: '188.2 mJy', desc: "Binary Brown Dwarf System.", image: 'images/epsilon.jpg' },
  { id: 'wise', name: "WISE 0855", ra: 133.79513, dec: -7.24515, band: 'd5', radius: 60, fov: '0.10°', type: 'Sub-Brown Dwarf', flux: '92.4 mJy', desc: "Sub-Brown Dwarf (Fast Moving).", image: 'images/wise0855.jpg' },
  { id: 'rw_aur', name: "RW Aurigae", ra: 76.95642, dec: 30.40142, band: 'd4', radius: 60, fov: '0.10°', type: 'Variable Star', flux: '150.0 mJy', desc: "Variable Star Systems.", image: 'images/rw_aur.jpg' },
  { id: 'r_dra', name: "R Draconis", ra: 248.16750, dec: 66.75500, band: 'd5', radius: 60, fov: '0.20°', type: 'Mira Variable', flux: '210.0 mJy', desc: "Mira-type Pulsating Variable Star.", image: 'images/r_dra.jpg' }
];

let configOpen   = false;
let lastResult   = null;
let fireflyReady = false;
let activeBand   = 'd5';
let barHeights   = [];
let currentPreset = PRESETS[0];

/* Elementos DOM principais */
const frame       = document.getElementById('wvFrame');
const wvCol       = document.getElementById('wv-col');
const statusDot   = document.getElementById('statusDot');
const statusText  = document.getElementById('statusText');
const searchBtn   = document.getElementById('searchBtn');
const configBtn   = document.getElementById('configBtn');
const metaBtn     = document.getElementById('metaBtn');
const emptyDiv    = document.getElementById('spherex-empty');
const metaOverlay = document.getElementById('meta-overlay');
const metaClose   = document.getElementById('metaClose');
const metaGrid    = document.getElementById('metaGrid');
const specBars    = document.getElementById('spectrum-bars');

const presetSelect   = document.getElementById('presetSelect');
const applyPresetBtn = document.getElementById('applyPresetBtn');
const targetNameEl   = document.getElementById('targetName');
const targetCoordsEl = document.getElementById('targetCoords');
const targetDescEl   = document.getElementById('targetDesc');
const targetTypeEl   = document.getElementById('targetType');
const targetFovEl    = document.getElementById('targetFov');
const targetBandEl   = document.getElementById('targetBand');
const targetFluxEl   = document.getElementById('targetFlux');
const targetImgEl    = document.getElementById('targetImg');

/* Mobile Drawer Controls */
const mobileToggle = document.getElementById('mobile-menu-toggle');
const mobileDrawer = document.getElementById('mobileDrawer');
const mobileOverlay = document.getElementById('mobileDrawerOverlay');
const closeMobileDrawer = document.getElementById('closeMobileDrawer');
const searchBtnMobile = document.getElementById('searchBtnMobile');

function toggleMobileDrawer(open) {
  if (open) {
    mobileDrawer.classList.add('is-open');
    mobileOverlay.classList.add('is-active');
  } else {
    mobileDrawer.classList.remove('is-open');
    mobileOverlay.classList.remove('is-active');
  }
}

function syncInputs(source) {
  if (source === 'mobile') {
    document.getElementById('raInput').value = document.getElementById('raInputMobile').value;
    document.getElementById('decInput').value = document.getElementById('decInputMobile').value;
    document.getElementById('bandInput').value = document.getElementById('bandInputMobile').value;
    document.getElementById('radiusInput').value = document.getElementById('radiusInputMobile').value;
    document.getElementById('speedInput').value = document.getElementById('speedInputMobile').value;
  } else {
    document.getElementById('raInputMobile').value = document.getElementById('raInput').value;
    document.getElementById('decInputMobile').value = document.getElementById('decInput').value;
    document.getElementById('bandInputMobile').value = document.getElementById('bandInput').value;
    document.getElementById('radiusInputMobile').value = document.getElementById('radiusInput').value;
    document.getElementById('speedInputMobile').value = document.getElementById('speedInput').value;
  }
}

mobileToggle?.addEventListener('click', () => { syncInputs('desktop'); toggleMobileDrawer(true); });
closeMobileDrawer?.addEventListener('click', () => toggleMobileDrawer(false));
mobileOverlay?.addEventListener('click', () => toggleMobileDrawer(false));

searchBtnMobile?.addEventListener('click', () => {
  syncInputs('mobile');
  toggleMobileDrawer(false);
  loadWiseView();
  searchSPHEREx();
});

function initPresets() {
  if (!presetSelect) return;
  PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    presetSelect.appendChild(opt);
  });

  presetSelect.value = currentPreset.id;
  updateTargetCard(currentPreset);

  presetSelect.addEventListener('change', e => {
    const found = PRESETS.find(p => p.id === e.target.value);
    if (!found) return;
    currentPreset = found;
    updateTargetCard(found);
    loadSelectedPresetToObservatory();
  });

  applyPresetBtn.addEventListener('click', () => {
    loadSelectedPresetToObservatory();
  });
}

function updateTargetCard(p) {
  targetNameEl.textContent   = p.name;
  targetCoordsEl.textContent = `RA: ${p.ra.toFixed(5)}° | Dec: ${(p.dec >= 0 ? '+' : '')}${p.dec.toFixed(5)}°`;
  targetDescEl.textContent   = p.desc;
  targetTypeEl.textContent   = p.type;
  targetFovEl.textContent    = p.fov;
  targetBandEl.textContent   = p.band.toUpperCase();
  targetFluxEl.textContent   = p.flux;

  if (p.image) {
    targetImgEl.style.display = 'block';
    targetImgEl.src = p.image;
  } else {
    targetImgEl.style.display = 'none';
  }
}

function loadSelectedPresetToObservatory() {
  if (!currentPreset) return;
  document.getElementById('raInput').value     = currentPreset.ra;
  document.getElementById('decInput').value    = currentPreset.dec;
  document.getElementById('bandInput').value   = currentPreset.band;
  document.getElementById('radiusInput').value = currentPreset.radius;
  syncInputs('desktop');

  setBand(currentPreset.band);
  loadWiseView();
  searchSPHEREx();
}

window.onFireflyLoaded = function () { fireflyReady = true; };

function loadFirefly(fitsUrl) {
  if (!fireflyReady || !window.firefly) return;
  window.firefly.showImage('fireflyDisplay', {
    URL: fitsUrl || 'https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/00/0014/00140a137-w1-int-3.fits',
    Title: currentPreset ? currentPreset.name : 'SPHEREx Target',
    PlotId: 'spherex_plot',
    ZoomType: 'TO_WIDTH', ColorTable: 2, StretchType: 'ZScale',
  });
}

function applyWVLayout(showNav) {
  if (window.innerWidth <= 1024) {
    frame.style.marginLeft = '0px';
    frame.style.height = '100%';
    return;
  }
  const h      = wvCol.offsetHeight;
  const offset = showNav ? 0 : Math.min(NAV_LEFT_PX, wvCol.offsetWidth * 0.4);
  frame.style.marginTransform = `translate3d(-${offset}px, 0, 0)`;
  frame.style.height = `${h}px`;
}

function buildWVHash() {
  const ra    = document.getElementById('raInput').value  || '269.452';
  const dec   = document.getElementById('decInput').value || '4.693';
  const speed = document.getElementById('speedInput').value || '400';
  return [`ra=${ra}`,`dec=${dec}`,`size=${FOV}`,`band=3`,
    `speed=${speed}`,`zoom=${ZOOM}`,`invert=0`,`border=0`,
    `gaia=0`,`diff=0`,`neowise=0`,`maxdyr=0`,
    `minbright=-50`,`maxbright=500`,`linear=1`,`window=0.5`].join('&');
}

function loadWiseView() {
  applyWVLayout(false);
  frame.src = '';
  setTimeout(() => { frame.src = `https://shy-sun-1a2f.carlosgervasio745.workers.dev/#${buildWVHash()}`; }, 80);
}

function initBars() {
  barHeights = Array.from({length: 102}, () => 15 + Math.random() * 85);
  specBars.innerHTML = '';
  barHeights.forEach((h, i) => {
    const bar = document.createElement('div');
    bar.className = 'spec-bar';
    bar.id = `bar-${i}`;
    bar.style.height = `${h}%`;
    specBars.appendChild(bar);
  });
}

function setBand(bandKey) {
  activeBand = bandKey;
  const bd = BAND_DATA[bandKey];

  document.querySelectorAll('.band-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.band === bandKey);
  });

  document.getElementById('spec-band-label').textContent = `SPHEREx Band: spherex-${bandKey}`;
  document.getElementById('spec-band-wl').textContent    = bd.wl;
  document.getElementById('spec-heading').textContent    = bd.heading;
  document.getElementById('spec-desc').textContent       = bd.desc;
  document.getElementById('spec-flux').textContent       = bd.flux;
  document.getElementById('spec-snr').textContent        = bd.snr;
  document.getElementById('active-channel-label').textContent = `Active: ${bd.label}`;

  const [start, end] = bd.range;
  document.querySelectorAll('.spec-bar').forEach((bar, i) => {
    if (i >= start && i < end) {
      bar.classList.add('active-group');
      bar.style.background = bd.color;
      bar.style.opacity    = '1';
    } else {
      bar.classList.remove('active-group');
      bar.style.background = 'rgba(16,185,129,0.25)';
      bar.style.opacity    = '0.4';
    }
  });

  const topbarBand = document.getElementById('bandInput');
  if (topbarBand && topbarBand.value !== bandKey) topbarBand.value = bandKey;
}

function setStatus(state, msg) {
  statusDot.className = 'status-dot' + (state==='busy'?' busy':state==='err'?' err':'');
  statusText.textContent = msg;
}

function showEmpty(type, msg) {
  emptyDiv.style.display = 'flex';
  emptyDiv.className = '';
  if (type === 'loading') {
    emptyDiv.innerHTML = `<div class="empty-icon" style="opacity:.35">⏳</div><div class="empty-title">Consultando IRSA…</div>`;
    return;
  }
  emptyDiv.innerHTML = `<div class="empty-icon">❌</div><div class="empty-title" style="color:var(--danger)">Erro na pesquisa</div><div class="fallback-note">${msg||''}</div>`;
}

function hideEmpty() { emptyDiv.style.display = 'none'; }

async function searchSPHEREx() {
  const ra     = document.getElementById('raInput').value;
  const dec    = document.getElementById('decInput').value;
  const band   = document.getElementById('bandInput').value;
  const radius = document.getElementById('radiusInput').value;

  if (!ra || !dec) { setStatus('err','RA e Dec são obrigatórios'); return; }

  setStatus('busy','Consultando IRSA…');
  searchBtn.classList.add('loading');
  metaBtn.disabled = true;
  showEmpty('loading');

  try {
    const res = await fetch(`${API_BASE}?${new URLSearchParams({ra,dec,band,radius})}`);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const data = await res.json();
    lastResult = data;
    const record = data.data || data;
    const fitsUrl = record.fits_url || record.access_url;

    hideEmpty();
    loadFirefly(fitsUrl);

    metaBtn.disabled = false;
    setStatus('ok', 'OK');

  } catch(err) {
    showEmpty('error', err.message);
    setStatus('err', 'Erro na consulta');
    loadFirefly();
  } finally {
    searchBtn.classList.remove('loading');
  }
}

function openMeta() {
  if (!lastResult) return;
  const d = lastResult.data || lastResult;
  let html = `<div class="meta-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 6px;">`;
  for (const [key, val] of Object.entries(d)) {
    html += `<div class="meta-item"><div class="key">${key}</div><div class="val">${val}</div></div>`;
  }
  html += `</div>`;
  metaGrid.innerHTML = html;
  metaOverlay.classList.add('visible');
}

function closeMeta() { metaOverlay.classList.remove('visible'); }

searchBtn?.addEventListener('click', () => { loadWiseView(); searchSPHEREx(); });
configBtn?.addEventListener('click', () => {
  configOpen = !configOpen;
  applyWVLayout(configOpen);
});

metaBtn?.addEventListener('click', openMeta);
metaClose?.addEventListener('click', closeMeta);
metaOverlay?.addEventListener('click', e => { if(e.target===metaOverlay) closeMeta(); });

window.addEventListener('resize', () => applyWVLayout(configOpen));

initPresets();
initBars();
setBand(activeBand);
applyWVLayout(false);
