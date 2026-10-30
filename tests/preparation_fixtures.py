"""Small, explicitly synthetic raw episodes for preparation API and browser QA.

No robot, policy or simulator is contacted. Images are generated with Python's
standard library; their colours and numeric records vary deterministically.
"""
from __future__ import annotations

import argparse
import binascii
import json
from pathlib import Path
import shutil
import struct
import zlib

PARTS = ("left_arm", "right_arm", "left_ee", "right_ee")
TASK = "SYNTHETIC 数据准备流程测试，不是真机或搬箱示范"


def png_bytes(frame: int, variant: int = 0, width: int = 24, height: int = 16) -> bytes:
    """Create a valid RGB PNG without a graphics dependency."""
    def chunk(kind: bytes, value: bytes) -> bytes:
        return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", binascii.crc32(kind + value) & 0xFFFFFFFF)
    rows = []
    for y in range(height):
        pixels = bytearray()
        for x in range(width):
            pixels.extend(((frame * 17 + variant * 61 + x * 3) % 256,
                           (variant * 29 + y * 11) % 256,
                           (frame * 7 + x + y) % 256))
        rows.append(b"\x00" + bytes(pixels))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"".join(rows), 1)) + chunk(b"IEND", b"")


def write_episode(directory: Path, *, frames: int = 16, offset: float = 0.0,
                  variant: int = 0, missing_image_at: int | None = None,
                  timestamps: bool = True, image_reference: str | None = None) -> Path:
    """Write one raw episode. Refuse to overwrite an existing episode."""
    directory = Path(directory)
    if (directory / "data.json").exists():
        raise FileExistsError(directory / "data.json")
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "colors").mkdir(exist_ok=True)
    rows = []
    for index in range(frames):
        image = f"colors/{index:06d}.png"
        if index != missing_image_at:
            (directory / image).write_bytes(png_bytes(index, variant))
        states, actions = {}, {}
        for part_index, part in enumerate(PARTS):
            value = [round(offset + index * .01 + part_index * .1 + joint * .001, 6) for joint in range(7)]
            states[part] = {"qpos": value}
            actions[part] = {"qpos": [round(x + .005, 6) for x in value]}
        row = {"idx": index, "colors": {"color_0": image_reference or image},
               "states": states, "actions": actions}
        if timestamps:
            row["timestamp"] = round(index / 10, 6)
        rows.append(row)
    payload = {
        "info": {"version": "synthetic-preparation-fixture-v1", "synthetic": True,
                 "image": {"fps": 10.0, "width": 24, "height": 16},
                 "joint_names": {part: [f"SYNTHETIC_{part}_{i}" for i in range(7)] for part in PARTS}},
        "text": {"goal": TASK}, "data": rows,
    }
    (directory / "data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return directory


def make_suite(root: Path) -> dict[str, Path]:
    """Three independent valid groups, a missing-image group, and a duplicate."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    paths = {name: root / name for name in ("source_a", "source_b", "source_c", "bad_image", "source_a_copy")}
    write_episode(paths["source_a"] / "episode_0000", frames=16, offset=0.0, variant=1)
    write_episode(paths["source_b"] / "episode_0000", frames=18, offset=.4, variant=2)
    write_episode(paths["source_c"] / "episode_0000", frames=20, offset=.8, variant=3, timestamps=False)
    write_episode(paths["bad_image"] / "episode_0000", frames=12, offset=1.2, variant=4, missing_image_at=4)
    shutil.copytree(paths["source_a"], paths["source_a_copy"])
    return paths


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="生成明确标为 SYNTHETIC 的轻量数据准备测试样例")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    values = make_suite(args.output)
    print(json.dumps({"synthetic": True, "not_real_robot_data": True,
                      "paths": {key: str(path.resolve()) for key, path in values.items()}}, ensure_ascii=False, indent=2))
