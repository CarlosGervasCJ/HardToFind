# image_processing.py
import astropy.visualization as av
import numpy as np
import scipy.ndimage
import skimage.exposure
import skimage.filters


def find_outlier_pixels(data, tolerance=3):
    data = skimage.exposure.rescale_intensity(data, out_range=(0, 1))
    blurred = scipy.ndimage.median_filter(data, size=3, mode="reflect")
    difference = data - blurred
    threshold = tolerance * np.std(difference)
    hot_pixels = np.nonzero(np.abs(difference) > threshold)

    fixed_image = np.copy(data)
    for y, x in zip(hot_pixels[0], hot_pixels[1]):
        fixed_image[y, x] = blurred[y, x]
    return hot_pixels, fixed_image


def apply_asinh_stretch(arr, linear=1e-5, mode="percent", trimbright=100.0):
    if mode == "percent":
        bounds = (max(np.min(arr), -250.0), np.percentile(arr, trimbright))
    elif mode == "fixed":
        bounds = (max(np.min(arr), -250.0), trimbright)
    else:
        bounds = (np.min(arr), np.max(arr))

    scaled = skimage.exposure.rescale_intensity(arr, in_range=bounds, out_range=(0, 1))
    _, filtered = find_outlier_pixels(scaled, tolerance=10)

    stretch = av.AsinhStretch(linear)
    stretched = stretch(filtered)
    return skimage.exposure.rescale_intensity(stretched, out_range=(0, 1))
