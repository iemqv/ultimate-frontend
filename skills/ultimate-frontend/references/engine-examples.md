# Version 1 contract examples

These are templates, not shipped UI or preview fixtures. Save one JSON block as `CONTRACT.json` inside the workspace. Replace the paths, names, states, and dimensions with those of the actual surface. Do not add a route, component or feature just to satisfy an example.

## Open creative build: examine a print

The print itself sets the opening composition. The next useful state shows a different scale and reveals how the paper holds the ink. The same task works at each width; the two captures at a given width are states of one composition, not competing comps.

```json
{
  "version": 1,
  "surface": "print-study",
  "intent": "build",
  "kind": "creative",
  "visitor": "A first-time visitor looking closely at the print",
  "outcome": "See the whole print and inspect the ink at the paper edge",
  "locks": [{"source": "DESIGN.md", "preserve": "Keep the approved type roles"}],
  "inputs": ["src", "public/prints", "package.json"],
  "direction": {
    "materials": [{"source": "public/prints/shore.png", "provenance": "Artist-supplied scan, cleared for this site", "role": "The print and its actual detail"}],
    "composition": "The print's left edge aligns its title and the detail control",
    "narrow": "Keep the print first and the detail control directly below it",
    "scenes": [
      {"scenario": "print-wide", "capture": "whole", "change": "See the whole composition on entry"},
      {"scenario": "print-wide", "capture": "edge", "change": "Read the ink texture at the paper edge"},
      {"scenario": "print-narrow", "capture": "whole", "change": "See the whole composition on entry"},
      {"scenario": "print-narrow", "capture": "edge", "change": "Read the ink texture without a horizontal scroll"}
    ]
  },
  "scenarios": [
    {
      "id": "print-wide",
      "path": "/prints/shore",
      "width": 1280,
      "height": 800,
      "state": "Whole print to ink detail with a pointer",
      "steps": [
        {"op": "capture", "id": "whole"},
        {"op": "click", "target": {"role": "button", "name": "Inspect ink"}},
        {"op": "visible", "target": {"role": "img", "name": "Ink at the paper edge"}},
        {"op": "capture", "id": "edge"}
      ]
    },
    {
      "id": "print-narrow",
      "path": "/prints/shore",
      "width": 390,
      "height": 844,
      "state": "Whole print to ink detail by keyboard with reduced motion",
      "reducedMotion": true,
      "steps": [
        {"op": "capture", "id": "whole"},
        {"op": "press", "key": "Tab", "focused": {"role": "button", "name": "Inspect ink"}},
        {"op": "press", "key": "Enter"},
        {"op": "visible", "target": {"role": "img", "name": "Ink at the paper edge"}},
        {"op": "capture", "id": "edge"}
      ]
    }
  ]
}
```

The keyboard steps assume the detail control is first in the tested page's tab order. Use the real tab order; don't remove navigation or a skip link to match the example.

## Scoped refinement: preserve an approved frame

Fix focus return without changing the supplied frame. `approved` does not turn a refinement into a new build. For an approved **build**, use `"intent": "build"` and include both narrow and wide scenarios. For a product or reading build without an approved frame, omit both `approved` and `direction`. For review-only work choose `"intent": "critique"` and follow the [read-only workflow](engine-workflow.md#discover-plan-and-preserve).

```json
{
  "version": 1,
  "surface": "saved-items",
  "intent": "refine",
  "kind": "product",
  "visitor": "A reader who opens details for a saved item",
  "outcome": "Dismiss details and resume at the same item using the keyboard",
  "locks": [{"source": "DESIGN.md", "preserve": "Preserve the approved saved-items layout and row styling"}],
  "inputs": ["src", "package.json"],
  "approved": {
    "frames": [
      {
        "reference": "design/approved/saved-return-390.png",
        "scenario": "saved-narrow",
        "capture": "returned",
        "regions": [
          {"id": "heading", "x": 16, "y": 56, "width": 358, "height": 56, "maxMeanDelta": 0.02},
          {"id": "item-row", "x": 16, "y": 128, "width": 358, "height": 68, "maxMeanDelta": 0.02}
        ]
      }
    ]
  },
  "scenarios": [
    {
      "id": "saved-narrow",
      "path": "/saved",
      "width": 390,
      "height": 844,
      "state": "Details dismissed and focus returned to the first item",
      "reducedMotion": true,
      "steps": [
        {"op": "press", "key": "Tab", "focused": {"role": "button", "name": "Details for Shore"}},
        {"op": "press", "key": "Enter"},
        {"op": "visible", "target": {"role": "dialog", "name": "Shore details"}},
        {"op": "press", "key": "Escape", "focused": {"role": "button", "name": "Details for Shore"}},
        {"op": "hidden", "target": {"role": "dialog", "name": "Shore details"}},
        {"op": "capture", "id": "returned"}
      ]
    }
  ]
}
```

Use an approved PNG that matches the viewport dimensions and state, including focus styling where applicable. A region is a pixel rectangle from the top-left of the frame. `maxMeanDelta` is the maximum normalized average per-channel pixel difference in that region (0 is exact). Set it for the actual fidelity requirement, not to make a bad capture pass. Review visual relationships and edge placement in the PNG as well as each numeric finding. Never replace the reference with the current render to clear a failure.
