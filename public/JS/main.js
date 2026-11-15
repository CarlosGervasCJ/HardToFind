'use strict';

const NAV_LEFT_PX = 262;
const FOV         = 720;
const ZOOM        = (1.5 * (720 / FOV)).toFixed(2);
const API_BASE    = 'https://hardtofindapi.vercel.app/api/search-spherex';

const BAND_COLORS = {
  d1:'#10b981', d2:'#06b6d4', d3:'#f59e0b',
  d4:'#f78166', d5:'#bc8cff', d6:'#38bdf8',
};

const BAND_DATA = {
  d1:{ label:'D1', wl:'0.75 – 1.10 µm', heading:'Near-Infrared Optical Boundary', desc:'Ideal for detecting low-mass stars, brown dwarfs, and young stellar objects.', flux:'142.5 mJy', snr:'31.8 σ', color:'#10b981', range:[0,18] },
  d2:{ label:'D2', wl:'1.10 – 1.60 µm', heading:'H-Band Infrared Window', desc:'Deep analysis of distant galaxies and trans-Neptunian objects with methane reflectance.', flux:'188.2 mJy', snr:'38.4 σ', color:'#06b6d4', range:[18,36] },
  d3:{ label:'D3', wl:'1.60 – 2.40 µm', heading:'K-Band Thermal Mapping', desc:'Sensitive to thermal emissions and molecular signatures of water vapor at solar system boundaries.', flux:'96.4 mJy',  snr:'27.1 σ', color:'#f59e0b', range:[36,54] },
  d4:{ label:'D4', wl:'2.40 – 3.40 µm', heading:'Mid-IR Hydrocarbon Band', desc:'Crucial range for volatile organic compounds and parallax tracking of distant gas planets.', flux:'64.1 mJy',  snr:'22.5 σ', color:'#f78166', range:[54,72] },
  d5:{ label:'D5', wl:'3.40 – 4.50 µm', heading:'Planet X Thermal Signature', desc:'Key frequency where cold gas giants exhibit blackbody emission peak at 35–40 K.', flux:'215.8 mJy', snr:'45.2 σ', color:'#bc8cff', range:[72,90] },
  d6:{ label:'D6', wl:'4.50 – 5.00 µm', heading:'Deep Thermal Infrared Limit', desc:'Upper SPHEREx limit — cosmic background scanning and highly reddened source detection.', flux:'118.9 mJy', snr:'29.6 σ', color:'#38bdf8', range:[90,108] },
};

/* Os 5 Presets Exatos com respetivas imagens */
const PRESETS = [
  {
    id: 'barnard',
    name: "Barnard's Star",
    ra: 269.45208, dec: 4.69333, band: 'd5', radius: 60, fov: '0.15°',
    type: 'Red Dwarf',
    flux: '142.5 mJy',
    desc: "Red Dwarf with extreme proper motion across the sky.",
    image: 'images/barnard.jpg'
  },
  {
    id: 'epsilon',
    name: "Epsilon Indi B",
    ra: 331.04375, dec: -56.78278, band: 'd3', radius: 60, fov: '0.20°',
    type: 'Brown Dwarf',
    flux: '188.2 mJy',
    desc: "Binary Brown Dwarf System.",
    image: 'images/epsilon.jpg'
  },
  {
    id: 'wise',
    name: "WISE 0855",
    ra: 133.79513, dec: -7.24515, band: 'd5', radius: 60, fov: '0.10°',
    type: 'Sub-Brown Dwarf',
    flux: '92.4 mJy',
    desc: "Sub-Brown Dwarf (Fast Moving).",
    image: 'images/wise0855.jpg'
  },
  {
    id: 'rw_aur',
    name: "RW Aurigae",
    ra: 76.95642, dec: 30.40142, band: 'd4', radius: 60, fov: '0.10°',
    type: 'Variable Star',
    flux: '150.0 mJy',
    desc: "Variable Star Systems.",
    image: 'images/rw_aur.jpg'
  },
  {
    id: 'r_dra',
    name: "R Draconis",
    ra: 248.16750, dec: 66.75500, band: 'd5', radius: 60, fov: '0.20°',
    type: 'Mira Variable',
    flux: '210.0 mJy',
    desc: "Mira-type Pulsating Variable Star.",
    image: 'images/r_dra.jpg'
  }
];

let configOpen   = false;
let lastResult   = null;
let fireflyReady = false;
let activeBand   = 'd5';
let barHeights   = [];
let currentPreset = PRESETS[0];

/* Elementos DOM */
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
  const h      = wvCol.offsetHeight;
  const offset = showNav ? 0 : Math.min(NAV_LEFT_PX, wvCol.offsetWidth * 0.4);
  frame.style.transition = 'margin-left 0.3s cubic-bezier(0.16,1,0.3,1)';
  frame.style.marginLeft = `-${offset}px`;
  frame.style.height     = `${h}px`;
  setTimeout(() => { frame.style.transition = ''; }, 350);
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
  setTimeout(() => { frame.src = `http://byw.tools/wiseview#${buildWVHash()}`; }, 80);
}

function initBars() {
  barHeights = Array.from({length:108}, () => 15 + Math.random() * 85);
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
      bar.style.opacity    = '0.5';
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
  if (type === 'irsa-down') {
    emptyDiv.classList.add('irsa-down');
    emptyDiv.innerHTML = `<div class="empty-icon">⚠️</div><div class="empty-title">Serviços IRSA indisponíveis</div>
      <div class="fallback-note"><strong>WiseView operacional.</strong><br><br>Visualização à esquerda ativa.<br><span style="font-size:10px;opacity:.7;">↳ ${msg||''}</span></div>`;
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
  searchBtn.textContent = '⟳';
  metaBtn.disabled = true;
  showEmpty('loading');

  try {
    const res = await fetch(`${API_BASE}?${new URLSearchParams({ra,dec,band,radius})}`);
    if (!res.ok) {
      let m = `Erro ${res.status}`;
      try { m = (await res.json()).message || m; } catch(_){}
      throw new Error(m);
    }
    const data = await res.json();
    lastResult = data;

    const record = data.data || data;
    const fitsUrl = record.fits_url || record.access_url;

    // Atualização do WiseView desativada aqui para preservar o grau de assertividade e posição manual do WiseView.

    if (fitsUrl) {
      hideEmpty();
      loadFirefly(fitsUrl);
    } else { hideEmpty(); loadFirefly(); }

    if (record.energy_bandpassname) {
      const bMatch = record.energy_bandpassname.toLowerCase();
      for (const k of Object.keys(BAND_DATA)) {
        if (bMatch.includes(k)) {
          setBand(k);
          break;
        }
      }
    } else if (data.band && BAND_DATA[data.band]) {
      setBand(data.band);
    }

    metaBtn.disabled = false;
    const sep = record.separation_arcsec;
    setStatus('ok', sep !== undefined ? `Match a ${Number(sep).toFixed(2)}″` : 'OK');

  } catch(err) {
    const msg = err.message || 'Erro desconhecido';
    const down = /irsa|caltech|timeout|network|unavailable|503|502|504/i.test(msg);
    showEmpty(down ? 'irsa-down' : 'error', msg);
    setStatus('err', down ? 'IRSA indisponível' : msg);
    loadFirefly();
  } finally {
    searchBtn.classList.remove('loading');
    searchBtn.innerHTML = '<i data-lucide="telescope" style="width:13px;height:13px"></i> Pesquisar';
    if (window.lucide) lucide.createIcons();
  }
}

function openMeta() {
  if (!lastResult) return;
  const d = lastResult.data || lastResult;
  const topInfo = {
    status: lastResult.status,
    period: lastResult.period,
    period_label: lastResult.period_label
  };

  const allParams = { ...topInfo, ...d };

  let html = `<div class="meta-section-title">Parâmetros Completos da Observação (IRSA / SPHEREx)</div>`;
  html += `<div class="meta-grid" style="grid-template-columns: 1fr 1fr; gap: 6px;">`;

  for (const [key, val] of Object.entries(allParams)) {
    if (key === 'cloud_access') continue;
    let displayVal = val;
    if (typeof val === 'boolean') displayVal = val ? 'True' : 'False';
    if (val === null || val === undefined || val === '') displayVal = '—';
    if (typeof val === 'number') displayVal = Number(val).toLocaleString(undefined, {maximumFractionDigits: 5});

    html += `
      <div class="meta-item" style="padding: 6px 8px;">
        <div class="key" style="font-size:9px; font-family:var(--font-mono); color:var(--text-muted);">${key}</div>
        <div class="val" style="font-size:11px; font-family:var(--font-mono); word-break:break-all; color:${key.includes('url') ? 'var(--cosmic-emerald)' : 'var(--text)'};">${displayVal}</div>
      </div>
    `;
  }
  html += `</div>`;

  if (d.cloud_access) {
    html += `
      <div class="meta-section-title">Cloud Access (AWS)</div>
      <div class="meta-item" style="padding: 8px; font-size:11px; font-family:var(--font-mono); word-break:break-all; color:var(--cyan-glow);">
        ${typeof d.cloud_access === 'object' ? JSON.stringify(d.cloud_access) : d.cloud_access}
      </div>
    `;
  }

  const fitsUrl = d.fits_url || d.access_url;
  if (fitsUrl) {
    html += `
      <div class="fits-url-box" id="fitsUrlBox" style="display:flex; margin-top:12px;">
        <span class="fits-url-text" id="fitsUrlText">${fitsUrl}</span>
        <button class="copy-btn" id="copyFitsBtn">copiar</button>
      </div>
      <button class="tb-btn primary" id="sendToFireflyBtn" style="width:100%; margin-top:10px; justify-content:center;">
        <i data-lucide="play" style="width:13px;height:13px"></i>
        <span>Carregar FITS diretamente no Firefly</span>
      </button>
    `;
  }

  metaGrid.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  const sendBtn = document.getElementById('sendToFireflyBtn');
  if (sendBtn && fitsUrl) {
    sendBtn.addEventListener('click', () => {
      loadFirefly(fitsUrl);
      closeMeta();
      setStatus('ok', 'FITS carregado no Firefly com sucesso!');
    });
  }

  const copyBtnEl = document.getElementById('copyFitsBtn');
  if (copyBtnEl && fitsUrl) {
    copyBtnEl.addEventListener('click', () => {
      navigator.clipboard.writeText(fitsUrl).then(() => {
        copyBtnEl.textContent = '✓ copiado';
        setTimeout(() => { copyBtnEl.textContent = 'copiar'; }, 1500);
      });
    });
  }

  metaOverlay.classList.add('visible');
}

function closeMeta() { metaOverlay.classList.remove('visible'); }

searchBtn.addEventListener('click', () => { loadWiseView(); searchSPHEREx(); });

configBtn.addEventListener('click', () => {
  configOpen = !configOpen;
  configBtn.querySelector('span') && (configBtn.querySelector('span').textContent = configOpen ? 'Fechar config.' : 'Config. WiseView');
  applyWVLayout(configOpen);
});

metaBtn.addEventListener('click', openMeta);
metaClose.addEventListener('click', closeMeta);
metaOverlay.addEventListener('click', e => { if(e.target===metaOverlay) closeMeta(); });

document.getElementById('bandInput')?.addEventListener('change', e => setBand(e.target.value));

['raInput','decInput','bandInput','radiusInput','speedInput'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if(e.key==='Enter') { loadWiseView(); searchSPHEREx(); }
  });
});

window.addEventListener('resize', () => applyWVLayout(configOpen));

initPresets();
initBars();
setBand(activeBand);
applyWVLayout(false);
