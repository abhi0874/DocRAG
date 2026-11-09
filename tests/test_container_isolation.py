"""Isolation guards must detect changes without starting unrelated stopped services."""

from copy import deepcopy

import pytest

from scripts.container_http import isolation_snapshot


def fixture():
    return {
        "Id": "unrelated",
        "State": {
            "Status": "exited",
            "Running": False,
            "Paused": False,
            "Restarting": False,
            "ExitCode": 0,
            "StartedAt": "before",
            "FinishedAt": "stopped",
            "Health": {"Status": "unhealthy"},
        },
        "RestartCount": 0,
        "Mounts": [{"Name": "preserved"}],
        "HostConfig": {
            "PortBindings": {"5432/tcp": [{"HostPort": "55432"}]},
            "RestartPolicy": {"Name": "no"},
        },
    }


def test_stopped_service_is_preserved_without_requiring_health():
    data = fixture()
    assert isolation_snapshot(data) == isolation_snapshot(deepcopy(data))
    assert isolation_snapshot(data)["state"]["Running"] is False


@pytest.mark.parametrize(
    "key,value", [("StartedAt", "new"), ("FinishedAt", "new"), ("ExitCode", 1)]
)
def test_stopped_lifecycle_changes_are_detected(key, value):
    before = fixture()
    after = deepcopy(before)
    after["State"][key] = value
    assert isolation_snapshot(before) != isolation_snapshot(after)


def test_unintended_start_is_detected():
    before = fixture()
    after = deepcopy(before)
    after["State"].update(Status="running", Running=True, Health={"Status": "healthy"})
    assert isolation_snapshot(before) != isolation_snapshot(after)


def test_running_service_must_be_healthy():
    data = fixture()
    data["State"].update(Status="running", Running=True)
    with pytest.raises(AssertionError):
        isolation_snapshot(data)


def test_configuration_changes_are_detected():
    before = fixture()
    after = deepcopy(before)
    after["HostConfig"]["RestartPolicy"] = {"Name": "always"}
    assert isolation_snapshot(before) != isolation_snapshot(after)
