# Blind pilot gallery

Use an evaluation root outside the tooling directory:

```text
ROOT/
  runs.json
  arms/
    <id>/site/index.html
    <id>/site/assets/...
```

`runs.json` is a nonempty array of objects with `id`, `brief`, `group`, and `repeat`. IDs are unique and may contain only ASCII letters, digits, underscores, hyphens, and dots, starting with a letter or digit. Use neutral brief labels; the gallery displays them verbatim. Group is `control`, `baseline`, or `candidate`; repeat is an integer or nonempty string. Each `(brief, repeat, group)` must be unique. Keep only public preview assets in each `site` directory. Use relative asset URLs, not URLs beginning with `/`.

Start the server, then run capture in another terminal:

```sh
python3 gallery.py ROOT 41761
node capture.cjs ROOT 41761
```

Open `http://127.0.0.1:41761`. Each brief/repeat contributes every available cross-group pair. Two distinct control runs for the same brief also contribute a control–control pair. A private seed randomizes pair order and A/B assignment and keeps them stable across restarts. Screenshots show the viewport at 1440 × 960 or 390 × 844; use interactive mode to scroll or operate the page at either viewport size. On narrow screens, wide interactive viewports scroll inside their preview cards.

Cast separate visual and task votes and enter a reason for each comparison. Ballots are stored in the browser profile for the gallery address; give each reviewer a separate profile or browser context. Export votes as JSON before closing an ephemeral profile. After all comparisons are voted, **Reveal assignments** shows the run IDs, groups, and repeats. The export remains blind; join its comparison IDs against `assignments` in the private smoke report for analysis. Keep the port, run set, and seed unchanged during a voting session.

Capture uses `playwright-core` and its Chromium browser. Set `UF_PLAYWRIGHT_CORE` to an absolute package directory or `UF_CHROMIUM` to an executable to use an existing installation. It checks page load status, visible `h1`, horizontal overflow, and HTTP, JavaScript, and request errors at both sizes. It captures loaded pages even if these checks fail and returns nonzero if any smoke check fails. `ROOT/.pilot-gallery/smoke.json` includes per-run results and the private assignment mapping. Keep all of `ROOT/.pilot-gallery` away from reviewers prior to reveal. Smoke is not a substitute for checking the brief's actual tasks.

The server binds to IPv4 loopback and serves only fixed gallery routes, viewport captures, the site entry, and allowlisted web asset types. It does not follow symlinks or list directories. Preview frames use opaque-origin sandboxing and a CSP that limits subresources to the slot's own subtree and inline scripts and styles. Popups, form submission, and top-level navigation from the frame are blocked. This is not a guarantee against all network activity in live mode: a preview can still attempt to navigate its own frame. Automated capture separately intercepts requests outside the assigned preview. Blinding hides gallery metadata, not identifying content present in the sites themselves or recognition of repeated previews.

Run the self-contained synthetic test with `node test_gallery.cjs`. It starts a temporary gallery, captures healthy and broken examples, and exercises file restrictions, sandboxed interaction, screenshots, ballots, and reveal. No model calls are made.
