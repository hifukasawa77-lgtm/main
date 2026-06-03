"""Click CLI command definitions."""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

import click

from .adb_client import AdbClient
from .capture import capture_template_interactive, save_screenshot
from .exceptions import (
    AdbNotFoundError,
    DeviceNotConnectedError,
    ScenarioParseError,
    TemplateNotFoundError,
)
from .executor import ScenarioExecutor
from .matcher import TemplateMatcher
from .scenario import Scenario, load_scenario


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        level=level,
    )


def _make_adb(ctx_obj: dict) -> AdbClient:
    return AdbClient(serial=ctx_obj.get("serial"), adb_path=ctx_obj.get("adb_path", "adb"))


@click.group()
@click.option("--adb-path", default="adb", envvar="ADB_PATH", help="Path to adb binary")
@click.option(
    "--serial", "-s", default=None, envvar="ANDROID_SERIAL", help="Device serial number"
)
@click.option("--verbose", "-v", is_flag=True, default=False, help="Enable debug logging")
@click.pass_context
def cli(ctx: click.Context, adb_path: str, serial: Optional[str], verbose: bool) -> None:
    """Android Game Automation Bot

    Automates Android games via ADB using image pattern matching.

    Quickstart:
      1. Connect device/emulator: adb connect 127.0.0.1:5555
      2. Capture templates:      agb capture battle_button
      3. Write scenario YAML:    edit scenarios/my_game.yaml
      4. Run:                    agb run scenarios/my_game.yaml
    """
    ctx.ensure_object(dict)
    ctx.obj["adb_path"] = adb_path
    ctx.obj["serial"] = serial
    _setup_logging(verbose)


# ------------------------------------------------------------------
# devices
# ------------------------------------------------------------------


@cli.command()
@click.pass_context
def devices(ctx: click.Context) -> None:
    """List connected ADB devices."""
    try:
        adb = _make_adb(ctx.obj)
        devs = adb.list_devices()
    except AdbNotFoundError as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)

    if not devs:
        click.echo("No devices found. Run 'adb devices' to verify.")
        return

    click.echo(f"{'SERIAL':<25} {'STATE':<15} {'MODEL':<25} {'ANDROID'}")
    click.echo("-" * 75)
    for d in devs:
        click.echo(f"{d.serial:<25} {d.state:<15} {d.model:<25} {d.android_version}")


# ------------------------------------------------------------------
# screenshot
# ------------------------------------------------------------------


@cli.command()
@click.option(
    "--output", "-o", default="screenshot.png", type=click.Path(path_type=Path),
    help="Output PNG path (default: screenshot.png)"
)
@click.pass_context
def screenshot(ctx: click.Context, output: Path) -> None:
    """Capture and save a single screenshot from the device."""
    try:
        adb = _make_adb(ctx.obj)
        adb.connect_device()
        save_screenshot(adb, output)
    except (AdbNotFoundError, DeviceNotConnectedError) as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


# ------------------------------------------------------------------
# capture
# ------------------------------------------------------------------


@cli.command()
@click.argument("template_name")
@click.option(
    "--output-dir", "-o", default="templates", type=click.Path(path_type=Path),
    help="Directory to save the template PNG (default: templates/)"
)
@click.option(
    "--no-gui", is_flag=True, default=False,
    help="Use terminal coordinate input instead of OpenCV window"
)
@click.pass_context
def capture(ctx: click.Context, template_name: str, output_dir: Path, no_gui: bool) -> None:
    """Capture a template image by cropping the device screen.

    TEMPLATE_NAME is the stem of the output file (without .png).

    Example:
      agb capture battle_button --output-dir templates/
    """
    try:
        adb = _make_adb(ctx.obj)
        adb.connect_device()
        capture_template_interactive(
            adb, output_dir, template_name, use_gui=not no_gui
        )
    except (AdbNotFoundError, DeviceNotConnectedError) as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)
    except ValueError as e:
        click.echo(f"Capture failed: {e}", err=True)
        sys.exit(1)


# ------------------------------------------------------------------
# validate
# ------------------------------------------------------------------


@cli.command()
@click.argument("scenario_path", type=click.Path(exists=True, path_type=Path))
@click.pass_context
def validate(ctx: click.Context, scenario_path: Path) -> None:
    """Validate a scenario YAML file without running it."""
    try:
        scenario = load_scenario(scenario_path)
    except ScenarioParseError as e:
        click.echo(f"INVALID: {e}", err=True)
        sys.exit(1)

    click.echo(f"OK  Scenario: '{scenario.name}'")
    click.echo(f"    Rules: {len(scenario.rules)}")
    click.echo(f"    Stop conditions: {len(scenario.stop_conditions)}")
    click.echo(f"    Interval: {scenario.interval_seconds}s")
    if scenario.max_iterations:
        click.echo(f"    Max iterations: {scenario.max_iterations}")

    templates_dir = _resolve_templates_dir(scenario, scenario_path)
    templates_used: set[str] = set()
    for rule in scenario.rules:
        for c in rule.conditions:
            if c.template:
                templates_used.add(c.template)
        for a in rule.actions:
            if a.template:
                templates_used.add(a.template)
    for sc in scenario.stop_conditions:
        if sc.template:
            templates_used.add(sc.template)

    if templates_used:
        click.echo(f"\n    Templates ({len(templates_used)}):")
        for t in sorted(templates_used):
            path = templates_dir / f"{t}.png"
            status = "OK " if path.exists() else "MISSING"
            click.echo(f"      [{status}] {t}.png")


# ------------------------------------------------------------------
# run
# ------------------------------------------------------------------


@cli.command()
@click.argument("scenario_path", type=click.Path(exists=True, path_type=Path))
@click.option(
    "--templates-dir", "-t", default=None, type=click.Path(path_type=Path),
    help="Override templates directory from scenario YAML"
)
@click.option(
    "--interval", "-i", default=None, type=float,
    help="Override loop interval in seconds"
)
@click.option(
    "--max-iter", default=None, type=int,
    help="Override maximum iterations"
)
@click.option(
    "--save-screenshots", is_flag=True, default=False,
    help="Save a screenshot each iteration to ./screenshots/"
)
@click.option(
    "--screenshots-dir", default="screenshots", type=click.Path(path_type=Path),
    help="Directory for saved screenshots (default: screenshots/)"
)
@click.option(
    "--dry-run", is_flag=True, default=False,
    help="Evaluate rules but do NOT send any actions to the device"
)
@click.pass_context
def run(
    ctx: click.Context,
    scenario_path: Path,
    templates_dir: Optional[Path],
    interval: Optional[float],
    max_iter: Optional[int],
    save_screenshots: bool,
    screenshots_dir: Path,
    dry_run: bool,
) -> None:
    """Run an automation scenario.

    SCENARIO_PATH is the path to a YAML scenario file.

    Examples:
      agb run scenarios/auto_battle.yaml
      agb run scenarios/auto_battle.yaml --dry-run --max-iter 5
      agb run scenarios/auto_battle.yaml --save-screenshots
    """
    try:
        scenario = load_scenario(scenario_path)
    except ScenarioParseError as e:
        click.echo(f"Scenario error: {e}", err=True)
        sys.exit(1)

    # Apply CLI overrides
    if interval is not None:
        scenario.interval_seconds = interval
    if max_iter is not None:
        scenario.max_iterations = max_iter

    resolved_templates = (
        Path(templates_dir) if templates_dir else _resolve_templates_dir(scenario, scenario_path)
    )

    try:
        adb = _make_adb(ctx.obj)
        adb.connect_device()
    except (AdbNotFoundError, DeviceNotConnectedError) as e:
        click.echo(f"ADB error: {e}", err=True)
        sys.exit(1)

    matcher = TemplateMatcher(resolved_templates)

    executor = ScenarioExecutor(
        adb=adb,
        matcher=matcher,
        scenario=scenario,
        save_screenshots=save_screenshots,
        screenshots_dir=screenshots_dir,
        dry_run=dry_run,
    )

    summary = executor.run()

    click.echo("\n=== Execution Summary ===")
    click.echo(f"  Stop reason : {summary.stop_reason}")
    click.echo(f"  Iterations  : {summary.total_iterations}")
    click.echo(f"  Elapsed     : {summary.total_elapsed_seconds:.1f}s")
    if summary.rules_fired:
        click.echo("  Rules fired :")
        for name, count in sorted(summary.rules_fired.items(), key=lambda x: -x[1]):
            click.echo(f"    {name}: {count}x")
    if summary.error:
        click.echo(f"  Error: {summary.error}", err=True)
        sys.exit(1)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _resolve_templates_dir(scenario: Scenario, scenario_path: Path) -> Path:
    td = Path(scenario.templates_dir)
    if td.is_absolute():
        return td
    return (scenario_path.parent / td).resolve()
