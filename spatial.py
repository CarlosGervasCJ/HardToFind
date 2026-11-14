# spatial.py
import os.path
import pickle

import astropy.io as aio
import numpy as np
import sklearn.neighbors as skn


def angsep(ra1deg, dec1deg, ra2deg, dec2deg):
    """Calcula a separação angular entre dois pontos em graus."""
    if abs(ra1deg - ra2deg) < 1e-7 and abs(dec1deg - dec2deg) < 1e-7:
        return 0.0
    ra1rad, dec1rad = np.deg2rad(ra1deg), np.deg2rad(dec1deg)
    ra2rad, dec2rad = np.deg2rad(ra2deg), np.deg2rad(dec2deg)

    x = np.cos(ra1rad) * np.cos(dec1rad) * np.cos(ra2rad) * np.cos(dec2rad)
    y = np.sin(ra1rad) * np.cos(dec1rad) * np.sin(ra2rad) * np.cos(dec2rad)
    z = np.sin(dec1rad) * np.sin(dec2rad)

    rad = np.arccos(np.clip(x + y + z, -1.0, 1.0))
    return np.rad2deg(rad)


class RDBallTree:
    """Wrapper para buscas espaciais rápidas usando scikit-learn BallTree."""

    def __init__(self, table, filename=None, rakey="RA", deckey="DEC"):
        self.table = table
        x = np.array(
            np.deg2rad([self.table[deckey], self.table[rakey]])
        ).transpose().reshape(-1, 2)

        if filename is not None and os.path.exists(filename):
            self.rdtree = pickle.load(open(filename, "rb"))
        else:
            self.rdtree = skn.BallTree(x, metric="haversine")
            if filename is not None:
                pickle.dump(self.rdtree, open(filename, "wb"))

    def query_radius(self, ra, dec, sep):
        ra, dec, sep = np.deg2rad(ra), np.deg2rad(dec), np.deg2rad(sep)
        x = np.array([[dec, ra]])
        return self.rdtree.query_radius(x, sep, return_distance=True)


class CoordinateLookup:
    """Gerencia o cruzamento de referências (Xref) por coordenadas."""

    def __init__(self, cachepath, fov=None):
        self.fov = fov or np.sqrt(((0.0975 * 2) ** 2) * 2)
        tbl = aio.ascii.Csv().read(cachepath)
        self.tree = RDBallTree(tbl, rakey="ra", deckey="de")

    def get_subjects(self, ra, dec):
        res = self.tree.query_radius(ra, dec, self.fov)
        sorted_res = [
            (self.tree.table["subject_id"][res[0][0][i]], res[1][0][i])
            for i in range(len(res[0][0]))
        ]
        return sorted(sorted_res, key=lambda x: x[1])
