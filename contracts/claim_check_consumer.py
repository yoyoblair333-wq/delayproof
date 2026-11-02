# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ClaimCheckConsumer - minimal example of another contract gating on ClaimCheck
=============================================================================

A tiny "evidence desk": someone opens a case (a claim, its sources, k), the
desk asks ClaimCheck to verify it, and the case settles only on a quorum
verdict that ClaimCheck stored for EXACTLY those inputs.

Two cross-contract paths, both real GenVM v0.2 calls:

  request_check(case_id)   gl.get_contract_at(oracle).emit(on="accepted").check(...)
                           An emitted message is asynchronous: it becomes its own
                           ClaimCheck transaction after this one is accepted, so
                           this contract cannot read the result in the same call.
  settle(case_id)          gl.get_contract_at(oracle).view().find(claim, sources, k)
                           A synchronous read of ClaimCheck's state. Binding by
                           find() (not by a caller-supplied check id) means nobody
                           can settle a case with a check of a different claim,
                           different sources or a lower k.

Only SUPPORTED and CONTRADICTED settle a case. DISPUTED, NOT_FOUND and
INSUFFICIENT are recorded as the latest reading and the case stays open, so a
later check (or a ClaimCheck recheck) can still settle it.
"""

from genlayer import *

import json
from dataclasses import dataclass

ERR_EXPECTED = "[EXPECTED]"
SETTLING = {"SUPPORTED": "claim_upheld", "CONTRADICTED": "claim_rejected"}


@allow_storage
@dataclass
class Case:
    id: u256
    claim: str
    sources_json: str      # JSON list[str], exactly as passed to ClaimCheck
    k: u32
    opened_by: Address
    status: str            # "open" | "requested" | "settled"
    check_id: u256         # ClaimCheck id the latest reading came from (0 = none)
    last_verdict: str
    outcome: str           # "" until settled: "claim_upheld" | "claim_rejected"
    fingerprint: str       # ClaimCheck record fingerprint at settlement


def _fail(msg: str):
    raise gl.vm.UserError(f"{ERR_EXPECTED} {msg}")


class ClaimCheckConsumer(gl.Contract):
    oracle: Address
    next_id: u256
    cases: TreeMap[u256, Case]

    def __init__(self, oracle: str):
        self.oracle = Address(oracle)
        self.next_id = u256(1)

    def _get(self, case_id: int) -> Case:
        if isinstance(case_id, bool) or int(case_id) < 1 or u256(int(case_id)) not in self.cases:
            _fail("case not found")
        return self.cases[u256(int(case_id))]

    def _to_dict(self, c: Case) -> dict:
        return {"id": int(c.id), "claim": c.claim, "sources": json.loads(c.sources_json), "k": int(c.k),
                "opened_by": c.opened_by.as_hex, "status": c.status, "check_id": int(c.check_id),
                "last_verdict": c.last_verdict, "outcome": c.outcome, "fingerprint": c.fingerprint}

    @gl.public.write
    def open_case(self, claim: str, sources: list[str], k: int) -> int:
        """Store a case. Input validation is ClaimCheck's job; this only
        bounds sizes so the example stays cheap."""
        if not isinstance(claim, str) or len(claim) == 0 or len(claim) > 280:
            _fail("claim must be 1..280 characters")
        if not isinstance(sources, list) or len(sources) == 0 or len(sources) > 5:
            _fail("sources must be 1..5 urls")
        if isinstance(k, bool) or not isinstance(k, int) or k < 1 or k > len(sources):
            _fail("k must be 1..len(sources)")
        cid = int(self.next_id)
        self.cases[u256(cid)] = Case(id=u256(cid), claim=claim, sources_json=json.dumps([str(s) for s in sources]),
                                     k=u32(k), opened_by=gl.message.sender_address, status="open",
                                     check_id=u256(0), last_verdict="", outcome="", fingerprint="")
        self.next_id = u256(cid + 1)
        return cid

    @gl.public.write
    def request_check(self, case_id: int) -> None:
        """Ask ClaimCheck to run the check (asynchronous emitted message)."""
        c = self._get(case_id)
        if c.status == "settled":
            _fail("case already settled")
        gl.get_contract_at(self.oracle).emit(on="accepted").check(c.claim, json.loads(c.sources_json), int(c.k), "")
        c.status = "requested"

    @gl.public.write
    def settle(self, case_id: int) -> dict:
        """Read ClaimCheck's newest check for exactly this case's inputs."""
        c = self._get(case_id)
        if c.status == "settled":
            _fail("case already settled")
        v = gl.get_contract_at(self.oracle).view().find(c.claim, json.loads(c.sources_json), int(c.k), "")
        if not isinstance(v, dict) or int(v.get("id", 0)) == 0:
            _fail("no ClaimCheck result for this case yet")
        verdict = str(v["verdict"])
        c.check_id = u256(int(v["id"]))
        c.last_verdict = verdict
        if verdict in SETTLING:
            c.status = "settled"
            c.outcome = SETTLING[verdict]
            c.fingerprint = str(v.get("fingerprint", ""))
        return self._to_dict(c)

    @gl.public.view
    def get_case(self, case_id: int) -> dict:
        return self._to_dict(self._get(case_id))

    @gl.public.view
    def get_config(self) -> dict:
        return {"oracle": self.oracle.as_hex, "cases": int(self.next_id) - 1}
