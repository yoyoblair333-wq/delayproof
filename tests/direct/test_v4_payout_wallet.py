"""
Contract v4: payouts that actually arrive.

On studionet a contract-to-EOA value transfer is debited but never credited, while
contract-to-contract transfers are. v4 lets a claimant register a payout wallet
contract (contracts/claim_wallet.py) that withdraw_payout pays instead of the
claimant's key. These direct-mode tests capture the emitted transfer message
(gltest's cross-contract hook sees every PostMessage) and check where it goes.
"""

import pytest

from conftest import CONTRACT, NOW, PROMPT_RE, analyst, mock_sources, set_tx_time

WALLET = "contracts/claim_wallet.py"
W1 = "0x" + "a1" * 20
W2 = "0x" + "b2" * 20
OUTSIDER = "0x" + "11" * 20


def hexof(a) -> str:
    if hasattr(a, "as_hex"):
        return a.as_hex
    if isinstance(a, (bytes, bytearray)):
        return "0x" + bytes(a).hex()
    return str(a)


@pytest.fixture
def sent(direct_vm):
    """Every message the contract emits: [{'to': '0x…', 'value': int, 'on': str}]."""
    out = []

    def hook(_vm, req):
        if "PostMessage" in req:
            m = req["PostMessage"]
            out.append({"to": hexof(m["address"]).lower(), "value": int(m["value"]), "on": m.get("on")})
        return None

    direct_vm._gl_call_hook = hook
    return out


@pytest.fixture
def dp(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT)
    set_tx_time(direct_vm, NOW)
    return c


def make_pool(vm, dp, payer, value=10_000, rate=10):
    vm.sender = payer
    vm.value = value
    pid = dp.create_pool("Card perk pool", "ANY", rate)
    vm.value = 0
    return pid


def claim_final(vm, dp, claimant, payer, pid, flight="BA117", date="2026-10-30"):
    vm.sender = claimant
    mock_sources(vm, flight)
    vm.mock_llm(PROMPT_RE, analyst())
    cid = dp.open_claim(flight, date, "", "", pid)
    dp.assess(cid)
    vm.sender = payer
    dp.approve_claim(cid)
    vm.sender = claimant
    set_tx_time(vm, "2026-11-01T13:01:00Z")
    dp.finalize(cid)
    return cid


class TestRegister:
    def test_default_is_none(self, dp, direct_alice):
        assert dp.get_payout_wallet(hexof(direct_alice)) == ""

    def test_register_and_read_back(self, direct_vm, dp, direct_alice):
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        assert dp.get_payout_wallet(hexof(direct_alice)).lower() == W1

    def test_change_and_clear(self, direct_vm, dp, direct_alice):
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        dp.set_payout_wallet(W2)
        assert dp.get_payout_wallet(hexof(direct_alice)).lower() == W2
        dp.set_payout_wallet("")
        assert dp.get_payout_wallet(hexof(direct_alice)) == ""
        dp.set_payout_wallet("")          # clearing twice is a no-op, not an error
        assert dp.get_payout_wallet(hexof(direct_alice)) == ""

    def test_wallets_are_per_caller(self, direct_vm, dp, direct_alice, direct_bob):
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        direct_vm.sender = direct_bob
        dp.set_payout_wallet(W2)          # bob setting his own wallet does not touch alice's
        assert dp.get_payout_wallet(hexof(direct_alice)).lower() == W1
        assert dp.get_payout_wallet(hexof(direct_bob)).lower() == W2

    @pytest.mark.parametrize("bad,msg", [
        ("not-an-address", "0x address"),
        ("0x1234", "0x address"),
        ("0x" + "00" * 20, "zero address"),
    ])
    def test_bad_wallet_refused(self, direct_vm, dp, direct_alice, bad, msg):
        direct_vm.sender = direct_alice
        with direct_vm.expect_revert(msg):
            dp.set_payout_wallet(bad)

    def test_own_address_refused(self, direct_vm, dp, direct_alice):
        direct_vm.sender = direct_alice
        with direct_vm.expect_revert("your own address"):
            dp.set_payout_wallet(hexof(direct_alice))

    def test_this_contract_refused(self, direct_vm, dp, direct_alice):
        direct_vm.sender = direct_alice
        with direct_vm.expect_revert("cannot be this contract"):
            dp.set_payout_wallet(hexof(direct_vm._contract_address))

    def test_paused_blocks_register(self, direct_vm, dp, direct_alice, direct_bob):
        direct_vm.sender = direct_alice          # alice deployed, so she is the owner
        dp.set_paused(True)
        direct_vm.sender = direct_bob
        with direct_vm.expect_revert("paused"):
            dp.set_payout_wallet(W1)

    def test_config_reports_v4(self, dp):
        cfg = dp.get_config()
        assert cfg["contract_version"] == "v4" and cfg["payout_wallets"] is True


class TestPayoutDestination:
    def test_payout_lands_in_registered_wallet(self, direct_vm, dp, sent, direct_alice, direct_bob):
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_alice, direct_bob, pid)
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        assert dp.get_claim(cid)["payout_to"].lower() == W1
        sent.clear()
        res = dp.withdraw_payout(cid)
        assert res["amount"] == 5200 and res["to"].lower() == W1
        assert sent == [{"to": W1, "value": 5200, "on": "finalized"}]
        c = dp.get_claim(cid)
        assert c["paid"] is True and c["paid_to"].lower() == W1 and c["payout_to"].lower() == W1
        p = dp.get_pool(pid)
        assert p["balance"] == 10_000 - 5200 and p["paid_out"] == 5200 and p["reserved"] == 0

    def test_no_wallet_pays_claimant_as_v3(self, direct_vm, dp, sent, direct_alice, direct_bob):
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_alice, direct_bob, pid)
        direct_vm.sender = direct_alice
        sent.clear()
        res = dp.withdraw_payout(cid)
        assert res["to"].lower() == hexof(direct_alice).lower()
        assert sent == [{"to": hexof(direct_alice).lower(), "value": 5200, "on": "finalized"}]
        assert dp.get_claim(cid)["paid_to"].lower() == hexof(direct_alice).lower()

    def test_wallet_registered_before_opening_applies(self, direct_vm, dp, sent, direct_alice, direct_bob):
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_alice, direct_bob, pid)
        direct_vm.sender = direct_alice
        sent.clear()
        assert dp.withdraw_payout(cid)["to"].lower() == W1
        assert [m["to"] for m in sent] == [W1]

    def test_cleared_wallet_falls_back_to_claimant(self, direct_vm, dp, sent, direct_alice, direct_bob):
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_alice, direct_bob, pid)
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        dp.set_payout_wallet("")
        assert dp.withdraw_payout(cid)["to"].lower() == hexof(direct_alice).lower()

    def test_paid_to_is_frozen_after_payout(self, direct_vm, dp, direct_alice, direct_bob):
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_alice, direct_bob, pid)
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        dp.withdraw_payout(cid)
        dp.set_payout_wallet(W2)              # a later change only affects unpaid claims
        c = dp.get_claim(cid)
        assert c["paid_to"].lower() == W1 and c["payout_to"].lower() == W1
        with direct_vm.expect_revert("already paid"):
            dp.withdraw_payout(cid)

    def test_payer_cannot_redirect_payout(self, direct_vm, dp, sent, direct_alice, direct_bob):
        """The payer (or anyone else) registering a wallet only sets their OWN entry."""
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_alice, direct_bob, pid)
        direct_vm.sender = direct_bob
        dp.set_payout_wallet(OUTSIDER)
        assert dp.get_claim(cid)["payout_to"].lower() == hexof(direct_alice).lower()
        with direct_vm.expect_revert("only the claimant can withdraw"):
            dp.withdraw_payout(cid)
        direct_vm.sender = direct_alice
        sent.clear()
        dp.withdraw_payout(cid)
        assert [m["to"] for m in sent] == [hexof(direct_alice).lower()]

    def test_owner_cannot_redirect_payout(self, direct_vm, dp, direct_alice, direct_bob, direct_charlie):
        # alice deployed (owner); charlie claims, bob pays. The owner's own entry never applies to charlie.
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(OUTSIDER)
        pid = make_pool(direct_vm, dp, direct_bob)
        cid = claim_final(direct_vm, dp, direct_charlie, direct_bob, pid)
        direct_vm.sender = direct_charlie
        assert dp.withdraw_payout(cid)["to"].lower() == hexof(direct_charlie).lower()

    def test_two_claims_same_wallet(self, direct_vm, dp, sent, direct_alice, direct_bob):
        pid = make_pool(direct_vm, dp, direct_bob, value=20_000)
        c1 = claim_final(direct_vm, dp, direct_alice, direct_bob, pid, date="2026-10-30")
        set_tx_time(direct_vm, NOW)
        c2 = claim_final(direct_vm, dp, direct_alice, direct_bob, pid, date="2026-10-29")
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        sent.clear()
        dp.withdraw_payout(c1)
        dp.withdraw_payout(c2)
        assert [m["to"] for m in sent] == [W1, W1] and sum(m["value"] for m in sent) == 10_400

    def test_withdraw_pool_unchanged(self, direct_vm, dp, sent, direct_bob):
        """The payer's reclaim path is not affected by payout wallets."""
        pid = make_pool(direct_vm, dp, direct_bob)
        direct_vm.sender = direct_bob
        dp.set_payout_wallet(W1)
        set_tx_time(direct_vm, "2026-12-15T00:00:00Z")
        sent.clear()
        assert dp.withdraw_pool(pid)["amount"] == 10_000
        assert [m["to"] for m in sent] == [hexof(direct_bob).lower()]

    def test_list_recent_carries_payout_fields(self, direct_vm, dp, direct_alice):
        direct_vm.sender = direct_alice
        dp.set_payout_wallet(W1)
        dp.open_claim("BA117", "2026-10-30")
        row = dp.list_recent(5)[0]
        assert row["paid_to"] == "" and row["payout_to"].lower() == W1


# ---------------------------------------------------------------- ClaimWallet

@pytest.fixture
def wallet(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    w = direct_deploy(WALLET)
    direct_vm.deal(direct_vm._contract_address, 1_000)
    return w


class TestClaimWallet:
    def test_owner_is_deployer(self, wallet, direct_alice):
        info = wallet.get_info()
        assert info["kind"] == "ClaimWallet" and info["owner"].lower() == hexof(direct_alice).lower()
        assert info["balance"] == "1000" and info["sent_total"] == "0" and info["sends"] == 0

    def test_owner_send_and_withdraw(self, direct_vm, wallet, sent, direct_alice):
        direct_vm.sender = direct_alice
        wallet.send(W2, 300)
        wallet.withdraw(200)
        assert sent == [{"to": W2, "value": 300, "on": "finalized"},
                        {"to": hexof(direct_alice).lower(), "value": 200, "on": "finalized"}]
        info = wallet.get_info()
        assert info["sent_total"] == "500" and info["sends"] == 2

    def test_only_owner_moves_funds(self, direct_vm, wallet, sent, direct_bob):
        direct_vm.sender = direct_bob
        with direct_vm.expect_revert("only the wallet owner"):
            wallet.send(W2, 1)
        with direct_vm.expect_revert("only the wallet owner"):
            wallet.withdraw(1)
        with direct_vm.expect_revert("only the wallet owner"):
            wallet.transfer_ownership(OUTSIDER)
        assert sent == []

    def test_anyone_can_deposit(self, direct_vm, wallet, direct_bob):
        direct_vm.sender = direct_bob
        direct_vm.value = 5
        wallet.deposit()
        direct_vm.value = 0

    @pytest.mark.parametrize("amount,msg", [(0, "must be positive"), (-1, "must be positive"), (1_001, "exceeds the wallet balance")])
    def test_amount_guards(self, direct_vm, wallet, direct_alice, amount, msg):
        direct_vm.sender = direct_alice
        with direct_vm.expect_revert(msg):
            wallet.send(W2, amount)
        with direct_vm.expect_revert(msg):
            wallet.withdraw(amount)

    @pytest.mark.parametrize("bad", ["", "0x12", "0x" + "00" * 20, "wallet"])
    def test_bad_destination(self, direct_vm, wallet, direct_alice, bad):
        direct_vm.sender = direct_alice
        with direct_vm.expect_revert("non-zero 0x address"):
            wallet.send(bad, 1)

    def test_cannot_send_to_itself(self, direct_vm, wallet, direct_alice):
        direct_vm.sender = direct_alice
        with direct_vm.expect_revert("this wallet itself"):
            wallet.send(hexof(direct_vm._contract_address), 1)

    def test_transfer_ownership(self, direct_vm, wallet, direct_alice, direct_bob):
        direct_vm.sender = direct_alice
        wallet.transfer_ownership(hexof(direct_bob))
        with direct_vm.expect_revert("only the wallet owner"):
            wallet.withdraw(1)
        direct_vm.sender = direct_bob
        wallet.withdraw(1)
        assert wallet.get_info()["owner"].lower() == hexof(direct_bob).lower()
