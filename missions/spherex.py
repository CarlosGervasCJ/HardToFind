# missions/spherex.py
"""
Adaptador para os dados da missão SPHEREx.

SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of
Reionization and Ices Explorer) opera em 102 bandas espectrais cobrindo
0.75–5.0 µm, divididas em 6 canais (CH1–CH6).  Cada canal ilumina um
detector de 2040×2040 pixels com escala de placa ≈ 6.2 arcsec/pixel.

Estrutura de arquivos esperada no S3
--------------------------------------
  spherex/data/<coadd_id>/<coadd_id>-ch<CH>-epoch<EEE>-img.fits

Arquivos de índice esperados em disco
--------------------------------------
  spherex_index.fits   – índice time-resolved com colunas
                         COADD_ID, EPOCH, CHANNEL, MJDMEAN
  spherex_wcs.csv      – uma linha por coadd com colunas
                         COADD_ID, RA, DEC, CRPIX1, CRPIX2,
                         CD1_1, CD1_2, CD2_1, CD2_2

Como registrar no app.py
-------------------------
    from missions import SpherexMissionAdapter
    registry.register(
        "spherex",
        SpherexMissionAdapter(
            index_file="spherex_index.fits",
            wcs_file="spherex_wcs.csv",
            s3_manager=s3_mgr,
        )
    )
"""

from io import BytesIO

import astropy.io.fits as aif
import astropy.wcs as awcs
import numpy as np
import pandas as pd

from spatial import RDBallTree
from .base import BaseMissionAdapter
from .s3 import S3Manager


# Largura angular de cada tile SPHEREx em graus (≈3.5° × 3.5°)
_TILE_SIDE_DEG = 3.5
_TILE_RADIUS_DEG = np.sqrt(2) * (_TILE_SIDE_DEG / 2.0)

# Escala de placa SPHEREx em graus/pixel
_PLATE_SCALE_DEG = 6.2 / 3600.0

# Dimensão do detector em pixels
_DET_SIZE = 2040


class SpherexMissionAdapter(BaseMissionAdapter):
    """
    Adaptador para dados da missão SPHEREx.

    Implementa a mesma interface de BaseMissionAdapter que WiseMissionAdapter,
    permitindo uso transparente pelo MissionRegistry e pelos endpoints Flask.

    Parâmetros
    ----------
    index_file : str
        Caminho para ``spherex_index.fits`` (índice time-resolved).
    wcs_file   : str
        Caminho para ``spherex_wcs.csv`` (soluções WCS por coadd).
    s3_manager : S3Manager
        Instância já configurada do gerenciador S3.
    bucket_prefix : str
        Prefixo dos caminhos dentro do bucket S3.
    """

    MISSION_NAME = "spherex"
    AVAILABLE_BANDS = [f"CH{i}" for i in range(1, 7)]   # CH1 … CH6

    def __init__(
        self,
        index_file: str,
        wcs_file: str,
        s3_manager: S3Manager,
        bucket_prefix: str = "spherex/data",
    ):
        self.s3_manager = s3_manager
        self.bucket_prefix = bucket_prefix

        # --- WCS por coadd ---
        wcs_df = pd.read_csv(wcs_file)
        self._wcs_cache: dict[str, awcs.WCS] = {}
        for _, row in wcs_df.iterrows():
            self._wcs_cache[row["COADD_ID"]] = self._build_wcs(row)

        # --- Árvore espacial para busca de tiles ---
        self.tile_tree = RDBallTree(wcs_df[["COADD_ID", "RA", "DEC"]])

        # --- Índice temporal ---
        data = aif.open(index_file)[1].data
        self.tr_index = (
            pd.DataFrame(data.tolist(), columns=data.names)
            .set_index(["COADD_ID", "EPOCH", "CHANNEL"])
        )

    # ------------------------------------------------------------------
    # BaseMissionAdapter interface
    # ------------------------------------------------------------------

    def get_wcs(self, coadd_id: str) -> awcs.WCS:
        return self._wcs_cache[coadd_id]

    def get_tiles(self, ra: float, dec: float) -> pd.DataFrame:
        """
        Retorna o subconjunto do índice temporal para todos os tiles/epochs
        que cobrem a posição (ra, dec).
        """
        nearby = self.tile_tree.query_radius(ra, dec, _TILE_RADIUS_DEG)
        valid_ids = []
        for tileofs in nearby[0][0]:
            coadd_id = self.tile_tree.table.iloc[tileofs]["COADD_ID"]
            wcs = self._wcs_cache[coadd_id]
            px, py = wcs.wcs_world2pix(np.array([[ra, dec]]), 0)[0]
            # Aceita apenas se o ponto cai dentro do detector
            if 0 < px < _DET_SIZE and 0 < py < _DET_SIZE:
                valid_ids.append(coadd_id)

        if not valid_ids:
            return pd.DataFrame()

        return self.tr_index.loc[(valid_ids, slice(None), slice(None)), :]

    def get_cutout(
        self,
        coadd_id: str,
        epoch: int,
        band: str,          # ex.: "CH1", "CH3"
        ra: float,
        dec: float,
        size: int,
        fits: bool = True,
    ):
        """
        Baixa e recorta a imagem SPHEREx correspondente ao coadd/epoch/canal.

        O canal pode ser fornecido como string (``"CH1"``) ou inteiro (``1``).
        """
        channel = str(band).upper().replace("CH", "")  # normaliza para "1"–"6"
        path_ = (
            f"{self.bucket_prefix}/{coadd_id}/"
            f"{coadd_id}-ch{channel}-epoch{int(epoch):03d}-img.fits"
        )

        sio = BytesIO()
        self.s3_manager.bucket.download_fileobj(path_, sio)
        sio.seek(0)

        hdul = aif.open(sio)
        wcs = self._wcs_cache[coadd_id]
        px, py = wcs.wcs_world2pix(np.array([[ra, dec]]), 0)[0]

        half = size // 2
        bot   = max(int(py) - half, 0)
        top   = min(int(py) + half + 1, _DET_SIZE)
        left  = max(int(px) - half, 0)
        right = min(int(px) + half + 1, _DET_SIZE)
        cut   = hdul[0].data[bot:top, left:right]

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

    @staticmethod
    def _build_wcs(row: pd.Series) -> awcs.WCS:
        """Constrói um WCS a partir de uma linha do spherex_wcs.csv."""
        h = aif.Header()
        h.extend([
            ("NAXIS",  2,          ""),
            ("NAXIS1", _DET_SIZE,  ""),
            ("NAXIS2", _DET_SIZE,  ""),
            ("CRPIX1", row.get("CRPIX1", _DET_SIZE / 2.0 + 0.5), ""),
            ("CRPIX2", row.get("CRPIX2", _DET_SIZE / 2.0 + 0.5), ""),
            ("CRVAL1", row["RA"],  ""),
            ("CRVAL2", row["DEC"], ""),
            ("CTYPE1", "RA---TAN", ""),
            ("CTYPE2", "DEC--TAN", ""),
            # Matriz CD padrão; sobrescrita pelos valores do CSV quando presentes.
            ("CD1_1", row.get("CD1_1", -_PLATE_SCALE_DEG), ""),
            ("CD1_2", row.get("CD1_2",  0.0),               ""),
            ("CD2_1", row.get("CD2_1",  0.0),               ""),
            ("CD2_2", row.get("CD2_2",  _PLATE_SCALE_DEG),  ""),
        ])
        return awcs.WCS(h)
