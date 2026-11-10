# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ClaimWallet - a minimal payout wallet contract for a DelayProof claimant.

Why this exists: on GenLayer studionet a value transfer emitted by a contract to a
plain wallet address (EOA) is routed to Studio's contract_not_found_handler and never
credited, while contract-to-contract transfers are credited. A passenger deploys one
ClaimWallet (the deployer becomes its owner), registers it on DelayProof with
`set_payout_wallet(<wallet address>)`, and DelayProof sends the pool payout here.
The balance is then visible on-chain (`get_info`, `eth_getBalance`).

Only the owner can move funds out:
  * `send(to, amount)` forwards GEN to any address (on studionet only a contract
    destination is credited today, e.g. another ClaimWallet),
  * `withdraw(amount)` sends GEN to the owner key (credited on networks that credit
    contract-to-EOA transfers; studionet currently does not, see above),
  * `transfer_ownership(new_owner)` hands the wallet to another key.

Adapted from PriceCourt's AgentWallet (the same studionet workaround, proven live there),
reduced to what a payout wallet needs: no arbitrary contract calls.
Testnet only: no real money.
"""

import re

from genlayer import *


ZERO = "0x" + "00" * 20


def _addr(raw: str, label: str) -> Address:
    s = str(raw).strip()
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", s) or s.lower() == ZERO:
        raise gl.vm.UserError(f"[EXPECTED] {label} must be a non-zero 0x address")
    return Address(s)


class ClaimWallet(gl.Contract):
    owner: Address
    sent_total: u256
    sends: u32

    def __init__(self):
        self.owner = gl.message.sender_address
        self.sent_total = u256(0)
        self.sends = u32(0)

    def _only_owner(self) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the wallet owner")

    def _balance(self) -> int:
        return int(gl.get_contract_at(gl.message.contract_address).balance)

    def _out(self, to: Address, amount: int) -> None:
        if int(amount) <= 0:
            raise gl.vm.UserError("[EXPECTED] amount must be positive")
        if int(amount) > self._balance():
            raise gl.vm.UserError("[EXPECTED] amount exceeds the wallet balance")
        self.sent_total = u256(int(self.sent_total) + int(amount))
        self.sends = u32(int(self.sends) + 1)
        gl.get_contract_at(to).emit_transfer(value=u256(int(amount)), on="finalized")

    @gl.public.write.payable
    def deposit(self) -> None:
        """Anyone may top the wallet up; the attached value stays in the wallet."""
        pass

    @gl.public.write
    def send(self, to: str, amount: int) -> None:
        """Owner only: forward `amount` base units to `to`."""
        self._only_owner()
        dest = _addr(to, "to")
        if dest == gl.message.contract_address:
            raise gl.vm.UserError("[EXPECTED] cannot send to this wallet itself")
        self._out(dest, int(amount))

    @gl.public.write
    def withdraw(self, amount: int) -> None:
        """Owner only: send `amount` base units to the owner key."""
        self._only_owner()
        self._out(self.owner, int(amount))

    @gl.public.write
    def transfer_ownership(self, new_owner: str) -> None:
        self._only_owner()
        self.owner = _addr(new_owner, "new_owner")

    @gl.public.view
    def get_info(self) -> dict:
        return {"kind": "ClaimWallet", "owner": self.owner.as_hex, "balance": str(self._balance()),
                "sent_total": str(int(self.sent_total)), "sends": int(self.sends)}
