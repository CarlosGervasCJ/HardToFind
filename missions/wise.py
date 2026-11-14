
# missions/wise.py
from io import BytesIO

import astropy.io.fits as aif
import astropy.wcs as awcs
import numpy as np
import pandas as pd

from spatial import RDBallTree
from .base import BaseMissionAdapter
from .s3 import S3Manager


class WiseMissionAdapter(BaseMissionAdapter):
    """
    Adaptador para os dados da missão unWISE / WISE.

    Parâmetros
    ----------
    index_file : caminho para o arquivo FITS com o índice time-resolved
                 (ex.: "tr_neo7_index-mjd-forward.fits")
    wcs_file   : caminho para o CSV com soluções WCS por coadd
                 (ex.: "tr_neo4_wcs_sorted.csv")
    s3_manager : instância de S3Manager já configurada
    """

    MISSION_NAME = "wise"
    AVAILABLE_BANDS = ["W1", "W2", "W1+W2"]

    def __init__(self, index_file: str, wcs_file: str, s3_manager: S3Manager):
        self.s3_manager = s3_manager
        self.path = "unwise/data/timeresolved"

        # --- WCS por coadd ---
        wcs_index = pd.read_csv(wcs_file)
        self.tr_cutout_solutions: dict[str, awcs.WCS] = {}
        for _, row in wcs_index.iterrows():
            h = self._build_header(row)
            self.tr_cutout_solutions[row["COADD_ID"]] = awcs.WCS(h)

        self.tile_tree = RDBallTree(wcs_index[["COADD_ID", "RA", "DEC"]])

        # --- Índice temporal ---
        data = aif.open(index_file)[1].data
        self.tr_index = (
            pd.DataFrame(data.tolist(), columns=data.names)
            .set_index(["COADD_ID", "EPOCH", "BAND"])
        )
        self.tile_width_radius = np.sqrt(
            (((2048 * 2.75) / 3600.0 / 2.0) ** 2) * 2
        )

    # ------------------------------------------------------------------
    # BaseMissionAdapter interface
    # ------------------------------------------------------------------

    def get_wcs(self, coadd_id: str) -> awcs.WCS:
        return self.tr_cutout_solutions[coadd_id]

    def get_tiles(self, ra: float, dec: float) -> pd.DataFrame:
        nearby = self.tile_tree.query_radius(ra, dec, self.tile_width_radius)
        tiles = []
        for tileofs in nearby[0][0]:
            coadd_id = self.tile_tree.table.iloc[tileofs]["COADD_ID"]
            wcs = self.tr_cutout_solutions[coadd_id]
            px, py = wcs.wcs_world2pix(np.array([[ra, dec]]), 0)[0]
            px_norm = 2048 - px if px > 1024.5 else px
            py_norm = 2048 - py if py > 1024.5 else py
            if px_norm > 1 and py_norm > 1:
                tiles.append((min(px_norm, py_norm), coadd_id))

        tiles = sorted(tiles, key=lambda x: x[0], reverse=True)
        valid_ids = [x[1] for x in tiles]
        return self.tr_index.loc[(valid_ids, slice(None), slice(None)), :]

    def get_cutout(self, coadd_id: str, epoch: int, band: int,
                   ra: float, dec: float, size: int,
                   fits: bool = True):
        path_ = (
            f"{self.path}/e{int(epoch):03d}/{coadd_id[:3]}/{coadd_id}"
            f"/unwise-{coadd_id}-w{band}-img-m.fits"
        )
        sio = BytesIO()
        self.s3_manager.bucket.download_fileobj(path_, sio)
        sio.seek(0)

        hdul = aif.open(sio)
        wcs = self.tr_cutout_solutions[coadd_id]
        px, py = wcs.wcs_world2pix(np.array([[ra, dec]]), 0)[0]
        px += 0.5
        py += 0.5

        half = size // 2
        bot  = max(int(py) - half, 0)
        top  = min(int(py) + half + 1, 2048)
        left = max(int(px) - half, 0)
        right = min(int(px) + half + 1, 2048)
        cut = hdul[0].data[bot:top, left:right]

        if fits:
            cutf = aif.PrimaryHDU(cut, header=hdul[0].header)
            cutf.header["NAXIS1"] = cut.shape[1]
            cutf.header["NAXIS2"] = cut.shape[0]
            out_sio = BytesIO()
            cutf.writeto(out_sio)
            out_sio.seek(0)
            return out_sio.getvalue()
        return cut

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    def _build_header(self, coadd: pd.Series) -> aif.Header:
        h = aif.Header()
        h.extend([
            ("RA",     coadd["RA"],  ""),
            ("DEC",    coadd["DEC"], ""),
            ("FORWARD",coadd["FORWARD"], ""),
            ("NAXIS",  2,    ""),
            ("NAXIS1", 2048, ""),
            ("NAXIS2", 2048, ""),
            ("CRPIX1", 1024.5, ""),
            ("CRPIX2", 1024.5, ""),
            ("CRVAL1", coadd["RA"],  ""),
            ("CRVAL2", coadd["DEC"], ""),
            ("CTYPE1", "RA---TAN",  ""),
            ("CTYPE2", "DEC--TAN",  ""),
            ("CD1_1", -0.000763888888889, ""),
            ("CD1_2",  0.0, ""),
            ("CD2_1",  0.0, ""),
            ("CD2_2",  0.000763888888889, ""),
        ])
        return h
