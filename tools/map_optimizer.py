import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "map_config.json"

PRESETS = {
    "balanced": {
        "MAP_WIDTH": 4800,
        "MAP_HEIGHT": 3600,
        "MAX_ENEMIES": 24,
        "BUILDING_COUNT": 72,
        "TREE_COUNT": 260,
        "WATER_COUNT": 10,
        "ROAD_COUNT": 8,
        "DRAW_MARGIN": 220,
    },
    "performance": {
        "MAP_WIDTH": 3600,
        "MAP_HEIGHT": 2700,
        "MAX_ENEMIES": 16,
        "BUILDING_COUNT": 52,
        "TREE_COUNT": 180,
        "WATER_COUNT": 7,
        "ROAD_COUNT": 6,
        "DRAW_MARGIN": 180,
    },
    "expansion": {
        "MAP_WIDTH": 6000,
        "MAP_HEIGHT": 4200,
        "MAX_ENEMIES": 30,
        "BUILDING_COUNT": 92,
        "TREE_COUNT": 320,
        "WATER_COUNT": 12,
        "ROAD_COUNT": 10,
        "DRAW_MARGIN": 240,
    },
}


def main():
    parser = argparse.ArgumentParser(description="Generate a tuned map configuration for the game")
    parser.add_argument("--preset", choices=PRESETS.keys(), default="balanced")
    args = parser.parse_args()

    config = PRESETS[args.preset]
    CONFIG_PATH.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {CONFIG_PATH.relative_to(ROOT)} with the '{args.preset}' preset.")
    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
