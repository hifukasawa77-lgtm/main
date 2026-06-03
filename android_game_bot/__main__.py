"""
Android Game Bot — entry point.

Usage:
    python -m android_game_bot [COMMAND] [OPTIONS]
    agb [COMMAND] [OPTIONS]           # if installed via pip install -e .
"""

from .cli import cli

if __name__ == "__main__":
    cli()
