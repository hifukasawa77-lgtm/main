"""Custom exceptions for android_game_bot."""


class AdbNotFoundError(RuntimeError):
    """Raised when the adb binary cannot be found."""


class DeviceNotConnectedError(RuntimeError):
    """Raised when no ADB device is available or the specified serial is not found."""


class TemplateNotFoundError(FileNotFoundError):
    """Raised when a template image file does not exist."""


class ScenarioParseError(ValueError):
    """Raised when a scenario YAML file is malformed or missing required fields."""


class MatchTimeoutError(TimeoutError):
    """Raised when a required template match does not appear within the timeout."""
