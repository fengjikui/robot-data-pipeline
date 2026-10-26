"""Inspect the pinned converter CLI signature without executing conversion or importing hardware."""
import ast,dataclasses
from pathlib import Path
from typing import Literal
import tyro
root=Path(__file__).resolve().parents[1]
tree=ast.parse((root/'evidence/upstream/unitree_lerobot__unitree_lerobot__utils__convert_unitree_json_to_lerobot.py').read_text())
keep=[]
for n in tree.body:
    if isinstance(n,ast.ClassDef) and n.name=='DatasetConfig': keep.append(n)
    if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='DEFAULT_DATASET_CONFIG' for x in n.targets):keep.append(n)
    if isinstance(n,ast.FunctionDef) and n.name=='json_to_lerobot':n.body=[ast.Pass()];keep.append(n)
namespace={'Path':Path,'dataclasses':dataclasses,'Literal':Literal}
exec(compile(ast.fix_missing_locations(ast.Module(body=keep,type_ignores=[])),'<signature-only>','exec'),namespace)
tyro.cli(namespace['json_to_lerobot'])
