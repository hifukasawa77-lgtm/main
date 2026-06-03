"""Interactive template capture helper."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .adb_client import AdbClient

logger = logging.getLogger(__name__)


def capture_template_interactive(
    adb: AdbClient,
    output_dir: Path,
    template_name: str,
    use_gui: bool = True,
) -> Path:
    """
    Take a screenshot and let the user crop a template region.

    use_gui=True : OpenCV window with mouse drag (requires display)
    use_gui=False: Terminal coordinate prompt (works headless / over SSH)

    Returns path to the saved PNG.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Capturing screenshot from device...")
    screen = adb.screenshot()
    h, w = screen.shape[:2]
    print(f"Screen size: {w}x{h}")

    if use_gui:
        try:
            x, y, rw, rh = _select_roi_gui(screen)
        except Exception as e:
            logger.warning("GUI selection failed (%s), falling back to terminal.", e)
            x, y, rw, rh = _select_roi_terminal(screen)
    else:
        x, y, rw, rh = _select_roi_terminal(screen)

    if rw <= 0 or rh <= 0:
        raise ValueError("Selected region has zero size. Template not saved.")

    crop = screen[y : y + rh, x : x + rw]
    out_path = output_dir / f"{template_name}.png"
    cv2.imwrite(str(out_path), crop)
    print(f"Template saved: {out_path}  ({rw}x{rh} px)")
    return out_path


def save_screenshot(adb: AdbClient, output_path: Path) -> Path:
    """Save a full device screenshot as PNG."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    screen = adb.screenshot()
    cv2.imwrite(str(output_path), screen)
    h, w = screen.shape[:2]
    print(f"Screenshot saved: {output_path}  ({w}x{h} px)")
    return output_path


def _select_roi_gui(screen: np.ndarray) -> tuple[int, int, int, int]:
    """Open OpenCV window; user drags a rectangle. Returns (x, y, w, h)."""
    window_title = "Select region — drag to select, ENTER/SPACE to confirm, C to cancel"
    # Resize display if screen is large
    h, w = screen.shape[:2]
    max_display = 900
    scale = min(max_display / w, max_display / h, 1.0)
    display = cv2.resize(screen, (int(w * scale), int(h * scale))) if scale < 1.0 else screen.copy()

    roi = cv2.selectROI(window_title, display, showCrosshair=True, fromCenter=False)
    cv2.destroyAllWindows()

    x, y, rw, rh = roi
    if scale < 1.0:
        x = int(x / scale)
        y = int(y / scale)
        rw = int(rw / scale)
        rh = int(rh / scale)

    return x, y, rw, rh


def _select_roi_terminal(screen: np.ndarray) -> tuple[int, int, int, int]:
    """Prompt user for crop coordinates on terminal."""
    h, w = screen.shape[:2]
    print(f"Screen dimensions: {w} x {h}")
    print("Enter crop coordinates (top-left x, top-left y, width, height):")

    x = _prompt_int("  x (left edge): ", 0, w - 1)
    y = _prompt_int("  y (top edge):  ", 0, h - 1)
    rw = _prompt_int(f"  width  (1–{w - x}): ", 1, w - x)
    rh = _prompt_int(f"  height (1–{h - y}): ", 1, h - y)

    return x, y, rw, rh


def _prompt_int(prompt: str, lo: int, hi: int) -> int:
    while True:
        try:
            val = int(input(prompt).strip())
            if lo <= val <= hi:
                return val
            print(f"  Please enter a value between {lo} and {hi}.")
        except ValueError:
            print("  Please enter an integer.")
