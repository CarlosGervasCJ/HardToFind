# endpoints/routes.py
import base64
from io import BytesIO

import numpy as np
from flask import Blueprint, jsonify, request
from PIL import Image

from image_processing import apply_asinh_stretch

api_bp = Blueprint("api", __name__)


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@api_bp.get("/")
def index():
    from flask import render_template
    return render_template("visualizer.html")


# ---------------------------------------------------------------------------
# GET /missions
# ---------------------------------------------------------------------------

@api_bp.get("/missions")
def get_missions():
    from main import get_registry
    registry = get_registry()

    missions = [
        {"name": name, "bands": registry.get(name).AVAILABLE_BANDS}
        for name in registry.list_missions()
    ]
    return jsonify({"missions": missions})


# ---------------------------------------------------------------------------
# GET /tiles
# ---------------------------------------------------------------------------

@api_bp.get("/tiles")
def get_tiles():
    from main import get_registry
    registry = get_registry()

    ra      = request.args.get("ra",      type=float)
    dec     = request.args.get("dec",     type=float)
    mission = request.args.get("mission", default="wise")

    if ra is None or dec is None:
        return jsonify({"error": "Parâmetros 'ra' e 'dec' são obrigatórios."}), 400

    adapter  = registry.get(mission)
    tiles_df = adapter.get_tiles(ra, dec)

    if tiles_df.empty:
        return jsonify({"tiles": []})

    res = {"tiles": []}
    for coadd_id, coadds in tiles_df.groupby(level=0):
        wcs    = adapter.get_wcs(coadd_id)
        px, py = wcs.wcs_world2pix(np.array([[ra, dec]]), 0)[0]
        res["tiles"].append({
            "coadd_id": str(coadd_id),
            "px":       float(px),
            "py":       float(py),
            "epochs": [
                {
                    "band":    c.name[2],
                    "epoch":   int(c.name[1]),
                    "mjdmean": float(c["MJDMEAN"]),
                }
                for _, c in coadds.iterrows()
            ],
        })
    return jsonify(res)


# ---------------------------------------------------------------------------
# GET /cutout
# ---------------------------------------------------------------------------

@api_bp.get("/cutout")
def get_cutout():
    from main import get_registry
    registry = get_registry()

    ra       = request.args.get("ra",       type=float)
    dec      = request.args.get("dec",      type=float)
    size     = request.args.get("size",     type=int)
    coadd_id = request.args.get("coadd_id")
    epoch    = request.args.get("epoch",    type=int)
    band     = request.args.get("band")
    mission  = request.args.get("mission",  default="wise")
    stretch  = request.args.get("stretch",  default="true").lower() == "true"

    if any(v is None for v in [ra, dec, size, coadd_id, epoch, band]):
        return jsonify({"error": "Parâmetros obrigatórios em falta."}), 400

    adapter = registry.get(mission)
    raw     = adapter.get_cutout(
        coadd_id=coadd_id,
        epoch=epoch,
        band=band,
        ra=ra,
        dec=dec,
        size=size,
        fits=False,
    )

    if stretch:
        raw = apply_asinh_stretch(raw)

    img_uint8 = (raw * 255).astype(np.uint8)
    pil_img   = Image.fromarray(img_uint8)
    buf       = BytesIO()
    pil_img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    return jsonify({"image": f"data:image/png;base64,{b64}"})


# ---------------------------------------------------------------------------
# GET /xref
# ---------------------------------------------------------------------------

@api_bp.get("/xref")
def get_xref():
    from main import get_xref
    xref = get_xref()

    ra  = request.args.get("ra",  type=float)
    dec = request.args.get("dec", type=float)

    if ra is None or dec is None:
        return jsonify({"error": "Parâmetros 'ra' e 'dec' são obrigatórios."}), 400

    subjects = xref.get_subjects(ra, dec)
    return jsonify({"ids": [s[0] for s in subjects]})
