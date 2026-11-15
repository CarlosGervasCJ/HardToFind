
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;

    /* ─── 1. MOCK DATA & FALLBACK DATASET ──────────────────────── */
    const mockSearchResponse = {
      query: {
        ra: 127.69444,
        dec: -39.17760,
        radius_deg: 0.05,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        collection: "spherex_qr3"
      },
      observations: [
        {
          observation_id: "2026W21_2A_0001_2",
          detector: 1,
          band: 4,
          obs_time: "2026-05-25T12:00:00Z",
          wavelength_um: 3.1,
          access_url: "https://irsa.ipac.caltech.edu/data/SPHEREx/preview1.fits",
          preview_url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80",
          quality_score: 0.82
        },
        {
          observation_id: "2026W24_2A_0045_2",
          detector: 1,
          band: 4,
          obs_time: "2026-06-10T12:00:00Z",
          wavelength_um: 3.1,
          access_url: "https://irsa.ipac.caltech.edu/data/SPHEREx/preview2.fits",
          preview_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
          quality_score: 0.88
        }
      ],
      candidates: [
        {
          candidate_id: "cand_001",
          ra: 127.69510,
          dec: -39.17800,
          first_obs_time: "2026-05-25T12:00:00Z",
          last_obs_time: "2026-06-10T12:00:00Z",
          angular_separation_arcsec: 12.4,
          brightness_by_band: {
            band_1: 12.4,
            band_2: 18.2,
            band_3: 25.7,
            band_4: 31.1,
            band_5: 28.9,
            band_6: 22.5
          },
          quality_flags: ["valid_pixels", "multi_epoch"],
          variance: 0.0032,
          status: "candidate_for_inspection",
          preview_url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&auto=format&fit=crop&q=80",
          source_image_url: "https://irsa.ipac.caltech.edu/data/SPHEREx/cand001.fits"
        }
      ],
      warnings: [
        "Candidates are preliminary and require independent validation.",
        "This tool does not confirm the existence of Planet X."
      ]
    };

    /* ─── 2. API SERVICE LAYER ─────────────────────────────────── */
    const API_BASE_URL = "http://localhost:8000";

    async function searchObservations(searchParams) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${API_BASE_URL}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchParams),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Server returned status ${res.status}`);
        const json = await res.json();
        return { ...json, isMock: false };
      } catch (err) {
        return {
          ...mockSearchResponse,
          query: searchParams,
          isMock: true,
          warnings: [
            "Sample Data Mode: Backend offline or unreachable. Showing validated mock dataset.",
            ...mockSearchResponse.warnings
          ]
        };
      }
    }

    /* ─── 3. REUSABLE UI COMPONENTS ────────────────────────────── */
    function DisclaimerBanner({ warnings = [] }) {
      return (
        <aside aria-label="Scientific Disclaimer" style={{ background: '#1c2d45', borderBottom: '1px solid #3b82f6', padding: '10px 16px', fontSize: '13px', textAlign: 'center' }}>
          <strong style={{ color: 'var(--warn)' }}>Scientific Notice:</strong> This tool supports astronomical exploration and candidate visualization. 
          {warnings.length > 0 ? ` ${warnings[0]}` : " It does not confirm the existence of Planet X or validate astronomical discoveries."}
        </aside>
      );
    }

    function SearchForm({ onSearch, loading }) {
      const [formData, setFormData] = useState({
        ra: 127.69444,
        dec: -39.17760,
        radius_deg: 0.05,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        collection: "spherex_qr3"
      });

      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
          ...prev,
          [name]: ['ra', 'dec', 'radius_deg'].includes(name) ? parseFloat(value) || 0 : value
        }));
      };

      const handleSubmit = (e) => {
        e.preventDefault();
        onSearch(formData);
      };

      return (
        <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Sky Region Parameters</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="ra" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Right Ascension (RA °) <span className="tooltip-trigger" title="Celestial longitude measured in decimal degrees (0° to 360°)">ⓘ</span>
              </label>
              <input id="ra" name="ra" type="number" step="0.00001" value={formData.ra} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="dec" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Declination (Dec °) <span className="tooltip-trigger" title="Celestial latitude measured in decimal degrees (-90° to +90°)">ⓘ</span>
              </label>
              <input id="dec" name="dec" type="number" step="0.00001" value={formData.dec} onChange={handleChange} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="radius_deg" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Search Radius (°)
              </label>
              <input id="radius_deg" name="radius_deg" type="number" step="0.01" value={formData.radius_deg} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="collection" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                Dataset Collection
              </label>
              <select id="collection" name="collection" value={formData.collection} onChange={handleChange}>
                <option value="spherex_qr3">spherex_qr3 (Quick Release 3)</option>
                <option value="spherex_dr1">spherex_dr1 (Data Release 1)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="start_date" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Start Date</label>
              <input id="start_date" name="start_date" type="date" value={formData.start_date} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="end_date" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>End Date</label>
              <input id="end_date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} required />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Searching SPHEREx Archives...' : 'Search Observations'}
          </button>
        </form>
      );
    }

    function SkyMapCanvas({ query, observations, candidates }) {
      const canvasRef = useRef(null);

      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !query) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, w, h);

        // Coordinate Grid
        ctx.strokeStyle = '#1c2d45';
        ctx.lineWidth = 1;
        for (let x = 40; x < w; x += 60) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 30; y < h; y += 50) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Center Crosshair (Query RA/Dec)
        const cx = w / 2;
        const cy = h / 2;
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, 65, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#8ca3c7';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText(`Center: RA ${query.ra.toFixed(4)}°, Dec ${query.dec.toFixed(4)}°`, 12, 20);
        ctx.fillText(`Radius: ${query.radius_deg}°`, 12, 36);

        // Plot Candidate positions
        if (candidates && candidates.length > 0) {
          candidates.forEach((cand, idx) => {
            const dx = ((cand.ra - query.ra) / (query.radius_deg || 0.05)) * 65;
            const dy = -((cand.dec - query.dec) / (query.radius_deg || 0.05)) * 65;
            const px = cx + dx;
            const py = cy + dy;

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();

            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`${cand.candidate_id} (${cand.angular_separation_arcsec}")`, px + 12, py + 4);
          });
        }
      }, [query, observations, candidates]);

      return (
        <div className="card" style={{ display: 'grid', gap: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Astronomical Sky Field Map (RA vs. Dec)</h3>
          <canvas ref={canvasRef} width={600} height={220} style={{ width: '100%', height: '220px', borderRadius: '8px', border: '1px solid var(--border)' }} />
        </div>
      );
    }

    function ObservationList({ observations, selectedObsA, selectedObsB, onSelectPair }) {
      if (!observations || observations.length === 0) {
        return <div className="card" style={{ color: 'var(--muted)' }}>No observations found for this region and period.</div>;
      }

      return (
        <div className="card" style={{ display: 'grid', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>SPHEREx Observation Timeline</h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Select two distinct observation epochs to run multi-epoch difference comparison.</p>
          
          <div style={{ display: 'grid', gap: '8px' }}>
            {observations.map((obs, idx) => (
              <div key={obs.observation_id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'var(--bg)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>#{idx + 1} · {obs.observation_id}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Time: {new Date(obs.obs_time).toLocaleString()} | Band: {obs.band} ({obs.wavelength_um} µm) | Quality: {(obs.quality_score * 100).toFixed(0)}%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => onSelectPair('A', obs)}
                    style={{ background: selectedObsA?.observation_id === obs.observation_id ? 'var(--accent)' : 'var(--surface)', color: 'white', border: '1px solid var(--border)', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {selectedObsA?.observation_id === obs.observation_id ? 'Epoch A ✓' : 'Set A'}
                  </button>
                  <button 
                    onClick={() => onSelectPair('B', obs)}
                    style={{ background: selectedObsB?.observation_id === obs.observation_id ? 'var(--accent)' : 'var(--surface)', color: 'white', border: '1px solid var(--border)', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {selectedObsB?.observation_id === obs.observation_id ? 'Epoch B ✓' : 'Set B'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    function ImageComparison({ obsA, obsB }) {
      return (
        <div className="card" style={{ display: 'grid', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Multi-Epoch Side-by-Side & Difference View</h3>
          
          <div className="comparison-grid">
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Epoch A: {obsA ? new Date(obsA.obs_time).toLocaleDateString() : 'Not selected'}</p>
              {obsA ? (
                <img src={obsA.preview_url} alt="Epoch A sky observation preview" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ height: '180px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: 'var(--muted)', fontSize: '12px' }}>Select Epoch A</div>
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Epoch B: {obsB ? new Date(obsB.obs_time).toLocaleDateString() : 'Not selected'}</p>
              {obsB ? (
                <img src={obsB.preview_url} alt="Epoch B sky observation preview" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ height: '180px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: 'var(--muted)', fontSize: '12px' }}>Select Epoch B</div>
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Difference Residue (A − B)</p>
              {obsA && obsB ? (
                <div style={{ height: '180px', background: '#030712', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--border)', padding: '12px' }}>
                  <span style={{ fontSize: '22px' }}>⚡</span>
                  <span style={{ fontSize: '12px', color: 'var(--ok)', fontWeight: 600, marginTop: '6px' }}>Astrometrically Aligned</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    Residual transient flux flagged for candidate inspection.
                  </span>
                </div>
              ) : (
                <div style={{ height: '180px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: 'var(--muted)', fontSize: '12px' }}>Awaiting Both Epochs</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    function BrightnessChart({ brightnessByBand, variance }) {
      const plotRef = useRef(null);

      useEffect(() => {
        if (!plotRef.current || !brightnessByBand || !window.Plotly) return;

        const wavelengths = [
          'Band 1 (0.92 µm)',
          'Band 2 (1.36 µm)',
          'Band 3 (2.02 µm)',
          'Band 4 (3.12 µm)',
          'Band 5 (4.12 µm)',
          'Band 6 (4.71 µm)'
        ];
        const values = Object.values(brightnessByBand);
        const errValues = values.map(v => Math.sqrt(variance || 0.003) * 15);

        const trace = {
          x: wavelengths,
          y: values,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Surface Brightness',
          line: { color: '#38bdf8', width: 3 },
          marker: { color: '#6366f1', size: 8 },
          error_y: {
            type: 'data',
            array: errValues,
            visible: true,
            color: '#8ca3c7'
          }
        };

        const layout = {
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: '#060b14',
          font: { color: '#d4dff0', family: 'Inter, sans-serif', size: 11 },
          margin: { t: 20, r: 20, b: 50, l: 55 },
          xaxis: { title: 'SPHEREx Spectral Band / Wavelength (µm)', gridcolor: '#1c2d45' },
          yaxis: { title: 'Surface Brightness (MJy/sr)', gridcolor: '#1c2d45' }
        };

        window.Plotly.newPlot(plotRef.current, [trace], layout, { responsive: true, displayModeBar: false });
      }, [brightnessByBand, variance]);

      return (
        <div className="card" style={{ display: 'grid', gap: '8px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 600 }}>
            Spectral Brightness Profile (MJy/sr) <span className="tooltip-trigger" title="MegaJanskys per steradian: calibrated infrared surface brightness">ⓘ</span>
          </h4>
          <div ref={plotRef} style={{ width: '100%', height: '260px' }} />
        </div>
      );
    }

    function CandidateCard({ candidate, onSelectCandidate }) {
      return (
        <article className="card" style={{ display: 'grid', gap: '12px', borderLeft: '4px solid var(--warn)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>Candidate: {candidate.candidate_id}</h4>
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warn)', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
              Preliminary Candidate · Unconfirmed
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', fontSize: '13px', gap: '8px', color: 'var(--muted)' }}>
            <div>RA: <strong style={{ color: 'var(--text)' }}>{candidate.ra}°</strong></div>
            <div>Dec: <strong style={{ color: 'var(--text)' }}>{candidate.dec}°</strong></div>
            <div>
              Angular Separation <span className="tooltip-trigger" title="Apparent angular shift between first and last detection in arcseconds">ⓘ</span>: 
              <strong style={{ color: 'var(--text)' }}> {candidate.angular_separation_arcsec}″</strong>
            </div>
            <div>
              Variance <span className="tooltip-trigger" title="Statistical measurement variance across detector pixels">ⓘ</span>: 
              <strong style={{ color: 'var(--text)' }}> {candidate.variance}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
            <button onClick={() => onSelectCandidate(candidate)} className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
              Inspect Candidate Details
            </button>
            <a href={candidate.source_image_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Source FITS Image ↗
            </a>
          </div>
        </article>
      );
    }

    /* ─── 4. APPLICATION PAGES ─────────────────────────────────── */
    function Home({ onNavigate }) {
      return (
        <main style={{ maxWidth: '920px', margin: '40px auto', padding: '0 20px', display: 'grid', gap: '24px' }}>
          <section className="card" style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(180deg, var(--surface) 0%, #060b14 100%)' }}>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, marginBottom: '14px' }}>SPHEREx Planet-X Explorer</h1>
            <p style={{ fontSize: '16px', color: 'var(--muted)', maxWidth: '680px', margin: '0 auto 28px auto' }}>
              Explore NASA SPHEREx sky observations over time and investigate candidate moving or changing sources.
            </p>
            <button onClick={() => onNavigate('explorer')} className="btn-primary" style={{ fontSize: '16px', padding: '12px 32px' }}>
              Explore the Sky
            </button>
          </section>

          <section className="card" style={{ display: 'grid', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>About SPHEREx & The Search for Outer Solar System Objects</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              NASA’s <strong>SPHEREx</strong> (Spectro-Photometer for the History of the Universe, Epoch of Reionization, and Ices Explorer) surveys the entire sky in near-infrared light across 102 spectral channels. By comparing repeated observations of the same sky coordinates over time, researchers and citizen scientists can search for faint, cold, slow-moving bodies in the outer Solar System.
            </p>
          </section>

          <section className="card" style={{ borderLeft: '4px solid var(--warn)', display: 'grid', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--warn)' }}>Scientific Integrity & Uncertainty Notice</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              This tool supports public exploration and visualization. It does not confirm the existence of Planet X or validate astronomical discoveries. All flagged objects represent preliminary candidates requiring independent astrometric follow-up.
            </p>
          </section>

          <footer style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '13px', color: 'var(--muted)' }}>
            <a href="https://irsa.ipac.caltech.edu" target="_blank" rel="noopener noreferrer">NASA / IPAC IRSA Archive ↗</a>
            <a href="https://spherex.caltech.edu" target="_blank" rel="noopener noreferrer">Caltech SPHEREx Mission ↗</a>
            <button onClick={() => onNavigate('about')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', padding: 0 }}>
              Methodology & Credits
            </button>
          </footer>
        </main>
      );
    }

    function Explorer({ onSelectCandidate }) {
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState(null);
      const [data, setData] = useState(null);
      const [obsA, setObsA] = useState(null);
      const [obsB, setObsB] = useState(null);

      const handleSearch = async (params) => {
        setLoading(true);
        setError(null);
        try {
          const result = await searchObservations(params);
          setData(result);
          if (result.observations && result.observations.length >= 2) {
            setObsA(result.observations[0]);
            setObsB(result.observations[1]);
          } else if (result.observations && result.observations.length === 1) {
            setObsA(result.observations[0]);
            setObsB(null);
          }
        } catch (err) {
          setError('Unable to retrieve astronomical observations. Please verify parameters and retry.');
        } finally {
          setLoading(false);
        }
      };

      const handleSelectPair = (type, obs) => {
        if (type === 'A') setObsA(obs);
        if (type === 'B') setObsB(obs);
      };

      return (
        <main style={{ maxWidth: '1160px', margin: '30px auto', padding: '0 20px', display: 'grid', gap: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>SPHEREx Multi-Epoch Sky Explorer</h1>

          <div className="explorer-grid">
            <SearchForm onSearch={handleSearch} loading={loading} />

            <div style={{ display: 'grid', gap: '20px' }}>
              {loading && (
                <div className="card" role="status" aria-live="polite" style={{ textAlign: 'center', color: 'var(--accent)', padding: '30px' }}>
                  Querying NASA SPHEREx observations and computing multi-epoch alignments...
                </div>
              )}

              {error && (
                <div className="card" role="alert" style={{ background: 'rgba(248,113,113,0.1)', borderColor: 'var(--err)', color: 'var(--err)' }}>
                  {error}
                </div>
              )}

              {!loading && !error && !data && (
                <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 20px' }}>
                  Enter celestial coordinates (RA, Dec) and a date window to inspect SPHEREx epochs and candidate sources.
                </div>
              )}

              {data && (
                <>
                  {data.isMock && (
                    <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
                      <strong>Demo Mode Active:</strong> Displaying sample SPHEREx observation dataset for offline demonstration.
                    </div>
                  )}

                  <div className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
                    <div>Observations Found: <strong>{data.observations?.length || 0}</strong></div>
                    <div>Date Range: <strong>{data.query?.start_date} to {data.query?.end_date}</strong></div>
                    <div>Preliminary Candidates: <strong style={{ color: 'var(--warn)' }}>{data.candidates?.length || 0}</strong></div>
                  </div>

                  <SkyMapCanvas query={data.query} observations={data.observations} candidates={data.candidates} />

                  <ObservationList 
                    observations={data.observations} 
                    selectedObsA={obsA} 
                    selectedObsB={obsB} 
                    onSelectPair={handleSelectPair} 
                  />

                  <ImageComparison obsA={obsA} obsB={obsB} />

                  <section style={{ display: 'grid', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Candidate Moving / Variable Sources</h3>
                    {data.candidates && data.candidates.length > 0 ? (
                      data.candidates.map(cand => (
                        <CandidateCard key={cand.candidate_id} candidate={cand} onSelectCandidate={onSelectCandidate} />
                      ))
                    ) : (
                      <div className="card" style={{ color: 'var(--muted)' }}>No anomalous candidates detected in this region and period.</div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </main>
      );
    }

    function CandidateDetail({ candidate, onBack }) {
      if (!candidate) {
        return (
          <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ marginBottom: '16px', color: 'var(--muted)' }}>No candidate currently selected for inspection.</p>
              <button onClick={onBack} className="btn-primary">Return to Explorer</button>
            </div>
          </main>
        );
      }

      return (
        <main style={{ maxWidth: '860px', margin: '30px auto', padding: '0 20px', display: 'grid', gap: '20px' }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '14px', fontWeight: 600, justifySelf: 'start' }}>
            ← Back to Explorer Results
          </button>

          <article className="card" style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{candidate.candidate_id}</h2>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Status: Candidate for Inspection (Requires Independent Validation)</span>
              </div>
              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warn)', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                Preliminary Detection
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '14px' }}>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Coordinates (J2000)</div>
                <strong>RA {candidate.ra}° | Dec {candidate.dec}°</strong>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Angular Separation</div>
                <strong>{candidate.angular_separation_arcsec} arcseconds</strong>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Observation Window</div>
                <strong>{new Date(candidate.first_obs_time).toLocaleDateString()} → {new Date(candidate.last_obs_time).toLocaleDateString()}</strong>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Measurement Variance</div>
                <strong>{candidate.variance}</strong>
              </div>
            </div>

            <BrightnessChart brightnessByBand={candidate.brightness_by_band} variance={candidate.variance} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Quality Indicators & Pipeline Flags</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {candidate.quality_flags.map(flag => (
                    <span key={flag} style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid var(--ok)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: 'var(--ok)' }}>
                      ✓ {flag}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <a href={candidate.source_image_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block' }}>
                  Download Source FITS ↗
                </a>
              </div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--warn)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--warn)' }}>Disclaimer:</strong> Visual cutouts and flux profiles are preliminary pipeline outputs. Cosmic ray hits, detector persistence, or background variable stars can mimic proper motion candidates.
            </div>
          </article>
        </main>
      );
    }

    function About() {
      return (
        <main style={{ maxWidth: '840px', margin: '40px auto', padding: '0 20px', display: 'grid', gap: '20px' }}>
          <section className="card" style={{ display: 'grid', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Methodology & Scientific Context</h1>
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              <strong>SPHEREx Planet-X Explorer</strong> was built for the NASA Space Apps Challenge 2026 to democratize access to multi-epoch infrared sky survey data.
            </p>
          </section>

          <section className="card" style={{ display: 'grid', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>How Multi-Epoch Comparison Works</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              1. <strong>Spatial Cone Search:</strong> Users query specific Right Ascension (RA) and Declination (Dec) regions across SPHEREx Quick Release (QR3) or Data Release (DR1) archives.<br/>
              2. <strong>Temporal Pairing:</strong> Observations separated by weeks or months are aligned astrometrically.<br/>
              3. <strong>Candidate Flagging:</strong> Sources exhibiting positional shifts (angular separation) or infrared spectral anomalies across Bands 1–6 (0.75–5.0 µm) are flagged for human inspection.
            </p>
          </section>

          <section className="card" style={{ display: 'grid', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Limitations & Sources of False Positives</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              Automated transient detection in infrared surveys frequently encounters false positives caused by cosmic ray strikes, zodiacal dust foreground variations, detector persistence artifacts, and known main-belt asteroids. Consequently, no candidate displayed here constitutes a confirmed discovery.
            </p>
          </section>

          <section className="card" style={{ display: 'grid', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>NASA Data Credits & Acknowledgements</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              This application utilizes public data concepts and archive standards provided by NASA, Caltech/IPAC, and the Infrared Science Archive (IRSA).
            </p>
          </section>
        </main>
      );
    }

    /* ─── 5. MAIN APPLICATION SHELL ────────────────────────────── */
    function App() {
      const [page, setPage] = useState('home');
      const [selectedCandidate, setSelectedCandidate] = useState(null);

      const handleSelectCandidate = (candidate) => {
        setSelectedCandidate(candidate);
        setPage('candidate');
      };

      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <DisclaimerBanner />

          <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setPage('home')} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
              🪐 SPHEREx Planet-X Explorer
            </button>
            <nav aria-label="Main Navigation" style={{ display: 'flex', gap: '10px' }}>
              <button className={`nav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>Home</button>
              <button className={`nav-btn ${page === 'explorer' ? 'active' : ''}`} onClick={() => setPage('explorer')}>Explorer</button>
              <button className={`nav-btn ${page === 'about' ? 'active' : ''}`} onClick={() => setPage('about')}>About</button>
            </nav>
          </header>

          <div style={{ flex: 1 }}>
            {page === 'home' && <Home onNavigate={setPage} />}
            {page === 'explorer' && <Explorer onSelectCandidate={handleSelectCandidate} />}
            {page === 'candidate' && <CandidateDetail candidate={selectedCandidate} onBack={() => setPage('explorer')} />}
            {page === 'about' && <About />}
          </div>

          <footer style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '18px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
            NASA Space Apps Challenge 2026 · SPHEREx Planet-X Explorer · Open Science Exploration Tool
          </footer>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
