"""Audit exported v14 presentation geometry, original data, and portable links."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re
import tempfile
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/report"
NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []

    def handle_starttag(self, tag, attrs):
        self.targets.extend(v for k, v in attrs if k in {"src", "href"} and v)


def main():
    ppt = OUT / "具身智能数据管线报告_v14.pptx"
    archive = OUT / "robot_data_pipeline_report_windows_v14.zip"
    local_ppt_links, titles, bottoms = set(), [], []
    with zipfile.ZipFile(ppt) as z:
        assert z.testzip() is None
        slides = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        notes = [n for n in z.namelist() if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", n)]
        assert len(slides) == len(notes) == 29
        for name in slides:
            root = ET.fromstring(z.read(name))
            tree = root.find("p:cSld/p:spTree", NS)
            assert not tree.findall("p:grpSp", NS), "Add group coordinate handling before checking groups"
            for obj in tree:
                prop = obj.find(".//p:cNvPr", NS)
                label = prop.get("name", "") if prop is not None else ""
                assert label != "content-page" and not re.fullmatch(r"chapter-p-\d+", label)
                frame = obj.find(".//a:xfrm", NS)
                if frame is None:
                    frame = obj.find("p:xfrm", NS)
                if frame is None:
                    continue
                off, size = frame.find("a:off", NS), frame.find("a:ext", NS)
                if off is None or size is None:
                    continue
                bottom = int(off.get("y")) + int(size.get("cy"))
                bottoms.append(bottom)
                assert bottom <= 6390000, (name, label, bottom)
                if label in {"title", "slide-title"}:
                    assert int(off.get("x")) == int(off.get("y")) == 396000
                    assert all(p.get("algn", "l") == "l" for p in obj.findall(".//a:pPr", NS))
                    titles.append(name)
        assert len(titles) == 29
        for name in z.namelist():
            if name.endswith(".xml") and name.startswith(("ppt/slides/", "ppt/slideMasters/", "ppt/slideLayouts/")):
                root = ET.fromstring(z.read(name))
                assert not root.findall('.//p:ph[@type="sldNum"]', NS)
                assert not [n for n in root.findall(".//a:fld", NS) if "slidenum" in n.get("type", "").lower()]
            if name.startswith("ppt/slides/_rels/") and name.endswith(".rels"):
                for rel in ET.fromstring(z.read(name)):
                    if rel.get("Type", "").endswith("/hyperlink"):
                        target = rel.get("Target", "")
                        if not urlsplit(target).scheme and not target.startswith("#"):
                            assert not target.startswith(("/", "\\"))
                            local_ppt_links.add(unquote(target))

    raw_path = ROOT / "examples/raw/official_rerun_testdata/episode_0006/data.json"
    raw = json.loads(raw_path.read_text())
    provenance = json.loads((ROOT / "evidence/report_raw_episode_2026-10-26/source_manifest.json").read_text())
    assert sha(raw_path) == provenance["json_sha256"]
    groups = ["left_arm", "right_arm", "left_hand", "right_hand"]
    assert len(raw["data"]) == 167
    for row in raw["data"]:
        for field in ["states", "actions"]:
            assert all(len(row[field][g]["qpos"]) == 7 for g in groups)
            assert row[field]["body"] is None

    html_links = 0
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        with tempfile.TemporaryDirectory(prefix="报告迁移 中文 空格 ") as temp:
            z.extractall(temp)
            folder = Path(temp) / "robot_data_pipeline_report"
            assert sha(folder / ppt.name) == sha(ppt)
            assert sha(folder / "resources/raw/episode_0006/data.json") == sha(raw_path)
            for target in local_ppt_links:
                assert (folder / target).is_file(), target
            for f in folder.rglob("*.html"):
                parser = Links()
                parser.feed(f.read_text())
                for target in parser.targets:
                    split = urlsplit(target)
                    if split.scheme or not split.path:
                        continue
                    path = unquote(split.path)
                    assert not path.startswith(("/", "\\"))
                    assert (f.parent / path).exists(), (f.relative_to(folder), target)
                    html_links += 1
            for row in raw["data"]:
                for target in row["colors"].values():
                    assert (folder / "resources/raw/episode_0006" / target).is_file()

    result = {"date": "2026-10-26", "revision": "v14", "status": "pass",
              "slide_count": 29, "speaker_note_count": 29,
              "title_count": len(titles), "title_left_cm": 1.1, "title_top_cm": 1.1,
              "title_alignment": "left", "page_markers": 0,
              "automatic_slide_number_fields": 0, "footer_reserved_cm": 1.3,
              "max_foreground_bottom_emu": max(bottoms), "footer_safe_top_emu": 6390000,
              "raw_json_sha256": sha(raw_path), "raw_bytes_unchanged": True,
              "raw_joint_name_counts": {k: len(v) for k, v in raw["info"]["joint_names"].items()},
              "raw_record_count": 167, "state_and_action_group_dimensions": {g: 7 for g in groups},
              "raw_body": None, "portable_ppt_links_checked": sorted(local_ppt_links),
              "portable_html_links_checked": html_links,
              "relocation_test": "ZIP extracted into a temporary Chinese path with spaces; links and bytes checked",
              "native_windows_powerpoint_playback": "not performed",
              "presentation_sha256": sha(ppt), "archive_sha256": sha(archive)}
    target = ROOT / "evidence/implementation/report_v14_delivery_audit_2026-10-26.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
