# missions/base.py
from abc import ABC, abstractmethod


class BaseMissionAdapter(ABC):
    """
    Classe base para todos os adaptadores de missão.

    Qualquer nova missão (WISE, SPHEREx, Euclid, etc.) deve herdar desta
    classe e implementar os três métodos abaixo. Isso garante que o restante
    do sistema (app.py, logic.js via /tiles e /cutout) funcione de forma
    idêntica independentemente da missão ativa.
    """

    # Subclasses devem declarar o nome canônico da missão e as bandas disponíveis.
    MISSION_NAME: str = ""
    AVAILABLE_BANDS: list[str] = []

    @abstractmethod
    def get_tiles(self, ra: float, dec: float):
        """
        Retorna um DataFrame com os tiles/coadds que cobrem (ra, dec).

        O índice deve ter pelo menos os níveis COADD_ID, EPOCH e BAND,
        e cada linha deve ter a coluna MJDMEAN.
        """
        raise NotImplementedError

    @abstractmethod
    def get_cutout(self, coadd_id: str, epoch: int, band, ra: float,
                   dec: float, size: int, fits: bool = True):
        """
        Retorna os bytes de um recorte de imagem (FITS ou array bruto).

        Parâmetros
        ----------
        coadd_id : identificador do coadd/tile
        epoch    : número do epoch
        band     : banda (inteiro ou string dependendo da missão)
        ra, dec  : coordenadas do centro do recorte em graus
        size     : metade do lado do recorte em pixels
        fits     : True → devolve bytes FITS; False → devolve ndarray
        """
        raise NotImplementedError

    @abstractmethod
    def get_wcs(self, coadd_id: str):
        """Devolve o objeto astropy.wcs.WCS associado ao coadd_id."""
        raise NotImplementedError
