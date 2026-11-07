"""Measurement math must retain failed/limited requests and honest denominators."""

import pytest

from scripts.load_test import percentile, summary


def test_percentiles_interpolate_without_rounding():
    assert percentile([100, 0, 20, 10], 0.5) == 15
    assert percentile([0, 100], 0.95) == 95
    assert percentile([0, 100], 0.99) == 99
    assert percentile([], 0.5) is None


def test_summary_includes_errors_in_latency_and_throughput():
    rows = [
        {"latency_ms": 10, "queue_ms": 0, "status": 200, "ok": True},
        {"latency_ms": 90, "queue_ms": 100, "status": 429, "ok": False},
        {"latency_ms": 200, "queue_ms": 0, "status": 0, "ok": False},
    ]
    result = summary(rows, 10)
    assert result["requests_per_second"] == 0.3
    assert result["successful_requests_per_second"] == 0.1
    assert result["error_rate"] == pytest.approx(2 / 3)
    assert result["rate_limited"] == 1
    assert result["p50_ms"] == 90
    assert result["queue_p95_ms"] == pytest.approx(90)


def test_empty_samples_are_not_a_zero_latency_success():
    result = summary([], 15)
    assert result["error_rate"] is None
    assert result["p95_ms"] is None
    assert result["requests"] == 0
