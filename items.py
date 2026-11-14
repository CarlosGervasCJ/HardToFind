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
# Períodos Ajustados com base na disponibilidade real do IRSA (MJD)
# ---------------------------------------------------------------------------
EPOCH_PRESETS = {
    "2025": {
        "label": "Ano de 2025 (Abr - Dez 2025)",
        "epoch_min": 60676.0,  # 2025-01-01
        "epoch_max": 61040.0,  # 2025-12-31 (Cobre a faixa 60790 - 60998)
    },
    "2026-recente": {
        "label": "2026 Mais Recente (Jan 2026 em diante)",
        "epoch_min": 61041.0,  # 2026-01-01
        "epoch_max": 61500.0,  # Período recente
    },
    "all": {
        "label": "Todos os períodos disponíveis",
        "epoch_min": None,
        "epoch_max": None,
    }
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


def _get_epochs_array(results):
    epoch_col = _detect_column(
        results, ["t_min", "t_max", "t_mid", "epoch", "mjd_obs", "date_obs"]
    )
    if epoch_col is None:
        return None, None
    
    raw_epochs = results[epoch_col]
    try:
        epochs = np.array(raw_epochs, dtype=float)
    except (ValueError, TypeError):
        try:
            t = Time(raw_epochs)
            epochs = t.mjd
        except Exception:
            epochs = np.zeros(len(results))
    return epoch_col, epochs


def find_closest_record(
    target_ra: float,
    target_dec: float,
    collection: str = "spherex_dr1",
    search_radius_arcsec: float = 60.0,
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

    Irsa.sia_url = "https://irsa.ipac.caltech.edu/SIA"

    results = Irsa.query_sia(
        pos=(target_coord, search_radius_arcsec * u.arcsec),
        collection=collection,
    )

    total = len(results)
    if total == 0:
        return {
            "error_type": "no_records_found_at_all", 
            "message": f"Nenhum registro bruto retornado pelo IRSA SIA para a coleção '{collection}' neste raio e coordenadas."
        }

    # 1. Aplicação de filtros de banda primeiro
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
            results = results[band_mask]
            if len(results) == 0:
                return {
                    "error_type": "band_filtered_out", 
                    "message": f"Registros encontrados, mas nenhum na banda solicitada '{band}'."
                }

    # 2. Extração de épocas APÓS o filtro de banda
    epoch_col, epochs = _get_epochs_array(results)
    min_found_mjd = float(epochs.min()) if epochs is not None and len(epochs) > 0 else None
    max_found_mjd = float(epochs.max()) if epochs is not None and len(epochs) > 0 else None

    # 3. Aplicação de filtros de época (se definidos)
    if (epoch_min is not None or epoch_max is not None) and epochs is not None:
        mask = np.ones(len(results), dtype=bool)
        if epoch_min is not None:
            mask &= epochs >= epoch_min
        if epoch_max is not None:
            mask &= epochs <= epoch_max
        
        results = results[mask]
        if len(results) == 0:
            return {
                "error_type": "epoch_filtered_out",
                "min_available_mjd": min_found_mjd,
                "max_available_mjd": max_found_mjd,
                "message": f"Filtro temporal eliminou todos os registros. Faixa disponível nesta consulta (MJD): [{min_found_mjd}, {max_found_mjd}]"
            }

    ra_col  = _detect_column(results, ["ra", "s_ra"])  or "s_ra"
    dec_col = _detect_column(results, ["dec", "s_dec"]) or "s_dec"

    if coord_tol_deg is not None:
        rec_coords = SkyCoord(
            ra=np.array(results[ra_col],  dtype=float) * u.deg,
            dec=np.array(results[dec_col], dtype=float) * u.deg,
            frame="icrs",
        )
        seps = target_coord.separation(rec_coords).deg
        coord_mask = seps <= coord_tol_deg
        if coord_mask.sum() == 0:
            return {"error_type": "tolerance_filtered_out", "message": "Nenhum registro dentro da tolerância angular."}
        results = results[coord_mask]

    rec_coords = SkyCoord(
        ra=np.array(results[ra_col],  dtype=float) * u.deg,
        dec=np.array(results[dec_col], dtype=float) * u.deg,
        frame="icrs",
    )
    separations   = target_coord.separation(rec_coords)
    closest_index = int(separations.argmin())
    record        = results[closest_index]
    best_sep_arcsec = float(separations[closest_index].arcsec)

    record_dict = {}
    for col in results.colnames:
        val = record[col]
        if hasattr(val, "item"):
            val = val.item()
        record_dict[col] = val

    record_dict["separation_arcsec"] = round(best_sep_arcsec, 3)
    record_dict["recommended_fov_arcmin"] = max(0.5, round(search_radius_arcsec / 20.0, 2))

    fits_col = _detect_column(results, ["access_url", "get_fits", "file_url", "url", "acswave"])
    if fits_col and fits_col in record_dict:
        url_val = record_dict[fits_col]
        record_dict["fits_url"] = url_val
        record_dict["is_table_format"] = str(url_val).endswith(".tbl") if url_val else False
    else:
        record_dict["fits_url"] = None
        record_dict["is_table_format"] = False

    return record_dict


# ---------------------------------------------------------------------------
# Rotas Flask da API
# ---------------------------------------------------------------------------
@bp.get("/api/search-spherex")
def search_spherex():
    try:
        ra         = float(request.args.get("ra"))
        dec        = float(request.args.get("dec"))
        radius     = float(request.args.get("radius", 60.0))
        band       = request.args.get("band", "d1")
        collection = request.args.get("collection", "spherex_dr1")
        
        # Agora utilize period=2025 para abranger os dados encontrados (MJD 60790 - 60998)
        period     = request.args.get("period", "2025")

        if period not in EPOCH_PRESETS:
            return jsonify({
                "status": "error",
                "message": f"Período inválido '{period}'. Opções permitidas: {list(EPOCH_PRESETS.keys())}"
            }), 400

        preset = EPOCH_PRESETS[period]

        result = find_closest_record(
            target_ra=ra,
            target_dec=dec,
            collection=collection,
            search_radius_arcsec=radius,
            band=band,
            band_alias_map=BAND_ALIASES,
            epoch_min=preset["epoch_min"],
            epoch_max=preset["epoch_max"],
        )

        if isinstance(result, dict) and "error_type" in result:
            return jsonify({
                "status": "error",
                "error_type": result["error_type"],
                "message": result["message"],
                "details": result.get("details", {})
            }), 404

        if result is None:
            return jsonify({"status": "error", "message": "Nenhum registro encontrado."}), 404

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
