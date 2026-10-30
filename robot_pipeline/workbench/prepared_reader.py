"""Standalone standard-library reader for robot_pipeline.prepared.v1 packages.

Copied verbatim into portable packages as reader.py. Images are bytes, not
pixel-decoded tensors. This is not the LeRobot training reader.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath, PureWindowsPath
import random


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def image_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png', '.png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg', '.jpg'
    if data[:6] in {b'GIF87a', b'GIF89a'}:
        return 'image/gif', '.gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp', '.webp'
    raise ValueError('unsupported image signature')


def inside(root, relative):
    if not isinstance(relative, str) or not relative or '\\' in relative:
        raise ValueError('invalid package path')
    if PurePosixPath(relative).is_absolute() or PureWindowsPath(relative).drive:
        raise ValueError('absolute package path')
    if any(p in {'', '.', '..'} for p in relative.split('/')):
        raise ValueError('package path traversal')
    root = Path(root).resolve(); path = root
    for part in relative.split('/'):
        path = path / part
        if path.is_symlink():
            raise ValueError('package symbolic link')
    if not path.resolve().is_relative_to(root) or not path.is_file():
        raise ValueError('package file unavailable: ' + relative)
    return path


def _json(root, name):
    return json.loads(inside(root, name).read_text(encoding='utf-8'))


def _image_bytes(root, paths):
    result = {}
    for camera, relative in paths.items():
        path = inside(root, relative)
        data = path.read_bytes(); image_type(data)
        if path.stem != hashlib.sha256(data).hexdigest():
            raise ValueError('package image checksum mismatch')
        result[camera] = data
    if not result:
        raise ValueError('sample has no images')
    return result


def _records(root):
    root = Path(root)
    contract = _json(root, 'contract.json')
    if contract.get('format') != 'robot_pipeline.prepared.v1':
        raise ValueError('unsupported project contract')
    manifest = _json(root, 'manifest.json')
    canonical = json.dumps(manifest, ensure_ascii=False, allow_nan=False,
                           sort_keys=True, separators=(',', ':')).encode('utf-8')
    if hashlib.sha256(canonical).hexdigest() != contract['manifest_sha256']:
        raise ValueError('package selection manifest checksum mismatch')
    records_path = inside(root, 'records.jsonl')
    if contract.get('records_sha256'):
        h = hashlib.sha256()
        with records_path.open('rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):
                h.update(block)
        if h.hexdigest() != contract['records_sha256']:
            raise ValueError('package records checksum mismatch')
    with records_path.open(encoding='utf-8') as handle:
        for line in handle:
            record = json.loads(line)
            state, action = record['observation.state'], record['action']
            if len(state) != 28 or len(action) != 28 or not all(finite(x) for x in state + action):
                raise ValueError('invalid project state/action')
            if record['split'] not in {'train', 'validation', 'test'}:
                raise ValueError('invalid sample split')
            yield record


def read_prepared_records(package_root):
    for record in _records(package_root):
        yield {'record': record, 'state': record['observation.state'],
               'action': record['action'], 'images': _image_bytes(package_root, record['images'])}


def read_prepared(package_root):
    """Public iterable sample interface for future training adapters."""
    return read_prepared_records(package_root)


def sample_prepared(package_root, count, *, seed=42, split='train'):
    if type(count) is not int or not 0 <= count <= 100000:
        raise ValueError('draw count must be an integer between 0 and 100000')
    if split not in {'train', 'validation', 'test'}:
        raise ValueError('unknown split')
    recipe = _json(package_root, 'sampling.json')
    manifest = _json(package_root, 'manifest.json')
    if recipe != manifest['sampling']:
        raise ValueError('sampling recipe differs from frozen manifest')
    records = [r for r in _records(package_root) if r['split'] == split]
    if not records:
        raise ValueError('selected split has no samples')
    rng = random.Random(seed)
    if split != 'train' or recipe['mode'] == 'natural':
        return [records[rng.randrange(len(records))] for _ in range(count)]
    buckets = {}
    for record in records:
        buckets.setdefault(record['source_kind'], []).append(record)
    kinds = [kind for kind, weight in recipe['weights'].items() if finite(weight) and weight > 0]
    if not kinds or any(kind not in buckets for kind in kinds):
        raise ValueError('positive-weight source has no training samples')
    chosen = rng.choices(kinds, weights=[recipe['weights'][kind] for kind in kinds], k=count)
    return [rng.choice(buckets[kind]) for kind in chosen]


def sample_batch(package_root, count, *, seed=42, split='train'):
    """Return sampled states/actions with actual encoded image bytes."""
    return [{'record': r, 'state': r['observation.state'], 'action': r['action'],
             'images': _image_bytes(package_root, r['images'])}
            for r in sample_prepared(package_root, count, seed=seed, split=split)]


def main(argv=None):
    parser = argparse.ArgumentParser(description='Read a portable project dataset; not LeRobot.')
    parser.add_argument('root', nargs='?', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--draws', type=int, default=32)
    parser.add_argument('--split', choices=('train', 'validation', 'test'), default='train')
    args = parser.parse_args(argv)
    frames = sum(1 for _ in read_prepared_records(args.root))
    distribution = {}
    for sample in sample_batch(args.root, args.draws, split=args.split):
        kind = sample['record']['source_kind']; distribution[kind] = distribution.get(kind, 0) + 1
    print(json.dumps({'valid': True, 'frames_checked': frames, 'sampled_source_counts': distribution,
                      'is_lerobot_dataset': False, 'official_reader_verified': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
