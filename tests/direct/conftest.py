"""Shared helpers for the direct-mode tier (real GenVM SDK, web + LLM mocked)."""

import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = str(ROOT / "contracts" / "delay_proof.py")

# Same pin as VERDICT: without it gltest fetches the *latest* GenVM release on a
# fresh machine, not the v0.2 SDK this contract targets.
GENVM_VERSION = os.environ.get("GENVM_VERSION") or "v0.2.16"

NOW = "2026-11-01T12:00:00Z"
PROMPT_RE = r"analyst #\d+ for DelayProof"


@pytest.fixture
def direct_deploy(direct_deploy):
    def _deploy(contract_path, *args, sdk_version=None, **kwargs):
        return direct_deploy(contract_path, *args, sdk_version=sdk_version or GENVM_VERSION, **kwargs)
    return _deploy


def set_tx_time(vm, ts: str) -> None:
    # gltest 0.29 direct mode: warp() does not refresh gl.message_raw['datetime'].
    vm.warp(ts)
    sys.modules["genlayer.gl"].message_raw["datetime"] = ts


def airport(iata, country, lat, lon):
    return {"iata_code": iata, "country_iso_name": country, "latitude": lat, "longitude": lon,
            "name": iata + " Airport", "icao_code": "X" + iata}


ROUTES = {
    # long-haul out of the UK: UK261, ~5,540 km
    "BA117": (airport("LHR", "GB", 51.4706, -0.46194), airport("JFK", "US", 40.6398, -73.7789),
              {"iata": "BA", "icao": "BAW", "name": "British Airways", "country_iso": "GB"}),
    # intra-EU short: FRA -> MAD ~1,420 km
    "LH1120": (airport("FRA", "DE", 50.0333, 8.5706), airport("MAD", "ES", 40.4719, -3.5626),
               {"iata": "LH", "icao": "DLH", "name": "Lufthansa", "country_iso": "DE"}),
    # intra-EU over 1,500 km: CDG -> ATH ~2,100 km
    "AF1832": (airport("CDG", "FR", 49.0128, 2.55), airport("ATH", "GR", 37.9364, 23.9445),
               {"iata": "AF", "icao": "AFR", "name": "Air France", "country_iso": "FR"}),
    # inbound to the EU on a non-EU airline: not covered
    "UA960": (airport("IAD", "US", 38.9445, -77.4558), airport("FRA", "DE", 50.0333, 8.5706),
              {"iata": "UA", "icao": "UAL", "name": "United", "country_iso": "US"}),
    # intra-EU over 3,500 km: HEL -> TFE ~4,9xx km, still the medium amount
    "AY1735": (airport("HEL", "FI", 60.3172, 24.9633), airport("TFE", "ES", 28.0445, -16.5725),
               {"iata": "AY", "icao": "FIN", "name": "Finnair", "country_iso": "FI"}),
    # inbound to the EU on an EU airline: EU261
    "LH419": (airport("IAD", "US", 38.9445, -77.4558), airport("FRA", "DE", 50.0333, 8.5706),
              {"iata": "LH", "icao": "DLH", "name": "Lufthansa", "country_iso": "DE"}),
}


def route_body(flight):
    o, d, a = ROUTES[flight]
    return json.dumps({"response": {"flightroute": {"callsign": flight, "origin": o, "destination": d, "airline": a}}})


def mock_sources(vm, flight, status_text="Flight Arrival Times Scheduled 11:20 Actual 15:30"):
    if flight in ROUTES:
        vm.mock_web(r"api\.adsbdb\.com/v0/callsign/" + flight + r"$", {"method": "GET", "status": 200, "body": route_body(flight)})
    else:
        vm.mock_web(r"api\.adsbdb\.com/v0/callsign/", {"method": "GET", "status": 404, "body": '{"response":"unknown callsign"}'})
    vm.mock_web(r"flightstats\.com", {"method": "GET", "status": 200, "body": status_text})
    vm.mock_web(r"flightaware\.com", {"method": "GET", "status": 200, "body": status_text})


def analyst(status="LANDED", delay=250, cause="CONTROLLABLE", label="technical fault", reason="FlightStats shows a 15:30 actual arrival.",
            origin="", dest=""):
    return json.dumps({"status": status, "arrival_delay_min": delay, "cause_class": cause,
                       "cause_label": label, "reason": reason, "origin_iata": origin, "dest_iata": dest})
