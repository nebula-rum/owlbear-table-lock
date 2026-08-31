# Development Status

Table Lock v1.0.0 restores timer-based enforcement for the persistent Owlbear background page, using a 16 ms interval instead of `requestAnimationFrame`.

The clamp rules are unchanged from v0.2.0: zooming in is unrestricted, zooming out is clamped to the selected table's fit scale, and panning is clamped so the viewport does not expose space outside the selected table bounds.

The interval loop skips overlapping async Owlbear SDK checks if a previous enforcement pass is still in flight. This avoids piling up viewport API calls when a check takes longer than one interval.
