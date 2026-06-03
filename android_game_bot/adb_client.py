"""ADB connection management: screenshot capture and input event delivery."""

from __future__ import annotations

import io
import logging
import subprocess
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from PIL import Image

from .exceptions import AdbNotFoundError, DeviceNotConnectedError

logger = logging.getLogger(__name__)


@dataclass
class DeviceInfo:
    serial: str
    state: str
    model: str = ""
    android_version: str = ""


class AdbClient:
    def __init__(self, serial: Optional[str] = None, adb_path: str = "adb"):
        self.serial = serial
        self.adb_path = adb_path
        self._connected_serial: Optional[str] = None
        self._verify_adb()

    # ------------------------------------------------------------------
    # Device management
    # ------------------------------------------------------------------

    def list_devices(self) -> list[DeviceInfo]:
        output = self._run_raw("devices").decode(errors="replace")
        devices: list[DeviceInfo] = []
        for line in output.splitlines()[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            serial, state = parts[0], parts[1]
            devices.append(DeviceInfo(serial=serial, state=state))
        for dev in devices:
            if dev.state == "device":
                try:
                    dev.model = self._run_raw(
                        "-s", dev.serial, "shell", "getprop", "ro.product.model"
                    ).decode(errors="replace").strip()
                    dev.android_version = self._run_raw(
                        "-s", dev.serial, "shell", "getprop", "ro.build.version.release"
                    ).decode(errors="replace").strip()
                except Exception:
                    pass
        return devices

    def connect_device(self, serial: Optional[str] = None) -> DeviceInfo:
        target = serial or self.serial
        devices = self.list_devices()
        online = [d for d in devices if d.state == "device"]
        if not online:
            raise DeviceNotConnectedError(
                "No ADB devices in 'device' state. "
                "Run 'adb devices' or connect a device / emulator."
            )
        if target:
            match = next((d for d in online if d.serial == target), None)
            if match is None:
                raise DeviceNotConnectedError(
                    f"Device '{target}' not found. Available: {[d.serial for d in online]}"
                )
            self._connected_serial = target
            return match
        self._connected_serial = online[0].serial
        return online[0]

    # ------------------------------------------------------------------
    # Screen capture
    # ------------------------------------------------------------------

    def screenshot(self) -> np.ndarray:
        """
        Capture device screen as BGR numpy array via `adb exec-out screencap -p`.
        Returns shape (H, W, 3).
        """
        serial = self._require_serial()
        raw = self._run_raw("-s", serial, "exec-out", "screencap", "-p", timeout=15)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        arr = np.array(img)
        # PIL gives RGB; OpenCV expects BGR
        return arr[:, :, ::-1].copy()

    def get_screen_size(self) -> tuple[int, int]:
        """Return (width, height) in pixels."""
        serial = self._require_serial()
        out = self._run_raw("-s", serial, "shell", "wm", "size").decode(errors="replace")
        # Output: "Physical size: 1080x1920"
        part = out.split(":")[-1].strip()
        w, h = part.split("x")
        return int(w), int(h)

    # ------------------------------------------------------------------
    # Input events
    # ------------------------------------------------------------------

    def tap(self, x: int, y: int) -> None:
        serial = self._require_serial()
        self._run_raw("-s", serial, "shell", "input", "tap", str(x), str(y))
        logger.debug("tap(%d, %d)", x, y)

    def swipe(
        self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300
    ) -> None:
        serial = self._require_serial()
        self._run_raw(
            "-s", serial, "shell", "input", "swipe",
            str(x1), str(y1), str(x2), str(y2), str(duration_ms),
        )
        logger.debug("swipe(%d,%d → %d,%d, %dms)", x1, y1, x2, y2, duration_ms)

    def key_event(self, keycode: int) -> None:
        serial = self._require_serial()
        self._run_raw("-s", serial, "shell", "input", "keyevent", str(keycode))
        logger.debug("key_event(%d)", keycode)

    def long_tap(self, x: int, y: int, duration_ms: int = 1000) -> None:
        self.swipe(x, y, x, y, duration_ms)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _require_serial(self) -> str:
        if self._connected_serial:
            return self._connected_serial
        # Auto-connect if not explicitly done
        self.connect_device()
        return self._connected_serial  # type: ignore[return-value]

    def _verify_adb(self) -> None:
        try:
            subprocess.run(
                [self.adb_path, "version"],
                capture_output=True,
                check=True,
                timeout=5,
            )
        except FileNotFoundError:
            raise AdbNotFoundError(
                f"adb binary not found at '{self.adb_path}'. "
                "Install Android SDK Platform-Tools and add to PATH."
            )
        except subprocess.CalledProcessError as e:
            raise AdbNotFoundError(f"adb version check failed: {e}")

    def _run_raw(self, *args: str, timeout: int = 10) -> bytes:
        result = subprocess.run(
            [self.adb_path, *args],
            capture_output=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors="replace").strip()
            raise RuntimeError(f"adb command failed ({result.returncode}): {err}")
        return result.stdout
