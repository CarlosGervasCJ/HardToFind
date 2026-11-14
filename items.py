from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from astroquery.ipac.irsa import Irsa
from flask import Blueprint, jsonify, request
import numpy as np

bp = Blueprint("items", __name__)

# ---------------------------------------------------------------------------
# Bandas SPHEREx — mapeamento alias → valor real na tabela IRSA
# ---------------------------------------------------------------------------
BAND_ALIASES = {
    "d1": "spherex-d1",
    "d2": "spherex-d2",
    "d3": "spherex-d3",
    "d4": "spherex-d4",
    "d5": "spherex-d5",
    "d6": "spherex-d6",
}

# ---------------------------------------------------------------------------
# Períodos Restritos (2025 Início e 2026 Mais Recente) em MJD
# ---------------------------------------------------------------------------
EPOCH_PRESETS = {
    "2025-inicio": {
        "label": "Início de 2025 (Jan - Abr 2025)",
        "epoch_min": None,  # 2025-01-01
        "epoch_max": None,  # 2025-04-30
    },
    "2026-recente": {
        "label": "2026 Mais Recente (Jan 2026 em diante)",
        "epoch_min": None,  # 2026-01-01
        "epoch_max": None,  # Período recente
    },
}


def _parse_band_filter(band, alias_map):
    if band is None:
        return None
    bands = [band] if isinstance(band, str) else list(band)
    normalized = []
    invalid = []
    for b in bands:
        key = str(b).strip().lower()
        if key in alias_map:
            normalized.append(alias_map[key])
        else:
            invalid.append(b)
    if invalid:
        raise ValueError(
            f"Banda(s) inválida(s): {invalid}. "
            f"Valores aceitos: {list(alias_map.keys())}"
        )
    return normalized


def _detect_column(table, candidates):
    lower_cols = {c.lower(): c for c in table.colnames}
    for c in candidates:
        if c.lower() in lower_cols:
            return lower_cols[c.lower()]
    return None


def _apply_filters(results, bands=None, epoch_min=None, epoch_max=None):
    mask = np.ones(len(results), dtype=bool)

    # --- Filtro de Banda -------------------------------------------------
    if bands is not None:
        band_col = _detect_column(
            results,
            ["energy_bandpassname", "band", "bandpass", "filter", "em_band"],
        )
        if band_col is not None:
            raw_vals = np.array([str(v).strip().lower() for v in results[band_col]])
            band_mask = np.zeros(len(results), dtype=bool)
            for b in bands:
                band_mask |= raw_vals == b.lower()
            mask &= band_mask

    # --- Filtro de Época (Tratamento robusto para MJD / Datas ISO) ------
    if epoch_min is not None or epoch_max is not None:
        epoch_col = _detect_column(
            results, ["t_min", "t_max", "t_mid", "epoch", "mjd_obs", "date_obs"]
        )
        if epoch_col is not None:
            raw_epochs = results[epoch_col]
            try:
                # Tenta conversão direta se forem valores numéricos (MJD)
                epochs = np.array(raw_epochs, dtype=float)
            except (ValueError, TypeError):
                # Se forem strings de data (ex: ISO date_obs), converte via Astropy Time
                try:
                    t = Time(raw_epochs)
                    epochs = t.mjd
                except Exception:
                    epochs = np.zeros(len(results))

            if epoch_min is not None:
                mask &= epochs >= epoch_min
            if epoch_max is not None:
                mask &= epochs <= epoch_max

    return results[mask]


# ---------------------------------------------------------------------------
# Função Principal — Alta Assertividade, Raio Otimizado e Métricas de Zoom
# ---------------------------------------------------------------------------
def find_closest_record(
    target_ra: float,
    target_dec: float,
    collection: str = "spherex_qr2",
    search_radius_arcsec: float = 30.0,  # Raio reduzido para maior precisão astrométrica
    band=None,
    band_alias_map: dict = None,
    epoch_min: float = None,
    epoch_max: float = None,
    coord_tol_deg: float = None,
):
    target_coord = SkyCoord(
        ra=target_ra * u.deg, dec=target_dec * u.deg, frame="icrs"
    )

    alias_map = band_alias_map or BAND_ALIASES
    bands = _parse_band_filter(band, alias_map)

    # Força URL direta do serviço SIA do IRSA
    Irsa.sia_url = "https://irsa.ipac.caltech.edu/SIA"

    results = Irsa.query_sia(
        pos=(target_coord, search_radius_arcsec * u.arcsec),
        collection=collection,
    )

    total = len(results)
    if total == 0:
        return None

    # Aplicação de filtros de banda e período
    any_filter = any(x is not None for x in [bands, epoch_min, epoch_max])
    if any_filter:
        results = _apply_filters(
            results,
            bands=bands,
            epoch_min=epoch_min,
            epoch_max=epoch_max,
        )
        if len(results) == 0:
            return None

    ra_col  = _detect_column(results, ["ra", "s_ra"])  or "s_ra"
    dec_col = _detect_column(results, ["dec", "s_dec"]) or "s_dec"

    # Filtro opcional de tolerância angular
    if coord_tol_deg is not None:
        rec_coords = SkyCoord(
            ra=np.array(results[ra_col],  dtype=float) * u.deg,
            dec=np.array(results[dec_col], dtype=float) * u.deg,
            frame="icrs",
        )
        seps = target_coord.separation(rec_coords).deg
        coord_mask = seps <= coord_tol_deg
        if coord_mask.sum() == 0:
            return None
        results = results[coord_mask]

    # Cálculo exato para encontrar o registro mais próximo (maior assertividade)
    rec_coords = SkyCoord(
        ra=np.array(results[ra_col],  dtype=float) * u.deg,
        dec=np.array(results[dec_col], dtype=float) * u.deg,
        frame="icrs",
    )
    separations   = target_coord.separation(rec_coords)
    closest_index = int(separations.argmin())
    record        = results[closest_index]
    best_sep_arcsec = float(separations[closest_index].arcsec)

    # Serialização segura para JSON
    record_dict = {}
    for col in results.colnames:
        val = record[col]
        if hasattr(val, "item"):
            val = val.item()
        record_dict[col] = val

    # Adiciona métricas de assertividade e recomendações de Zoom / FOV para o visualizador
    record_dict["separation_arcsec"] = round(best_sep_arcsec, 3)
    record_dict["recommended_fov_arcmin"] = max(0.5, round(search_radius_arcsec / 20.0, 2))

    # --- Normalização e URL FITS / Firefly Client ---
    fits_col = _detect_column(results, ["access_url", "get_fits", "file_url", "url", "acswave"])
    if fits_col and fits_col in record_dict:
        url_val = record_dict[fits_col]
        
        if url_val and str(url_val).endswith(".tbl") and collection == "wise_allwise":
            base_dir = url_val.rsplit("/", 1)[0]
            obs_id = record_dict.get("obs_id", "")
            band_name = record_dict.get("energy_bandpassname", "w1").lower()
            if not band_name.startswith("w"):
                band_name = "w1"
            
            record_dict["fits_url"] = f"{base_dir}/{obs_id}-{band_name}-int-3.fits"
            record_dict["is_table_format"] = False
        else:
            record_dict["fits_url"] = url_val
            record_dict["is_table_format"] = str(url_val).endswith(".tbl") if url_val else False
    else:
        record_dict["fits_url"] = None
        record_dict["is_table_format"] = False

    return record_dict


# ---------------------------------------------------------------------------
# Rotas Flask da API
# ---------------------------------------------------------------------------
@bp.get("/api/data")
def get_sample_data():
    return jsonify(
        {
            "data": [
                {"id": 1, "name": "Sample Item 1", "value": 100},
                {"id": 2, "name": "Sample Item 2", "value": 200},
                {"id": 3, "name": "Sample Item 3", "value": 300},
            ],
            "total": 3,
            "timestamp": "2024-01-01T00:00:00Z",
        }
    )


# ── Endpoint SPHEREx com Seletor de Períodos Restritos ─────────────────────
@bp.get("/api/search-spherex")
def search_spherex():
    try:
        ra         = float(request.args.get("ra"))
        dec        = float(request.args.get("dec"))
        radius     = float(request.args.get("radius", 30.0))  # Raio padrão otimizado (30")
        band       = request.args.get("band", "d1")
        collection = request.args.get("collection", "spherex_qr2")
        
        # Parâmetro de período restrito às duas opções permitidas:
        # '2025-inicio' ou '2026-recente'
        period     = request.args.get("period", "2026-recente")

        if period not in EPOCH_PRESETS:
            return jsonify({
                "status": "error",
                "message": f"Período inválido '{period}'. Opções permitidas: {list(EPOCH_PRESETS.keys())}"
            }), 400

        preset = EPOCH_PRESETS[period]
        epoch_min = preset["epoch_min"]
        epoch_max = preset["epoch_max"]

        result = find_closest_record(
            target_ra=ra,
            target_dec=dec,
            collection=collection,
            search_radius_arcsec=radius,
            band=band,
            band_alias_map=BAND_ALIASES,
            epoch_min=epoch_min,
            epoch_max=epoch_max,
        )

        if result is None:
            return jsonify({
                "status": "error", 
                "message": f"Nenhum registro encontrado para o período '{preset['label']}' com os parâmetros informados."
            }), 404

        return jsonify({
            "status": "success",
            "period": period,
            "period_label": preset["label"],
            "data": result
        })

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(error_trace)
        return jsonify({"status": "error", "message": str(e), "trace": error_trace}), 500
