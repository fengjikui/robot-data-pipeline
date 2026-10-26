"""Use the canonical skill renderer, bounding Poppler rasterization to one worker."""
import importlib.util
from pathlib import Path
source=Path('/Users/fengjikui/.codex/plugins/cache/openai-primary-runtime/documents/26.1020.11348/skills/documents/render_docx.py')
spec=importlib.util.spec_from_file_location('canonical_render_docx',source);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
original=mod.convert_from_path

def bounded(*args,**kwargs):
    kwargs['thread_count']=1
    return original(*args,**kwargs)
mod.convert_from_path=bounded
mod.main()
