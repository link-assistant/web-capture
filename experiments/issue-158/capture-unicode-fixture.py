"""Generate a replay fixture with Unicode headers in UTF-8 canonical order."""

import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
fixtures = root / "rust/tests/fixtures"
record = json.loads((fixtures / "capture-v1.json").read_text(encoding="utf-8"))
record["request"]["headers"] = {"\U0001f600": "astral", "\ue000": "bmp"}
request = record["request"]
canonical = json.dumps(
    [1, request["url"], request["method"], sorted(request["headers"].items())],
    ensure_ascii=False,
    separators=(",", ":"),
).encode()
record["requestKey"] = hashlib.sha256(canonical).hexdigest()
(fixtures / "capture-v1-unicode.json").write_text(
    json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(record["requestKey"])
