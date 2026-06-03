"""OpenCV template matching engine."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .exceptions import TemplateNotFoundError

logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    found: bool
    confidence: float
    x: int
    y: int
    top_left: tuple[int, int]
    template_name: str
    elapsed_ms: float


class TemplateMatcher:
    def __init__(self, templates_dir: Path, default_threshold: float = 0.85):
        self.templates_dir = Path(templates_dir)
        self.default_threshold = default_threshold
        self._cache: dict[str, np.ndarray] = {}

    def load_template(self, name: str) -> np.ndarray:
        if name in self._cache:
            return self._cache[name]
        path = self.templates_dir / f"{name}.png"
        if not path.exists():
            raise TemplateNotFoundError(f"Template not found: {path}")
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if img is None:
            raise TemplateNotFoundError(f"Failed to read template image: {path}")
        self._cache[name] = img
        return img

    def match(
        self,
        screen: np.ndarray,
        template_name: str,
        threshold: Optional[float] = None,
        grayscale: bool = True,
        scale_factors: tuple[float, ...] = (1.0,),
    ) -> MatchResult:
        t0 = time.perf_counter()
        thresh = threshold if threshold is not None else self.default_threshold
        template = self.load_template(template_name)

        best_val = 0.0
        best_loc: tuple[int, int] = (0, 0)
        best_tw, best_th = template.shape[1], template.shape[0]

        screen_work = self._to_gray(screen) if grayscale else screen

        for scale in scale_factors:
            if scale != 1.0:
                tmpl = cv2.resize(
                    template,
                    None,
                    fx=scale,
                    fy=scale,
                    interpolation=cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR,
                )
            else:
                tmpl = template

            th, tw = tmpl.shape[:2]
            if th > screen_work.shape[0] or tw > screen_work.shape[1]:
                continue

            tmpl_work = self._to_gray(tmpl) if grayscale else tmpl
            result = cv2.matchTemplate(screen_work, tmpl_work, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)

            if max_val > best_val:
                best_val = max_val
                best_loc = (max_loc[0], max_loc[1])
                best_tw, best_th = tw, th

        found = best_val >= thresh
        cx = best_loc[0] + best_tw // 2
        cy = best_loc[1] + best_th // 2
        elapsed = (time.perf_counter() - t0) * 1000

        if found:
            logger.debug(
                "match '%s': confidence=%.3f @ (%d,%d)",
                template_name, best_val, cx, cy,
            )
        else:
            logger.debug(
                "match '%s': no match (best=%.3f < %.3f)",
                template_name, best_val, thresh,
            )

        return MatchResult(
            found=found,
            confidence=best_val,
            x=cx,
            y=cy,
            top_left=best_loc,
            template_name=template_name,
            elapsed_ms=elapsed,
        )

    def match_any(
        self,
        screen: np.ndarray,
        template_names: list[str],
        threshold: Optional[float] = None,
    ) -> Optional[MatchResult]:
        for name in template_names:
            result = self.match(screen, name, threshold=threshold)
            if result.found:
                return result
        return None

    def match_all(
        self,
        screen: np.ndarray,
        template_name: str,
        threshold: Optional[float] = None,
    ) -> list[MatchResult]:
        thresh = threshold if threshold is not None else self.default_threshold
        template = self.load_template(template_name)
        th, tw = template.shape[:2]

        screen_gray = self._to_gray(screen)
        tmpl_gray = self._to_gray(template)

        result_map = cv2.matchTemplate(screen_gray, tmpl_gray, cv2.TM_CCOEFF_NORMED)
        locations = np.where(result_map >= thresh)

        results: list[MatchResult] = []
        for pt in zip(locations[1], locations[0]):
            cx = pt[0] + tw // 2
            cy = pt[1] + th // 2
            conf = float(result_map[pt[1], pt[0]])
            results.append(
                MatchResult(
                    found=True,
                    confidence=conf,
                    x=cx,
                    y=cy,
                    top_left=(pt[0], pt[1]),
                    template_name=template_name,
                    elapsed_ms=0.0,
                )
            )

        return self._nms(results)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _to_gray(self, img: np.ndarray) -> np.ndarray:
        if len(img.shape) == 2:
            return img
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    def _nms(
        self, results: list[MatchResult], overlap_threshold: float = 0.5
    ) -> list[MatchResult]:
        if not results:
            return []
        results = sorted(results, key=lambda r: r.confidence, reverse=True)
        kept: list[MatchResult] = []
        for candidate in results:
            suppressed = False
            for kept_r in kept:
                dx = abs(candidate.x - kept_r.x)
                dy = abs(candidate.y - kept_r.y)
                if dx < overlap_threshold * 50 and dy < overlap_threshold * 50:
                    suppressed = True
                    break
            if not suppressed:
                kept.append(candidate)
        return kept
