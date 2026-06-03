"""Scenario loop execution engine."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

from .adb_client import AdbClient
from .matcher import TemplateMatcher, MatchResult
from .scenario import Action, Condition, Rule, Scenario, StopCondition

logger = logging.getLogger(__name__)


@dataclass
class IterationResult:
    iteration: int
    elapsed_seconds: float
    rule_fired: Optional[str]
    screenshot_path: Optional[str] = None


@dataclass
class ExecutionSummary:
    total_iterations: int
    total_elapsed_seconds: float
    stop_reason: str
    rules_fired: dict[str, int] = field(default_factory=dict)
    error: Optional[str] = None


class ScenarioExecutor:
    def __init__(
        self,
        adb: AdbClient,
        matcher: TemplateMatcher,
        scenario: Scenario,
        save_screenshots: bool = False,
        screenshots_dir: Optional[Path] = None,
        dry_run: bool = False,
    ):
        self.adb = adb
        self.matcher = matcher
        self.scenario = scenario
        self.save_screenshots = save_screenshots
        self.screenshots_dir = screenshots_dir or Path("screenshots")
        self.dry_run = dry_run
        self._rules = sorted(
            [r for r in scenario.rules if r.enabled],
            key=lambda r: r.priority,
            reverse=True,
        )

    def run(self) -> ExecutionSummary:
        rules_fired: dict[str, int] = {}
        start_time = time.time()
        iteration = 0

        if self.dry_run:
            logger.info("[DRY RUN] Actions will be evaluated but NOT sent to device.")

        logger.info("Starting scenario '%s'", self.scenario.name)

        try:
            while True:
                iteration += 1
                logger.debug("--- Iteration %d ---", iteration)

                try:
                    screen = self.adb.screenshot()
                except Exception as e:
                    logger.error("Screenshot failed: %s", e)
                    return ExecutionSummary(
                        total_iterations=iteration,
                        total_elapsed_seconds=time.time() - start_time,
                        stop_reason="error",
                        rules_fired=rules_fired,
                        error=str(e),
                    )

                if self.save_screenshots:
                    self._save_screenshot(screen, iteration)

                stop_reason = self._check_stop_conditions(
                    screen, iteration, start_time, self.scenario.stop_conditions
                )
                if stop_reason:
                    logger.info("Stop condition met: %s", stop_reason)
                    break

                rule = self._evaluate_rules(screen, iteration)
                if rule:
                    logger.info("Rule fired: '%s'", rule.name)
                    rules_fired[rule.name] = rules_fired.get(rule.name, 0) + 1
                    self._execute_actions(screen, rule.actions)
                else:
                    logger.debug("No rule matched this iteration.")

                time.sleep(self.scenario.interval_seconds)

        except KeyboardInterrupt:
            logger.info("Interrupted by user.")
            stop_reason = "keyboard_interrupt"

        elapsed = time.time() - start_time
        summary = ExecutionSummary(
            total_iterations=iteration,
            total_elapsed_seconds=elapsed,
            stop_reason=stop_reason,
            rules_fired=rules_fired,
        )
        logger.info(
            "Scenario finished. Iterations: %d | Elapsed: %.1fs | Stop: %s",
            summary.total_iterations,
            summary.total_elapsed_seconds,
            summary.stop_reason,
        )
        return summary

    # ------------------------------------------------------------------
    # Stop condition evaluation
    # ------------------------------------------------------------------

    def _check_stop_conditions(
        self,
        screen: np.ndarray,
        iteration: int,
        start_time: float,
        stop_conditions: list[StopCondition],
    ) -> Optional[str]:
        # max_iterations from scenario-level field
        if (
            self.scenario.max_iterations is not None
            and iteration > self.scenario.max_iterations
        ):
            return f"max_iterations ({self.scenario.max_iterations})"

        for sc in stop_conditions:
            if sc.type == "max_iterations" and sc.max_iterations is not None:
                if iteration > sc.max_iterations:
                    return f"max_iterations ({sc.max_iterations})"

            elif sc.type == "elapsed_seconds" and sc.elapsed_seconds is not None:
                elapsed = time.time() - start_time
                if elapsed >= sc.elapsed_seconds:
                    return f"elapsed_seconds ({sc.elapsed_seconds:.0f}s)"

            elif sc.type == "template_found" and sc.template:
                result = self.matcher.match(screen, sc.template)
                if result.found:
                    return f"template_found ({sc.template})"

        return None

    # ------------------------------------------------------------------
    # Rule evaluation
    # ------------------------------------------------------------------

    def _evaluate_rules(self, screen: np.ndarray, iteration: int) -> Optional[Rule]:
        for rule in self._rules:
            if self._check_rule_conditions(screen, rule, iteration):
                return rule
        return None

    def _check_rule_conditions(
        self, screen: np.ndarray, rule: Rule, iteration: int
    ) -> bool:
        if not rule.conditions:
            return True
        results = [
            self._evaluate_condition(screen, c, iteration) for c in rule.conditions
        ]
        if rule.condition_mode == "all":
            return all(results)
        return any(results)

    def _evaluate_condition(
        self, screen: np.ndarray, condition: Condition, iteration: int
    ) -> bool:
        if condition.type == "always":
            return True

        if condition.type == "iteration_mod":
            modulo = condition.modulo or 1
            return iteration % modulo == 0

        if condition.type == "template_found":
            result = self.matcher.match(
                screen, condition.template, threshold=condition.threshold
            )
            return result.found

        if condition.type == "template_not_found":
            result = self.matcher.match(
                screen, condition.template, threshold=condition.threshold
            )
            return not result.found

        return False

    # ------------------------------------------------------------------
    # Action execution
    # ------------------------------------------------------------------

    def _execute_actions(self, screen: np.ndarray, actions: list[Action]) -> None:
        for action in actions:
            self._execute_single_action(screen, action)

    def _execute_single_action(self, screen: np.ndarray, action: Action) -> None:
        if action.type == "tap":
            logger.info("Action: tap(%d, %d)", action.x, action.y)
            if not self.dry_run:
                self.adb.tap(action.x, action.y)

        elif action.type == "tap_match":
            result = self.matcher.match(screen, action.template)
            if result.found:
                tx = result.x + action.offset_x
                ty = result.y + action.offset_y
                logger.info(
                    "Action: tap_match '%s' @ (%d, %d)", action.template, tx, ty
                )
                if not self.dry_run:
                    self.adb.tap(tx, ty)
            else:
                logger.warning(
                    "tap_match: template '%s' not found on screen, skipping",
                    action.template,
                )

        elif action.type == "swipe":
            logger.info(
                "Action: swipe(%d,%d → %d,%d, %dms)",
                action.x, action.y, action.x2, action.y2, action.duration_ms,
            )
            if not self.dry_run:
                self.adb.swipe(action.x, action.y, action.x2, action.y2, action.duration_ms)

        elif action.type == "key_event":
            logger.info("Action: key_event(%d)", action.keycode)
            if not self.dry_run:
                self.adb.key_event(action.keycode)

        elif action.type == "wait":
            logger.info("Action: wait(%.2fs)", action.seconds)
            time.sleep(action.seconds)

        elif action.type == "log":
            msg = action.message or ""
            logger.info("[scenario log] %s", msg)

    # ------------------------------------------------------------------
    # Screenshot saving
    # ------------------------------------------------------------------

    def _save_screenshot(self, screen: np.ndarray, iteration: int) -> None:
        import cv2  # late import to keep module light if unused
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        path = self.screenshots_dir / f"iter_{iteration:05d}.png"
        cv2.imwrite(str(path), screen)
        logger.debug("Saved screenshot: %s", path)
