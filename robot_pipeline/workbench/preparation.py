"""Episode selection, immutable dataset manifests and portable project-contract packages.

This module does not create LeRobot datasets or claim policy-training compatibility.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
import re
import threading
import zipfile
from pathlib import Path

from .data import vectors
from .paths import file_hash, read_json, within, write_json
from .store import identity, now
from .prepared_reader import read_prepared_records, read_prepared, sample_prepared, sample_batch

RESULTS = {'success', 'failure', 'interrupted', 'unlabeled'}
SPLITS = ('train', 'validation', 'test')
DEFAULT_SPLIT = {'train': 80, 'validation': 20, 'test': 0, 'seed': 42}
SOURCE_KINDS = {'self_capture', 'open', 'purchased', 'simulation'}
SOURCE_LABELS = {'self_capture': '自行采集（self_capture）', 'simulation': '仿真数据（simulation）',
                 'open': '开源数据（open）', 'purchased': '采购交付（purchased）'}
META_FIELDS = ('id', 'path', 'manifest_path', 'manifest_sha256', 'source_kind',
               'embodiment', 'task', 'license', 'synthetic', 'source_reference')
SCOPE = '项目28维臂手契约：结构、数值、引用与文件头；未核验物理同步、标定或任务成功。'


class PreparationConflict(ValueError):
    """An immutable object or a stale revision cannot be changed."""


def canonical(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False,
                      sort_keys=True, separators=(',', ':'))


def fingerprint(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def integer(value, name, minimum=0):
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise ValueError(name + ' 必须是有效的整数')
    return value


def short_text(value, name, limit=500):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(name + f' 必须是至多 {limit} 字符的文本')
    return value.strip()


def metadata(asset):
    return {key: asset.get(key) for key in META_FIELDS}


def image_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png', '.png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg', '.jpg'
    if data[:6] in {b'GIF87a', b'GIF89a'}:
        return 'image/gif', '.gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp', '.webp'
    raise ValueError('图像文件头不是支持的 PNG/JPEG/GIF/WebP')


class Preparation:
    def __init__(self, workspace, store):
        self.workspace = Path(workspace)
        self.store = store
        self.lock = threading.RLock()
        self.cache = {}

    def _annotation(self, episode_id):
        try:
            return self.store.get('annotation', episode_id)
        except ValueError:
            return {'id': episode_id, 'episode_id': episode_id, 'result': 'unlabeled',
                    'note': '', 'revision': 0}

    def _scan_asset(self, asset):
        root = within(self.workspace, asset['path'])
        manifest_path = within(self.workspace, asset['manifest_path'], exists=True)
        manifest = read_json(manifest_path)
        entries = {x['path']: x['sha256'] for x in manifest['files']}
        paths = [within(root,p.relative_to(root).as_posix(),exists=True)
                 for p in sorted(root.rglob('data.json'))]
        signature = (fingerprint(metadata(asset)), manifest_path.stat().st_mtime_ns,
                     tuple((str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in paths))
        cached = self.cache.get(asset['id'])
        if cached and cached[0] == signature:
            return cached[1]
        result = []
        manifest_ok = file_hash(manifest_path) == asset['manifest_sha256']
        for path in paths:
            relative = path.relative_to(root).as_posix()
            eid = hashlib.sha256((asset['id'] + '/' + relative).encode()).hexdigest()[:32]
            errors, warnings, cameras, times, image_hashes = [], [], set(), [], []
            extra_parts = set()
            frames, task, fps, parts, first_cameras = 0, asset.get('task', ''), None, None, None
            declared_synthetic = False
            raw_hash = file_hash(path)
            if not manifest_ok:
                errors.append('资产清单已被修改')
            if entries.get(relative) != raw_hash:
                errors.append('原始回合与导入快照不一致')
            try:
                obj = read_json(path)
                rows = obj.get('data') if isinstance(obj, dict) else None
                if not isinstance(rows, list) or not rows:
                    raise ValueError('回合 data 必须是非空列表')
                frames = len(rows)
                text = obj.get('text') or {}
                if isinstance(text, dict) and isinstance(text.get('goal'), str):
                    task = text['goal']
                info = obj.get('info') or {}
                declared_synthetic = isinstance(info,dict) and info.get('synthetic') is True
                if isinstance(info, dict) and isinstance(info.get('image'), dict):
                    value = info['image'].get('fps')
                    fps = value if finite(value) and value > 0 else None
                for index, row in enumerate(rows):
                    try:
                        if not isinstance(row, dict) or type(row.get('idx')) is not int or row['idx'] != index:
                            raise ValueError('idx 必须是从零连续的整数')
                        _, names = vectors(row)
                        for block in ('states','actions'):
                            extra_parts.update(k for k,v in row[block].items()
                                               if k not in {'left_arm','right_arm','left_ee','right_ee','left_hand','right_hand'} and v is not None)
                        if parts is not None and parts != names:
                            raise ValueError('回合内部位字段发生变化')
                        parts = names
                        colors = row.get('colors')
                        if not isinstance(colors, dict) or not colors:
                            raise ValueError('缺少 colors 图像引用')
                        keys = set(colors)
                        if first_cameras is None:
                            first_cameras = keys
                        if keys != first_cameras:
                            raise ValueError('回合内相机通道不一致')
                        cameras.update(keys)
                        for camera, value in sorted(colors.items()):
                            if not isinstance(camera, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,100}',camera):
                                raise ValueError('相机名称无效')
                            image = within(path.parent, value, exists=True)
                            rel = image.relative_to(root).as_posix()
                            if rel not in entries:
                                raise ValueError('图像不在导入清单中')
                            image_hashes.append((camera, entries[rel]))
                        t = row.get('timestamp')
                        if t is not None and not finite(t):
                            raise ValueError('timestamp 不是有限数值')
                        times.append(t)
                    except (ValueError, TypeError, KeyError, OSError) as exc:
                        if len(errors) < 50:
                            errors.append(f'第 {index} 帧：{exc}')
                has_times = len(times) == frames and all(finite(t) for t in times)
                if has_times and any(b <= a for a, b in zip(times, times[1:])):
                    errors.append('时间戳未严格递增')
                    has_times = False
                if not has_times:
                    warnings.append('缺少完整可核验时间戳；不推算实际采集时间')
                if extra_parts:
                    warnings.append('项目28维读取器未导出额外部位字段：'+', '.join(sorted(extra_parts)))
            except (ValueError, TypeError, KeyError, OSError) as exc:
                errors.append(str(exc))
                has_times = False
            item = {'id': eid, 'asset_id': asset['id'], 'asset_name': asset['name'],
                    'relative_path': relative, 'raw_sha256': raw_hash,
                    'source_kind': asset['source_kind'], 'synthetic': bool(asset.get('synthetic') or declared_synthetic),
                    'embodiment': asset.get('embodiment', ''), 'task': task,
                    'frames': frames, 'nominal_fps': fps, 'has_timestamps': has_times,
                    'duration': times[-1] - times[0] if has_times else None,
                    'camera_keys': sorted(cameras),
                    'group_fingerprint': fingerprint({'raw': raw_hash, 'images': image_hashes}),
                    'quality': {'valid': not errors, 'errors': errors, 'warnings': warnings,
                                'scope': SCOPE},
                    'metadata_sha256': fingerprint(metadata(asset))}
            item['snapshot_valid'] = manifest_ok and entries.get(relative) == raw_hash
            result.append(item)
        self.cache[asset['id']] = (signature, result)
        return result

    def episodes(self, filters=None):
        filters = filters or {}
        values = []
        for asset in self.store.all('asset'):
            if filters.get('asset_id') and asset['id'] != filters['asset_id']:
                continue
            for base in self._scan_asset(asset):
                item = dict(base)
                item['annotation'] = self._annotation(item['id'])
                if filters.get('source_kind') and item['source_kind'] != filters['source_kind']:
                    continue
                if filters.get('result') and item['annotation']['result'] != filters['result']:
                    continue
                q = filters.get('q', '').strip().casefold()
                if q and q not in (' '.join((item['task'], item['asset_name'],
                                            item['annotation']['note']))).casefold():
                    continue
                values.append(item)
        return values

    def episode(self, episode_id):
        for item in self.episodes():
            if item['id'] == episode_id:
                return item
        raise ValueError('回合不存在，请刷新数据目录')

    def _raw(self, episode):
        asset = self.store.get('asset', episode['asset_id'])
        path = within(within(self.workspace, asset['path']), episode['relative_path'], exists=True)
        return asset, path, read_json(path)

    def frame(self, episode_id, index):
        index = integer(index, '帧索引')
        episode = self.episode(episode_id)
        _, _, obj = self._raw(episode)
        if index >= episode['frames']:
            raise ValueError('帧索引超出回合范围')
        row = obj['data'][index]
        if not isinstance(row,dict):
            raise ValueError('原始帧不是有效对象')
        (state, action), _ = vectors(row)
        images = [{'camera': name, 'url': f'/api/episodes/{episode_id}/images/{index}/{name}'}
                  for name in sorted(row.get('colors', {}))]
        return {'episode_id': episode_id, 'index': index, 'timestamp': row.get('timestamp'),
                'state': state, 'action': action, 'states': row.get('states'),
                'actions': row.get('actions'), 'images': images}

    def image(self, episode_id, index, camera):
        episode = self.episode(episode_id)
        _, path, obj = self._raw(episode)
        index = integer(index, '帧索引')
        if index >= episode['frames'] or camera not in obj['data'][index].get('colors', {}):
            raise ValueError('图像引用不存在')
        target = within(path.parent, obj['data'][index]['colors'][camera], exists=True)
        data = target.read_bytes()
        mime, _ = image_type(data)
        return data, mime

    def annotate(self, episode_id, payload):
        self.episode(episode_id)
        result = payload.get('result')
        if result not in RESULTS:
            raise ValueError('任务结果必须为 success/failure/interrupted/unlabeled')
        note = short_text(payload.get('note', ''), '备注', 1000)
        with self.lock:
            old = self._annotation(episode_id)
            if 'revision' in payload and payload['revision'] != old['revision']:
                raise PreparationConflict('标记已被其他操作更新，请刷新')
            value = {'id': episode_id, 'episode_id': episode_id, 'result': result,
                     'note': note, 'revision': old['revision'] + 1, 'updated_at': now()}
            return self.store.put('annotation', value)

    def _configuration(self, payload):
        split = payload.get('split', DEFAULT_SPLIT)
        if not isinstance(split, dict):
            raise ValueError('划分配置必须为对象')
        proportions = {name: split.get(name, DEFAULT_SPLIT[name]) for name in SPLITS}
        if not all(finite(x) and 0 <= x <= 100 for x in proportions.values()) or abs(sum(proportions.values()) - 100) > 1e-7:
            raise ValueError('训练/验证/测试比例必须非负且合计100')
        proportions['seed'] = integer(split.get('seed', 42), '划分种子')
        sampling = payload.get('sampling', {'mode': 'natural'})
        if not isinstance(sampling, dict) or sampling.get('mode', 'natural') not in {'natural', 'weighted'}:
            raise ValueError('采样模式无效')
        mode = sampling.get('mode', 'natural')
        weights = sampling.get('weights', {})
        if not isinstance(weights, dict) or set(weights) - SOURCE_KINDS:
            raise ValueError('来源采样配置无效')
        if not all(finite(x) and x >= 0 for x in weights.values()):
            raise ValueError('来源权重必须为非负有限数值')
        if mode == 'weighted' and (not weights or not finite(sum(weights.values())) or sum(weights.values()) <= 0):
            raise ValueError('加权采样至少需要一个正权重')
        return proportions, {'mode': mode, 'weights': weights if mode == 'weighted' else {}}

    def _resolve(self, items, split, sampling):
        if not isinstance(items, list) or len(items) > 2000:
            raise ValueError('选择应为至多2000项的列表')
        catalog = {x['id']: x for x in self.episodes()}
        problems, warnings, resolved, ranges = [], [], [], {}
        if not items:
            problems.append('尚未选择回合或片段')
        for item in items:
            if not isinstance(item, dict) or item.get('episode_id') not in catalog:
                raise ValueError('选择引用了不存在的回合')
            episode = catalog[item['episode_id']]
            if not episode['snapshot_valid']:
                problems.append(episode['asset_name'] + ' 的原始回合或资产清单已变化，请重新导入')
            start = integer(item.get('start_frame', 0), '片段起点')
            end = integer(item.get('end_frame', episode['frames']), '片段终点')
            if not 0 <= start < end <= episode['frames']:
                raise ValueError('片段必须为回合内非空的半开区间 [start_frame,end_frame)')
            previous = ranges.setdefault(episode['id'], [])
            if any(start < b and end > a for a, b in previous):
                raise ValueError('同一回合的选择区间重叠，请合并或调整片段')
            previous.append((start, end))
            task = short_text(item.get('task') or episode['task'], '片段任务', 500)
            asset, path, obj = self._raw(episode)
            errors, camera_keys, duration = self._check_selection(path, obj, start, end)
            if errors:
                problems.extend(f"{episode['asset_name']} [{start},{end})：{x}" for x in errors[:10])
            if episode['quality']['errors'] and not errors:
                warnings.append(episode['asset_name'] + ' 原回合有问题，当前片段在限定检查范围内通过')
            for message in episode['quality']['warnings']:
                warnings.append(episode['asset_name'] + '：' + message)
            if not task:
                warnings.append(episode['asset_name'] + ' 任务说明待补充')
            resolved.append({'selection_id': fingerprint({'episode': episode['id'], 'start': start,
                                                         'end': end, 'task': task})[:24],
                             'episode_id': episode['id'], 'asset_id': asset['id'],
                             'relative_path': episode['relative_path'], 'start_frame': start,
                             'end_frame': end, 'frames': end - start, 'duration_s': duration,
                             'task': task, 'camera_keys': camera_keys,
                             'group_fingerprint': episode['group_fingerprint'],
                             'raw_sha256': episode['raw_sha256'],
                             'metadata_sha256': episode['metadata_sha256'],
                             'source_kind': episode['source_kind'], 'synthetic': episode['synthetic'],
                             'source': metadata(asset), 'annotation': episode['annotation']})
        schemas = {tuple(x['camera_keys']) for x in resolved}
        if len(schemas) > 1:
            problems.append('所选数据的相机通道不一致，需要先提供已验证的通道映射')
        embodiments = {x['source'].get('embodiment') for x in resolved}
        if len(embodiments) > 1:
            warnings.append('来源本体说明不同：本包仅验收项目28维读取，尚未确认动作/本体语义兼容')
        if resolved:
            warnings.append('动作语义、标定和物理同步尚未验证；项目数据包不等于官方 LeRobot 训练数据')
        groups = sorted({x['group_fingerprint'] for x in resolved})
        rng = random.Random(split['seed']); rng.shuffle(groups)
        positive = [name for name in SPLITS if split[name] > 0]
        counts = {name: 0 for name in SPLITS}
        if len(groups) < len(positive):
            problems.append(f'仅有{len(groups)}个独立原始回合组，无法划分为{len(positive)}个非空集合；请补充数据或显式选择100/0/0')
        elif groups:
            for name in positive:
                counts[name] = 1
            for _ in range(len(groups) - len(positive)):
                name = max(positive, key=lambda n: len(groups) * split[n] / 100 - counts[n])
                counts[name] += 1
        assignments, offset = {}, 0
        for name in SPLITS:
            for group in groups[offset:offset + counts[name]]:
                assignments[group] = name
            offset += counts[name]
        split_summary = {name: {'group_count': counts[name], 'clip_count': 0, 'frame_count': 0} for name in SPLITS}
        sources = {}
        for item in resolved:
            item['split'] = assignments.get(item['group_fingerprint'])
            if item['split']:
                bucket = split_summary[item['split']]
                bucket['clip_count'] += 1; bucket['frame_count'] += item['frames']
            source = sources.setdefault(item['source_kind'], {'episode_ids': set(), 'clip_count': 0, 'frame_count': 0})
            source['episode_ids'].add(item['episode_id']); source['clip_count'] += 1; source['frame_count'] += item['frames']
        train_counts = {}
        for item in resolved:
            if item['split'] == 'train':
                train_counts[item['source_kind']] = train_counts.get(item['source_kind'], 0) + item['frames']
        if not train_counts and resolved and not problems:
            problems.append('训练集合为空')
        if sampling['mode'] == 'weighted':
            for source, weight in sampling['weights'].items():
                if weight > 0 and not train_counts.get(source):
                    problems.append(SOURCE_LABELS.get(source, source) + ' 被分配正采样权重，但训练集合没有该来源样本')
            for source in train_counts:
                if source not in sampling['weights']:
                    problems.append(source + ' 尚未设置训练采样权重（可显式设为0）')
        if len(groups) < len({x['episode_id'] for x in resolved}):
            warnings.append('检测到跨资产的重复原始回合，已按同组划分，重复项不会被计为独立回合组')
        if split['validation'] == 0 or split['test'] == 0:
            warnings.append('存在未留出的验证/测试集合；本包不据此声称已经评估泛化效果')
        duration_values = [x['duration_s'] for x in resolved]
        summary = {'episode_count': len({x['episode_id'] for x in resolved}), 'clip_count': len(resolved),
                   'frame_count': sum(x['frames'] for x in resolved), 'group_count': len(groups),
                   'contains_synthetic': any(x['synthetic'] for x in resolved),
                   'synthetic_clip_count': sum(x['synthetic'] for x in resolved),
                   'duration_s': sum(duration_values) if all(x is not None for x in duration_values) else None,
                   'sources': {kind: {'episode_count': len(value['episode_ids']), 'clip_count': value['clip_count'],
                                     'frame_count': value['frame_count']} for kind, value in sources.items()}}
        return resolved, summary, list(dict.fromkeys(problems)), list(dict.fromkeys(warnings)), split_summary

    def _check_selection(self, path, obj, start, end):
        errors, cameras, timestamps, parts = [], None, [], None
        for index in range(start, end):
            try:
                row = obj['data'][index]
                if not isinstance(row,dict):
                    raise ValueError('原始帧不是有效对象')
                if type(row.get('idx')) is not int or row['idx'] != index:
                    raise ValueError('原始 idx 与母回合帧位置不一致')
                _, names = vectors(row)
                if parts is not None and names != parts:
                    raise ValueError('片段内部位定义变化')
                parts = names
                colors = row.get('colors')
                if not isinstance(colors, dict) or not colors:
                    raise ValueError('缺少图像引用')
                if any(not isinstance(k,str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,100}',k) for k in colors):
                    raise ValueError('相机名称不是已支持的标识符')
                if cameras is None:
                    cameras = set(colors)
                if set(colors) != cameras:
                    raise ValueError('相机通道不一致')
                for value in colors.values():
                    within(path.parent, value, exists=True)
                timestamp = row.get('timestamp')
                if timestamp is not None and not finite(timestamp):
                    raise ValueError('timestamp 不是有限数值')
                timestamps.append(timestamp)
            except (ValueError, TypeError, KeyError, OSError, IndexError) as exc:
                if len(errors) < 20:
                    errors.append(f'第{index}帧：{exc}')
        has_times = len(timestamps) == end - start and all(finite(t) for t in timestamps)
        if has_times and any(b <= a for a, b in zip(timestamps, timestamps[1:])):
            errors.append('片段时间戳未严格递增')
            has_times = False
        return errors, sorted(cameras or []), timestamps[-1] - timestamps[0] if has_times else None

    def draft(self, payload):
        name = short_text(payload.get('name', ''), '训练集名称', 120)
        if not name:
            raise ValueError('请填写训练集名称')
        split, sampling = self._configuration(payload)
        resolved, summary, problems, warnings, splits = self._resolve(payload.get('items', []), split, sampling)
        with self.lock:
            old = None
            if payload.get('id'):
                old = self.store.get('dataset', payload['id'])
                if old['status'] != 'draft':
                    raise PreparationConflict('已确认的数据版本不可修改，请另存新草稿')
                if payload.get('revision') != old['revision']:
                    raise PreparationConflict('草稿已被更新，请刷新后再保存')
            parent_id = payload.get('parent_id') or (old or {}).get('parent_id')
            if parent_id:
                self.store.get('dataset', parent_id)
            value = {'id': old['id'] if old else identity(), 'name': name, 'status': 'draft',
                     'revision': old['revision'] + 1 if old else 1, 'parent_id': parent_id,
                     'items': [{key: x[key] for key in ('episode_id', 'start_frame', 'end_frame', 'task')} for x in resolved],
                     'split': split, 'sampling': sampling, 'summary': summary, 'problems': problems,
                     'warnings': warnings, 'splits': splits, 'resolved_items': resolved,
                     'created_at': old['created_at'] if old else now(), 'updated_at': now()}
            return self.store.put('dataset', value)

    def dataset(self, ident):
        return self.store.get('dataset', ident)

    def summaries(self):
        excluded = {'items', 'resolved_items', 'manifest'}
        return [{k: v for k, v in x.items() if k not in excluded} for x in self.store.all('dataset')]

    def confirm(self, ident, payload):
        with self.lock:
            old = self.dataset(ident)
            if payload.get('revision') != old['revision']:
                raise PreparationConflict('确认的草稿版本已过期，请刷新')
            if old['status'] != 'draft':
                raise PreparationConflict('此版本已经确认')
            resolved, summary, problems, warnings, splits = self._resolve(old['items'], old['split'], old['sampling'])
            if problems:
                raise ValueError('无法确认：' + '；'.join(problems))
            if fingerprint(resolved) != fingerprint(old['resolved_items']):
                raise PreparationConflict('来源或标记在预览后发生变化，请重新保存草稿再确认')
            manifest = {'format': 'robot_pipeline.selection.v1', 'dataset_id': ident,
                        'name': old['name'], 'items': resolved, 'split': old['split'], 'sampling': old['sampling']}
            value = dict(old, status='confirmed', confirmed_at=now(), updated_at=now(), manifest=manifest,
                         manifest_sha256=fingerprint(manifest), summary=summary, warnings=warnings, splits=splits)
            return self.store.put('dataset', value)


def build_prepared(workspace, dataset, output):
    """Build a media-complete package from a confirmed, hashed selection manifest."""
    workspace, output = Path(workspace), Path(output)
    if dataset.get('status') != 'confirmed' or fingerprint(dataset.get('manifest')) != dataset.get('manifest_sha256'):
        raise ValueError('构建需要未改动的已确认数据版本')
    import sqlite3
    with sqlite3.connect(workspace / 'catalog.sqlite3') as connection:
        row = connection.execute("SELECT value FROM records WHERE kind='dataset' AND id=?", (dataset['id'],)).fetchone()
    current_dataset = json.loads(row[0]) if row else None
    if not current_dataset or current_dataset.get('status') != 'confirmed' or current_dataset.get('manifest_sha256') != dataset['manifest_sha256'] or fingerprint(current_dataset.get('manifest')) != dataset['manifest_sha256']:
        raise ValueError('已确认数据版本的持久化清单不一致')
    manifest = dataset['manifest']
    output.mkdir(parents=True, exist_ok=False)
    image_directory = output / 'images'; image_directory.mkdir()
    counts = {name: 0 for name in SPLITS}
    sources, records_count, copied = {}, 0, {}
    omitted_parts = set()
    metadata_checks = {}
    with (output / 'records.jsonl').open('x', encoding='utf-8', newline='\n') as handle:
        for local_episode, item in enumerate(manifest['items']):
            source = item['source']; aid = source['id']
            if aid not in sources:
                # A worker checks the current catalog rather than trusting an input descriptor alone.
                import sqlite3
                with sqlite3.connect(workspace / 'catalog.sqlite3') as connection:
                    row = connection.execute("SELECT value FROM records WHERE kind='asset' AND id=?", (aid,)).fetchone()
                if row is None:
                    raise ValueError('来源资产不存在')
                current = json.loads(row[0])
                if fingerprint(metadata(current)) != item['metadata_sha256']:
                    raise ValueError('确认后来源元数据发生变化，请另存并重新确认')
                asset_root = within(workspace, source['path'])
                mpath = within(workspace, source['manifest_path'], exists=True)
                if file_hash(mpath) != source['manifest_sha256']:
                    raise ValueError('确认后资产清单发生变化')
                sources[aid] = (asset_root, {x['path']: x['sha256'] for x in read_json(mpath)['files']})
                metadata_checks[aid] = item['metadata_sha256']
            asset_root, expected_files = sources[aid]
            path = within(asset_root, item['relative_path'], exists=True)
            if file_hash(path) != item['raw_sha256'] or expected_files.get(item['relative_path']) != item['raw_sha256']:
                raise ValueError('确认后原始回合发生变化，请重新准备数据')
            obj = read_json(path)
            start, end = item['start_frame'], item['end_frame']
            if not 0 <= start < end <= len(obj['data']):
                raise ValueError('片段范围已失效')
            for source_index in range(start, end):
                row = obj['data'][source_index]
                if type(row.get('idx')) is not int or row['idx'] != source_index:
                    raise ValueError('原始帧索引无效')
                (state, action), _ = vectors(row)
                for block in ('states','actions'):
                    omitted_parts.update(k for k,v in row[block].items()
                                         if k not in {'left_arm','right_arm','left_ee','right_ee','left_hand','right_hand'} and v is not None)
                images = {}
                for camera, relative in sorted(row.get('colors', {}).items()):
                    image = within(path.parent, relative, exists=True)
                    relative_asset = image.relative_to(asset_root).as_posix()
                    digest = file_hash(image)
                    if expected_files.get(relative_asset) != digest:
                        raise ValueError('确认后图像发生变化：' + relative_asset)
                    if digest not in copied:
                        data = image.read_bytes(); _, extension = image_type(data)
                        destination = f'images/{digest}{extension}'
                        within(output, destination).write_bytes(data)
                        copied[digest] = destination
                    images[camera] = copied[digest]
                if sorted(images) != item['camera_keys']:
                    raise ValueError('构建时相机通道不匹配')
                record = {'episode_index': local_episode, 'frame_index': source_index - start,
                          'timestamp': row.get('timestamp'), 'observation.state': state, 'action': action,
                          'images': images, 'task': item['task'], 'split': item['split'],
                          'source_asset_id': aid, 'source_episode_id': item['episode_id'],
                          'source_frame_index': source_index, 'source_kind': item['source_kind'],
                          'group_fingerprint': item['group_fingerprint'], 'synthetic': item['synthetic'],
                          'task_result': item['annotation']['result']}
                handle.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + '\n')
                records_count += 1; counts[item['split']] += 1
    write_json(output / 'manifest.json', manifest)
    write_json(output / 'splits.json', {'recipe': manifest['split'], 'frames': counts,
                                       'groups': {name: sorted({x['group_fingerprint'] for x in manifest['items'] if x['split'] == name}) for name in SPLITS}})
    write_json(output / 'sampling.json', manifest['sampling'])
    contract = {'format': 'robot_pipeline.prepared.v1', 'reader': 'robot_pipeline.workbench.preparation.read_prepared_records',
                'is_lerobot_dataset': False, 'official_reader_verified': False, 'training_ready': False,
                'dataset_id': dataset['id'], 'manifest_sha256': dataset['manifest_sha256'],
                'state_dim': 28, 'action_dim': 28, 'frames': records_count, 'image_path_base': '.',
                'contains_synthetic': any(x['synthetic'] for x in manifest['items']),
                'records_sha256': file_hash(output / 'records.jsonl'),
                'images_embedded': True, 'source_metadata_sha256': metadata_checks,
                'scope': SCOPE, 'action_semantics_verified': False,
                'control_scope': 'arm_hand_28d_only; no leg/navigation commands inferred',
                'omitted_raw_parts': sorted(omitted_parts),
                'next_steps': ['核对目标训练配方、本体和动作语义', '在固定官方环境完成转换和真实策略读取验收']}
    write_json(output / 'contract.json', contract)
    checked, image_bytes, first = 0, 0, None
    for sample in read_prepared_records(output):
        checked += 1; image_bytes += sum(len(x) for x in sample['images'].values())
        if first is None:
            first = {'state_dim': len(sample['state']), 'action_dim': len(sample['action']),
                     'cameras': sorted(sample['images']), 'timestamp': sample['record']['timestamp']}
    draws = sample_prepared(output, 1000, seed=manifest['split']['seed'])
    distribution = {}
    for record in draws:
        kind = record['source_kind']; distribution[kind] = distribution.get(kind, 0) + 1
    check = {'reader': 'project_contract', 'valid': checked == records_count and checked > 0,
             'records_checked': checked, 'frames_checked': checked, 'image_bytes_read': image_bytes, 'first_sample': first,
             'sampled_source_counts': distribution, 'sampling_draws': len(draws), 'is_lerobot_dataset': False,
             'sampling': {'mode': manifest['sampling']['mode'], 'draws': len(draws),
                          'seed': manifest['split']['seed'], 'source_counts': distribution,
                          'applies_to': 'train only', 'actual_sampling_executed': True},
             'image_check': '存在性、SHA256、文件头与实际字节读取；未完整像素解码',
             'official_reader_verified': False, 'training_ready': False}
    write_json(output / 'reader_check.json', check)
    (output / 'reader.py').write_bytes(Path(__file__).with_name('prepared_reader.py').read_bytes())
    (output / 'README.txt').write_text('项目便携数据包：保留图像、原始时间和来源。不是 LeRobot 数据，未执行策略训练。\n'
                                      'records.jsonl 的 episode_index 对应选中片段，source_frame_index 指向母回合。\n'
                                      'sampling.json 由项目 sample_prepared 读取器实际应用，仅影响训练抽样。\n'
                                      '独立读取：解压后执行 python reader.py . --draws 32；只需Python标准库。\n', encoding='utf-8')
    archive = output / 'dataset.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as z:
        for file in sorted(output.rglob('*')):
            if file.is_file() and file != archive:
                z.write(file, file.relative_to(output).as_posix())
    return {'dataset_id': dataset['id'], 'manifest_sha256': dataset['manifest_sha256'],
            'frames': records_count, 'splits': counts, 'reader_check': check, 'contract': contract,
            'training_ready': False, 'artifacts': ['prepared/dataset.zip', 'prepared/records.jsonl',
            'prepared/manifest.json', 'prepared/contract.json', 'prepared/splits.json',
            'prepared/sampling.json', 'prepared/reader_check.json', 'prepared/README.txt', 'prepared/reader.py']}
