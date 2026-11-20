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
  d1:{ label:'D1', wl:'0.75 – 1.10 µm', heading:{pt:'Fonte Ótica de Infravermelho Próximo', en:'Near-Infrared Optical Boundary'}, desc:{pt:'Ideal para detetagem de estrelas de baixa massa, anãs castanhas e objetos estelares jovens.', en:'Ideal for detecting low-mass stars, brown dwarfs, and young stellar objects.'}, flux:'142.5 mJy', snr:'31.8 σ', color:'#10b981', range:[0,17] },
  d2:{ label:'D2', wl:'1.10 – 1.60 µm', heading:{pt:'Janela de Infravermelhos Banda H', en:'H-Band Infrared Window'}, desc:{pt:'Análise profunda de galáxias distantes e objetos transnetunianos com reflectância de metano.', en:'Deep analysis of distant galaxies and trans-Neptunian objects with methane reflectance.'}, flux:'188.2 mJy', snr:'38.4 σ', color:'#06b6d4', range:[17,34] },
  d3:{ label:'D3', wl:'1.60 – 2.40 µm', heading:{pt:'Mapeamento Térmico Banda K', en:'K-Band Thermal Mapping'}, desc:{pt:'Sensível a emissões térmicas e assinaturas moleculares de vapor de água nos limites do sistema solar.', en:'Sensitive to thermal emissions and molecular signatures of water vapor at solar system boundaries.'}, flux:'96.4 mJy',  snr:'27.1 σ', color:'#f59e0b', range:[34,51] },
  d4:{ label:'D4', wl:'2.40 – 3.40 µm', heading:{pt:'Banda de Hidrocarbonetos do Infravermelho Médio', en:'Mid-IR Hydrocarbon Band'}, desc:{pt:'Gama crucial para compostos orgânicos voláteis e rastreamento de paralaxe de planetas gasosos distantes.', en:'Crucial range for volatile organic compounds and parallax tracking of distant gas planets.'}, flux:'64.1 mJy',  snr:'22.5 σ', color:'#f78166', range:[51,68] },
  d5:{ label:'D5', wl:'3.40 – 4.50 µm', heading:{pt:'Assinatura Térmica do Planeta X', en:'Planet X Thermal Signature'}, desc:{pt:'Frequência-chave onde gigantes gasosos frios exibem pico de emissão de corpo negro a 35–40 K.', en:'Key frequency where cold gas giants exhibit blackbody emission peak at 35–40 K.'}, flux:'215.8 mJy', snr:'45.2 σ', color:'#bc8cff', range:[68,85] },
  d6:{ label:'D6', wl:'4.50 – 5.00 µm', heading:{pt:'Limite Profundo de Infravermelho Térmico', en:'Deep Thermal Infrared Limit'}, desc:{pt:'Limite superior do SPHEREx — varredura de fundo cósmico e deteção de fontes altamente avermelhadas.', en:'Upper SPHEREx limit — cosmic background scanning and highly reddened source detection.'}, flux:'118.9 mJy', snr:'29.6 σ', color:'#38bdf8', range:[85,102] },
};

let currentLang = 'pt';

const TRANSLATIONS = {
  pt: {
    nav_home: 'Início',
    nav_band: 'Banda',
    nav_radius: 'Raio (″)',
    nav_blink: 'Blink (ms)',
    nav_search: 'Pesquisar',
    nav_config: 'Config. WiseView',
    status_ready: 'pronto',
    col2_subtitle: 'Alvos Astronómicos',
    preset_select_label: 'Selecionar Alvo',
    preset_default_option: '-- Escolher alvo pré-definido --',
    image_placeholder: 'Fundo Preto / Pré-visualização',
    card_type: 'Tipo',
    card_fov: 'FOV Recomendado',
    card_band: 'Banda Ideal',
    card_flux: 'Fluxo Térmico',
    btn_load_observatory: 'Carregar no Observatório',
    btn_metadata: 'Metadados',
    empty_title: 'Aguardando pesquisa',
    empty_desc: 'Selecione um preset ou insira coordenadas e clique em Pesquisar',
    spec_title: 'Espectroscópio',
    spec_active_band: 'Banda activa',
    spec_thermal_flux: 'Fluxo Térmico',
    meta_panel_title: 'Metadados da observação',
    btn_copy: 'copiar',
    status_consulting: 'Consultando IRSA…',
    status_irsa_down: 'IRSA indisponível',
    status_missing_coords: 'RA e Dec são obrigatórios'
  },
  en: {
    nav_home: 'Home',
    nav_band: 'Band',
    nav_radius: 'Radius (″)',
    nav_blink: 'Blink (ms)',
    nav_search: 'Search',
    nav_config: 'WiseView Config',
    status_ready: 'ready',
    col2_subtitle: 'Astronomical Targets',
    preset_select_label: 'Select Target',
    preset_default_option: '-- Choose preset target --',
    image_placeholder: 'Black Background / Preview',
    card_type: 'Type',
    card_fov: 'Recommended FOV',
    card_band: 'Ideal Band',
    card_flux: 'Thermal Flux',
    btn_load_observatory: 'Load to Observatory',
    btn_metadata: 'Metadata',
    empty_title: 'Awaiting search',
    empty_desc: 'Select a preset or enter coordinates and click Search',
    spec_title: 'Spectrometer',
    spec_active_band: 'Active band',
    spec_thermal_flux: 'Thermal Flux',
    meta_panel_title: 'Observation Metadata',
    btn_copy: 'copy',
    status_consulting: 'Consulting IRSA…',
    status_irsa_down: 'IRSA unavailable',
    status_missing_coords: 'RA and Dec are required'
  }
};

const PRESETS = [
  {
    id: 'barnard',
    name: "Barnard's Star",
    ra: 269.45208, dec: 4.69333, band: 'd5', radius: 60, fov: '0.15°',
    type: 'Red Dwarf',
    flux: '142.5 mJy',
    desc: {
      pt: "Anã Vermelha com movimento próprio extremo através do céu.",
      en: "Red Dwarf with extreme proper motion across the sky."
    },
    image: 'images/barnard.png'
  },
  {
    id: 'epsilon',
    name: "Epsilon Indi B",
    ra: 331.04375, dec: -56.78278, band: 'd3', radius: 60, fov: '0.20°',
    type: 'Brown Dwarf',
    flux: '188.2 mJy',
    desc: {
      pt: "Sistema Binário de Anãs Castanhas.",
      en: "Binary Brown Dwarf System."
    },
    image: 'images/epsilon.png'
  },
  {
    id: 'wise',
    name: "WISE 0855",
    ra: 133.79513, dec: -7.24515, band: 'd5', radius: 60, fov: '0.10°',
    type: 'Sub-Brown Dwarf',
    flux: '92.4 mJy',
    desc: {
      pt: "Sub-Anã Castanha (Movimento Rápido).",
      en: "Sub-Brown Dwarf (Fast Moving)."
    },
    image: 'images/wise0855.png'
  },
  {
    id: 'rw_aur',
    name: "RW Aurigae",
    ra: 76.95642, dec: 30.40142, band: 'd4', radius: 60, fov: '0.10°',
    type: 'Variable Star',
    flux: '150.0 mJy',
    desc: {
      pt: "Sistemas Estelares Variáveis.",
      en: "Variable Star Systems."
    },
    image: 'images/aurigae.png'
  },
  {
    id: 'r_dra',
    name: "R Draconis",
    ra: 248.16750, dec: 66.75500, band: 'd5', radius: 60, fov: '0.20°',
    type: 'Mira Variable',
    flux: '210.0 mJy',
    desc: {
      pt: "Estrela Variável Pulsante do tipo Mira.",
      en: "Mira-type Pulsating Variable Star."
    },
    image: 'images/draconis.png'
  }
];

let configOpen    = false;
let lastResult    = null;
let fireflyReady  = false;
let fireflyLoading = false;
let activeBand    = 'd2';
let barHeights    = [];
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

const applyPresetBtn = document.getElementById('applyPresetBtn');
const targetNameEl   = document.getElementById('targetName');
const targetCoordsEl = document.getElementById('targetCoords');
const targetDescEl   = document.getElementById('targetDesc');
const targetTypeEl   = document.getElementById('targetType');
const targetFovEl    = document.getElementById('targetFov');
const targetBandEl   = document.getElementById('targetBand');
const targetFluxEl   = document.getElementById('targetFlux');
const targetImgEl    = document.getElementById('targetImg');
const langToggleBtn  = document.getElementById('langToggleBtn');
const langLabel      = document.getElementById('langLabel');

// presetSelect não é const pois pode ser re-obtido após clone
let presetSelect = document.getElementById('presetSelect');

function initPresets() {
  // Re-obtém referência fresca (pode ter sido clonado em chamadas anteriores)
  presetSelect = document.getElementById('presetSelect');
  if (!presetSelect) return;

  // Reconstrói as opções
  presetSelect.innerHTML = `<option value="" disabled selected>${TRANSLATIONS[currentLang].preset_default_option}</option>`;
  PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    presetSelect.appendChild(opt);
  });
  presetSelect.value = currentPreset.id;
  updateTargetCard(currentPreset);

  // Clona o elemento para remover quaisquer listeners antigos
  const fresh = presetSelect.cloneNode(true);
  presetSelect.parentNode.replaceChild(fresh, presetSelect);
  presetSelect = fresh;

  presetSelect.addEventListener('change', e => {
    const found = PRESETS.find(p => p.id === e.target.value);
    if (!found) return;
    currentPreset = found;
    updateTargetCard(found);
    loadSelectedPresetToObservatory();
  });

  // Guard no applyPresetBtn para não acumular listeners
  const freshBtn = applyPresetBtn.cloneNode(true);
  applyPresetBtn.parentNode.replaceChild(freshBtn, applyPresetBtn);
  freshBtn.addEventListener('click', () => loadSelectedPresetToObservatory());
}

function updateTargetCard(p) {
  targetNameEl.textContent   = p.name;
  targetCoordsEl.textContent = `RA: ${p.ra.toFixed(5)}° | Dec: ${(p.dec >= 0 ? '+' : '')}${p.dec.toFixed(5)}°`;
  targetDescEl.textContent   = p.desc[currentLang] || p.desc.en;
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

function getActiveTitle() {
  const ra  = parseFloat(document.getElementById('raInput').value);
  const dec = parseFloat(document.getElementById('decInput').value);

  const matched = PRESETS.find(p =>
    Math.abs(p.ra  - ra)  < 0.001 &&
    Math.abs(p.dec - dec) < 0.001
  );

  return matched ? matched.name : 'undefined';
}

function loadFirefly(fitsUrl) {
  if (!fireflyReady || !window.firefly) return;
  if (fireflyLoading) return;
  fireflyLoading = true;

  const ra    = parseFloat(document.getElementById('raInput').value)  || 269.452;
  const dec   = parseFloat(document.getElementById('decInput').value) || 4.693;
  const title = getActiveTitle();

  window.firefly.showImage('fireflyDisplay', {
    URL:         fitsUrl || 'https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/00/0014/00140a137-w1-int-3.fits',
    Title:       title,
    PlotId:      'spherex_plot',
    ZoomType:    'TO_WIDTH',
    ColorTable:  0,
    StretchType: 'ZScale',
    WorldPt:     `${ra};${dec};EQ_J2000`,
  });

  setTimeout(() => { fireflyLoading = false; }, 3000);
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
  document.getElementById('spec-heading').textContent    = bd.heading[currentLang] || bd.heading.en;
  document.getElementById('spec-desc').textContent       = bd.desc[currentLang] || bd.desc.en;
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
    emptyDiv.innerHTML = `<div class="empty-icon" style="opacity:.35">⏳</div><div class="empty-title">${currentLang === 'pt' ? 'Consultando IRSA…' : 'Consulting IRSA…'}</div>`;
    return;
  }
  if (type === 'irsa-down') {
    emptyDiv.classList.add('irsa-down');
    emptyDiv.innerHTML = `<div class="empty-icon">⚠️</div><div class="empty-title">${currentLang === 'pt' ? 'Serviços IRSA indisponíveis' : 'IRSA services unavailable'}</div>
      <div class="fallback-note"><strong>${currentLang === 'pt' ? 'WiseView operacional.' : 'WiseView operational.'}</strong><br><br>${currentLang === 'pt' ? 'Visualização à esquerda ativa.' : 'Left view active.'}<br><span style="font-size:10px;opacity:.7;">↳ ${msg||''}</span></div>`;
    return;
  }
  emptyDiv.innerHTML = `<div class="empty-icon">❌</div><div class="empty-title" style="color:var(--danger)">${currentLang === 'pt' ? 'Erro na pesquisa' : 'Search error'}</div><div class="fallback-note">${msg||''}</div>`;
}

function hideEmpty() { emptyDiv.style.display = 'none'; }

async function searchSPHEREx() {
  const ra     = document.getElementById('raInput').value;
  const dec    = document.getElementById('decInput').value;
  const band   = document.getElementById('bandInput').value;
  const radius = document.getElementById('radiusInput').value;
  const t      = TRANSLATIONS[currentLang];

  if (!ra || !dec) { setStatus('err', t.status_missing_coords); return; }

  setStatus('busy', t.status_consulting);
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

    const record  = data.data || data;
    const fitsUrl = record.fits_url || record.access_url;

    hideEmpty();
    loadFirefly(fitsUrl || null);

    if (record.energy_bandpassname) {
      const bMatch = record.energy_bandpassname.toLowerCase();
      for (const k of Object.keys(BAND_DATA)) {
        if (bMatch.includes(k)) { setBand(k); break; }
      }
    } else if (data.band && BAND_DATA[data.band]) {
      setBand(data.band);
    }

    metaBtn.disabled = false;
    const sep = record.separation_arcsec;
    setStatus('ok', sep !== undefined ? `Match a ${Number(sep).toFixed(2)}″` : 'OK');

  } catch(err) {
    const msg  = err.message || 'Erro desconhecido';
    const down = /irsa|caltech|timeout|network|unavailable|503|502|504/i.test(msg);
    showEmpty(down ? 'irsa-down' : 'error', msg);
    setStatus('err', down ? t.status_irsa_down : msg);
    // Não chama loadFirefly() no catch — evita carregamento extra em caso de erro
  } finally {
    searchBtn.classList.remove('loading');
    searchBtn.innerHTML = `<i data-lucide="telescope" style="width:13px;height:13px"></i> <span>${t.nav_search}</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

function openMeta() {
  if (!lastResult) return;
  const d = lastResult.data || lastResult;
  const topInfo = {
    status:       lastResult.status,
    period:       lastResult.period,
    period_label: lastResult.period_label
  };

  const allParams = { ...topInfo, ...d };
  const t = TRANSLATIONS[currentLang];

  let html = `<div class="meta-section-title">${currentLang === 'pt' ? 'Parâmetros Completos da Observação (IRSA / SPHEREx)' : 'Complete Observation Parameters (IRSA / SPHEREx)'}</div>`;
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
        <button class="copy-btn" id="copyFitsBtn">${t.btn_copy}</button>
      </div>
      <button class="tb-btn primary" id="sendToFireflyBtn" style="width:100%; margin-top:10px; justify-content:center;">
        <i data-lucide="play" style="width:13px;height:13px"></i>
        <span>${currentLang === 'pt' ? 'Carregar FITS diretamente no Firefly' : 'Load FITS directly into Firefly'}</span>
      </button>
    `;
  }

  metaGrid.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  const sendBtn = document.getElementById('sendToFireflyBtn');
  if (sendBtn && fitsUrl) {
    sendBtn.addEventListener('click', () => {
      fireflyLoading = false; // Reset guard para permitir carga explícita via metadata
      loadFirefly(fitsUrl);
      closeMeta();
      setStatus('ok', currentLang === 'pt' ? 'FITS carregado no Firefly com sucesso!' : 'FITS successfully loaded into Firefly!');
    });
  }

  const copyBtnEl = document.getElementById('copyFitsBtn');
  if (copyBtnEl && fitsUrl) {
    copyBtnEl.addEventListener('click', () => {
      navigator.clipboard.writeText(fitsUrl).then(() => {
        copyBtnEl.textContent = currentLang === 'pt' ? '✓ copiado' : '✓ copied';
        setTimeout(() => { copyBtnEl.textContent = t.btn_copy; }, 1500);
      });
    });
  }

  metaOverlay.classList.add('visible');
}

function closeMeta() { metaOverlay.classList.remove('visible'); }

function toggleLanguage() {
  currentLang = currentLang === 'pt' ? 'en' : 'pt';
  langLabel.textContent = currentLang === 'pt' ? 'EN' : 'PT';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[currentLang][key]) el.textContent = TRANSLATIONS[currentLang][key];
  });

  if (configBtn.querySelector('span')) {
    configBtn.querySelector('span').textContent = configOpen
      ? (currentLang === 'pt' ? 'Fechar config.' : 'Close Config')
      : (currentLang === 'pt' ? 'Config. WiseView' : 'WiseView Config');
  }

  updateTargetCard(currentPreset);
  setBand(activeBand);
  initPresets(); // seguro — clone interno remove listeners duplicados
}

/* Event listeners globais (registados uma única vez) */
searchBtn.addEventListener('click', () => { loadWiseView(); searchSPHEREx(); });

configBtn.addEventListener('click', () => {
  configOpen = !configOpen;
  if (configBtn.querySelector('span')) {
    configBtn.querySelector('span').textContent = configOpen
      ? (currentLang === 'pt' ? 'Fechar config.' : 'Close Config')
      : (currentLang === 'pt' ? 'Config. WiseView' : 'WiseView Config');
  }
  applyWVLayout(configOpen);
});

metaBtn.addEventListener('click', openMeta);
metaClose.addEventListener('click', closeMeta);
metaOverlay.addEventListener('click', e => { if (e.target === metaOverlay) closeMeta(); });
langToggleBtn.addEventListener('click', toggleLanguage);

document.getElementById('bandInput')?.addEventListener('change', e => setBand(e.target.value));

['raInput','decInput','bandInput','radiusInput','speedInput'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { loadWiseView(); searchSPHEREx(); }
  });
});

window.addEventListener('resize', () => applyWVLayout(configOpen));

/* Inicialização — ordem correcta */
toggleLanguage(); // define currentLang, actualiza i18n, e chama initPresets()
initBars();
setBand(activeBand);
applyWVLayout(false);
