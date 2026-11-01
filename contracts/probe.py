# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
DelayProof feasibility probe (Phase 0). Throwaway contract.

Question it answers: can GenLayer validators on studionet fetch a given public
URL from inside a non-deterministic block, and what do they see?

probe(url, mode): the leader fetches `url` (mode "get" = gl.nondet.web.get,
"text" = gl.nondet.web.render(mode="text")) and returns a short summary
{ok, status, length, head}. Validators re-fetch and accept the leader's result
only if they also succeeded/failed the same way (ok flag equal). The result is
stored so it can be read back with get_probe(id).
"""
from genlayer import *

import json


class Probe(gl.Contract):
    results: TreeMap[str, str]
    count: u256

    def __init__(self):
        self.count = u256(0)

    @gl.public.write
    def probe(self, url: str, mode: str) -> None:
        if not (url.startswith("https://") or url.startswith("http://")):
            raise gl.vm.UserError("[EXPECTED] url must start with http(s)://")
        if mode not in ("get", "text"):
            raise gl.vm.UserError("[EXPECTED] mode must be get or text")

        def leader_fn() -> str:
            try:
                if mode == "get":
                    r = gl.nondet.web.get(url, headers={"User-Agent": "Mozilla/5.0 DelayProof-probe"})
                    raw = r.body or b""
                    txt = raw.decode("utf-8", errors="replace")
                    return json.dumps({"ok": 200 <= r.status < 300, "status": r.status, "length": len(raw), "head": txt[:3500]})
                txt = gl.nondet.web.render(url, mode="text")
                return json.dumps({"ok": len(txt) > 0, "status": 0, "length": len(txt), "head": txt[:3500]})
            except Exception as e:  # network refused, timeout, etc.
                return json.dumps({"ok": False, "status": -1, "length": 0, "head": ("ERR " + str(e))[:300]})

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            ok = False
            try:
                if mode == "get":
                    r = gl.nondet.web.get(url, headers={"User-Agent": "Mozilla/5.0 DelayProof-probe"})
                    ok = 200 <= r.status < 300
                else:
                    ok = len(gl.nondet.web.render(url, mode="text")) > 0
            except Exception:
                ok = False
            theirs = json.loads(leader_res.calldata)
            return ok == bool(theirs["ok"])

        out = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        key = str(int(self.count))
        self.results[key] = url + " | " + mode + " | " + out
        self.count = u256(int(self.count) + 1)

    @gl.public.view
    def get_probe(self, id: str) -> str:
        return self.results.get(id, "")

    @gl.public.view
    def get_count(self) -> int:
        return int(self.count)
