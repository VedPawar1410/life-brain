"""Guards the eval data itself: a typo'd id would silently make a case unpassable."""

from evals.cases import ASK_CASES, BRAIN, CAPTURE_CASES, UNRELATED_TO_HIKE


def test_every_expected_id_exists_in_the_brain():
    ids = {e.id for e in BRAIN}
    assert len(ids) == len(BRAIN)
    for _, acceptable, _ in CAPTURE_CASES:
        assert acceptable - {None} <= ids
    for _, must_cite, _ in ASK_CASES:
        assert must_cite <= ids
    assert UNRELATED_TO_HIKE <= ids
