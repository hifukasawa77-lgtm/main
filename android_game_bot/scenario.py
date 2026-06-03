"""YAML scenario loading and validation."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

from .exceptions import ScenarioParseError

logger = logging.getLogger(__name__)


@dataclass
class Condition:
    type: str
    template: Optional[str] = None
    threshold: Optional[float] = None
    modulo: Optional[int] = None


@dataclass
class Action:
    type: str
    x: Optional[int] = None
    y: Optional[int] = None
    x2: Optional[int] = None
    y2: Optional[int] = None
    duration_ms: int = 300
    keycode: Optional[int] = None
    seconds: float = 0.0
    message: Optional[str] = None
    template: Optional[str] = None
    offset_x: int = 0
    offset_y: int = 0


@dataclass
class Rule:
    name: str
    conditions: list[Condition]
    condition_mode: str = "all"
    actions: list[Action] = field(default_factory=list)
    priority: int = 0
    enabled: bool = True


@dataclass
class StopCondition:
    type: str
    template: Optional[str] = None
    max_iterations: Optional[int] = None
    elapsed_seconds: Optional[float] = None


@dataclass
class Scenario:
    name: str
    description: str = ""
    templates_dir: str = "templates"
    interval_seconds: float = 1.0
    max_iterations: Optional[int] = None
    rules: list[Rule] = field(default_factory=list)
    stop_conditions: list[StopCondition] = field(default_factory=list)


_VALID_CONDITION_TYPES = {"template_found", "template_not_found", "always", "iteration_mod"}
_VALID_ACTION_TYPES = {"tap", "tap_match", "swipe", "key_event", "wait", "log"}
_VALID_STOP_TYPES = {"template_found", "max_iterations", "elapsed_seconds"}


def load_scenario(path: Path) -> Scenario:
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise ScenarioParseError(f"YAML parse error in {path}: {e}")
    except OSError as e:
        raise ScenarioParseError(f"Cannot read scenario file {path}: {e}")

    if not isinstance(data, dict):
        raise ScenarioParseError(f"Scenario file must be a YAML mapping: {path}")

    name = data.get("name")
    if not name:
        raise ScenarioParseError("Scenario is missing required field 'name'")

    rules = [_parse_rule(r) for r in data.get("rules", [])]
    stop_conditions = [_parse_stop_condition(s) for s in data.get("stop_conditions", [])]

    return Scenario(
        name=str(name),
        description=str(data.get("description", "")),
        templates_dir=str(data.get("templates_dir", "templates")),
        interval_seconds=float(data.get("interval_seconds", 1.0)),
        max_iterations=_opt_int(data.get("max_iterations")),
        rules=rules,
        stop_conditions=stop_conditions,
    )


def _parse_rule(data: dict) -> Rule:
    name = data.get("name", "<unnamed>")
    raw_conditions = data.get("conditions", [])
    if not isinstance(raw_conditions, list):
        raise ScenarioParseError(f"Rule '{name}': 'conditions' must be a list")

    conditions = [_parse_condition(c, name) for c in raw_conditions]
    actions = [_parse_action(a, name) for a in data.get("actions", [])]
    condition_mode = data.get("condition_mode", "all")
    if condition_mode not in ("all", "any"):
        raise ScenarioParseError(
            f"Rule '{name}': condition_mode must be 'all' or 'any', got '{condition_mode}'"
        )

    return Rule(
        name=str(name),
        conditions=conditions,
        condition_mode=condition_mode,
        actions=actions,
        priority=int(data.get("priority", 0)),
        enabled=bool(data.get("enabled", True)),
    )


def _parse_condition(data: dict, rule_name: str = "") -> Condition:
    ctype = data.get("type")
    if ctype not in _VALID_CONDITION_TYPES:
        raise ScenarioParseError(
            f"Rule '{rule_name}': unknown condition type '{ctype}'. "
            f"Valid: {sorted(_VALID_CONDITION_TYPES)}"
        )
    if ctype in ("template_found", "template_not_found") and not data.get("template"):
        raise ScenarioParseError(
            f"Rule '{rule_name}': condition '{ctype}' requires 'template'"
        )
    if ctype == "iteration_mod" and not data.get("modulo"):
        raise ScenarioParseError(
            f"Rule '{rule_name}': condition 'iteration_mod' requires 'modulo'"
        )
    return Condition(
        type=ctype,
        template=data.get("template"),
        threshold=_opt_float(data.get("threshold")),
        modulo=_opt_int(data.get("modulo")),
    )


def _parse_action(data: dict, rule_name: str = "") -> Action:
    atype = data.get("type")
    if atype not in _VALID_ACTION_TYPES:
        raise ScenarioParseError(
            f"Rule '{rule_name}': unknown action type '{atype}'. "
            f"Valid: {sorted(_VALID_ACTION_TYPES)}"
        )
    if atype == "tap" and (data.get("x") is None or data.get("y") is None):
        raise ScenarioParseError(
            f"Rule '{rule_name}': action 'tap' requires 'x' and 'y'"
        )
    if atype == "tap_match" and not data.get("template"):
        raise ScenarioParseError(
            f"Rule '{rule_name}': action 'tap_match' requires 'template'"
        )
    if atype == "swipe" and any(
        data.get(k) is None for k in ("x", "y", "x2", "y2")
    ):
        raise ScenarioParseError(
            f"Rule '{rule_name}': action 'swipe' requires 'x', 'y', 'x2', 'y2'"
        )
    if atype == "key_event" and data.get("keycode") is None:
        raise ScenarioParseError(
            f"Rule '{rule_name}': action 'key_event' requires 'keycode'"
        )
    return Action(
        type=atype,
        x=_opt_int(data.get("x")),
        y=_opt_int(data.get("y")),
        x2=_opt_int(data.get("x2")),
        y2=_opt_int(data.get("y2")),
        duration_ms=int(data.get("duration_ms", 300)),
        keycode=_opt_int(data.get("keycode")),
        seconds=float(data.get("seconds", 0.0)),
        message=data.get("message"),
        template=data.get("template"),
        offset_x=int(data.get("offset_x", 0)),
        offset_y=int(data.get("offset_y", 0)),
    )


def _parse_stop_condition(data: dict) -> StopCondition:
    stype = data.get("type")
    if stype not in _VALID_STOP_TYPES:
        raise ScenarioParseError(
            f"Unknown stop_condition type '{stype}'. Valid: {sorted(_VALID_STOP_TYPES)}"
        )
    return StopCondition(
        type=stype,
        template=data.get("template"),
        max_iterations=_opt_int(data.get("max_iterations")),
        elapsed_seconds=_opt_float(data.get("elapsed_seconds")),
    )


def _opt_int(v) -> Optional[int]:
    return int(v) if v is not None else None


def _opt_float(v) -> Optional[float]:
    return float(v) if v is not None else None
