# main.py
from flask import Flask

from endpoints.routes import api_bp
from missions import (
    MissionRegistry,
    S3Manager,
    SpherexMissionAdapter,
    WiseMissionAdapter,
)
from spatial import CoordinateLookup

# ---------------------------------------------------------------------------
# Inicialização do Flask
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["PROPAGATE_EXCEPTIONS"] = True

# ---------------------------------------------------------------------------
# Serviços partilhados (acessíveis pelo routes.py via `from main import ...`)
# ---------------------------------------------------------------------------
s3_mgr = S3Manager()

registry = MissionRegistry()
registry.register(
    "wise",
    WiseMissionAdapter(
        index_file="tr_neo7_index-mjd-forward.fits",
        wcs_file="tr_neo4_wcs_sorted.csv",
        s3_manager=s3_mgr,
    ),
)
registry.register(
    "spherex",
    SpherexMissionAdapter(
        index_file="spherex_index.fits",
        wcs_file="spherex_wcs.csv",
        s3_manager=s3_mgr,
        bucket_prefix="spherex/data",  # ajustar após confirmar o bucket real
    ),
)

xref = CoordinateLookup("wsubcache.csv")

# ---------------------------------------------------------------------------
# Registo do Blueprint
# ---------------------------------------------------------------------------
app.register_blueprint(api_bp)

# ---------------------------------------------------------------------------
# Ponto de entrada local
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
