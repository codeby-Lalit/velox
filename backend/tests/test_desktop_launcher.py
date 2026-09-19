"""Desktop launcher: single-instance guard + free-port fallback (R27)."""

import socket


def test_first_instance_claims_mutex_then_second_sees_it():
    from circuit_networks.desktop import _mutex_taken

    # Process-lifetime handle is held globally, so the first call claims it...
    assert _mutex_taken() is False
    # ...and a second call within the same process sees the owned mutex.
    assert _mutex_taken() is True


def test_find_free_port_skips_occupied_ports():
    from circuit_networks.desktop import _find_free_port

    blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    blocker.bind(("127.0.0.1", 0))
    blocker.listen(1)
    occupied = blocker.getsockname()[1]
    try:
        free = _find_free_port(occupied)
        assert free > occupied
    finally:
        blocker.close()
    # Free port checks are non-destructive: the returned port must bind cleanly.
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    probe.bind(("127.0.0.1", free))
    probe.close()