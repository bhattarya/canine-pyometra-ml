"""Build site/index.html by injecting models/final_model.json into the template.

The page carries no hand-typed results: every number is read from the model
JSON at load time. Run after 11_finalize_model.py.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C

SITE = C.ROOT / "site"
tpl = (SITE / "template.html").read_text(encoding="utf-8")
model_json = (C.ROOT / "models" / "final_model.json").read_text(encoding="utf-8").strip()

if "__MODEL_JSON__" not in tpl:
    raise SystemExit("template.html is missing the __MODEL_JSON__ slot")

# escape only what breaks an inline <script> block
safe = model_json.replace("</", "<\\/")
html = tpl.replace("__MODEL_JSON__", safe)

out = SITE / "index.html"
out.write_text(html, encoding="utf-8")
kb = len(html.encode()) / 1024
print(f"wrote {out}  ({kb:.1f} KB, model JSON {len(model_json)} chars)")

# sanity: the placeholder is gone and the JSON parses
assert "__MODEL_JSON__" not in html
json.loads(model_json)
print("ok — page is self-contained and model JSON is valid")
