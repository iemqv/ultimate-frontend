# Interaction and motion

Use this reference when the change involves direct manipulation, interruptible transitions, or visual materials that convey hierarchy. Start with a state model: resting, pressed, dragging, settling, and interrupted if applicable. Define which action commits the change and how to cancel or undo it.

## Keep feedback tied to input

- **Press:** show feedback as soon as input starts; commit via the normal activation event, not `pointerdown`. Keep release, cancellation, and keyboard behavior intact. Never trigger the action twice by combining custom release handling with native click.
- **Drag:** store the pointer-to-element offset so the element doesn't jump. For a horizontal control inside a scrolling page, keep movement pending until its axis is clear; let a vertical movement scroll. Sample timestamped positions over a short window to estimate release velocity. Once you own the gesture, capture its pointer and track it 1:1 within bounds without an easing animation. Apply progressively stronger resistance only beyond bounds. Handle pointer cancellation, lost capture, and accidental clicks; preserve page scrolling outside the owned gesture. Offer a keyboard or simple pointer alternative to drag-only actions.
- **Release:** pick the destination from position and velocity rather than distance alone where momentum is meaningful. For an exponential per-millisecond decay `d`, the projected destination is `position + (velocityPxPerSecond / 1000) * d / (1 - d)`. `0.998` is an example, not a platform requirement. Clamp or snap to valid destinations. Prefer a non-bouncy spring for functional settling; carry measured velocity into the settle when the runtime supports it.
- **Interrupt:** begin the new gesture at the current rendered position, not the previous target. Stop the old animation, preserve continuity, and use the live velocity when handing off between animations. Guard against stale completion callbacks.

For a sheet or overlay, open from the control or edge it belongs to and dismiss toward that origin when it clarifies where the visitor will return. Restore focus to the trigger, or to a logical successor if it no longer exists.

## Show only useful depth

Use material, translucency, and shadows to make layering or a spatial relationship clearer. Keep text and controls legible over the worst supported background; use an opaque surface if the content is unstable or contrast drops. Preserve a visible focus treatment. Tune tracking and leading at the actual rendered size; use optical sizing when the chosen font supports it. Don't treat platform styling as a requirement for the web.

Honor reduced motion: keep direct manipulation under the user's control but remove decorative travel, overshoot, and momentum-driven settling if not needed. Ensure state changes remain clear without movement. Test re-grabbing during settling, cancellation, the slow boundary crossing and the quick flick, keyboard parity, and reduced motion.
