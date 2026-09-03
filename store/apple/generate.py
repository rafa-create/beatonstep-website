"""Redirect — source of truth is store/generate.py (Brut → Apple + Play)."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parents[1] / "generate.py"), run_name="__main__")
