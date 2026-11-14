# main.py
from flask import Flask

from endpoints.routes import api_bp

# ---------------------------------------------------------------------------
# Inicialização do Flask
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["PROPAGATE_EXCEPTIONS"] = True

# ---------------------------------------------------------------------------
# Serviços com lazy initialization — só carregados no primeiro pedido,
# evitando FileNotFoundError na importação pelo Vercel.
# ---------------------------------------------------------------------------
_registry = None
_xref = None


def get_registry():
    global _registry
    if _registry is None:
        from missions import (
            MissionRegistry,
            S3Manager,
            SpherexMissionAdapter,
            WiseMissionAdapter,
        )
        s3_mgr = S3Manager()
        _registry = MissionRegistry()
        _registry.register(
            "wise",
            WiseMissionAdapter(
                index_file="tr_neo7_index-mjd-forward.fits",
                wcs_file="tr_neo4_wcs_sorted.csv",
                s3_manager=s3_mgr,
            ),
        )
        _registry.register(
            "spherex",
            SpherexMissionAdapter(
                index_file="spherex_index.fits",
                wcs_file="spherex_wcs.csv",
                s3_manager=s3_mgr,
                bucket_prefix="spherex/data",  # ajustar após confirmar o bucket real
            ),
        )
    return _registry


def get_xref():
    global _xref
    if _xref is None:
        from spatial import CoordinateLookup
        _xref = CoordinateLookup("wsubcache.csv")
    return _xref


# ---------------------------------------------------------------------------
# Registo do Blueprint
# ---------------------------------------------------------------------------
app.register_blueprint(api_bp)

# ---------------------------------------------------------------------------
# Ponto de entrada local
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
