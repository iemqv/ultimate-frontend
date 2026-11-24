---
name: ultimate-frontend
description: Design, build, refine, or critique a frontend. Choose the page structure from the visitor's task and the actual material, art-direct the result, and verify its appearance and behavior in a browser. Use for websites, product UI, components, gesture work, and visual reviews.
---

# Ultimate Frontend

A good design decision changes what the visitor sees or can do. “Botanical,” “editorial,” or “premium” is not a decision about what to put on the screen. Decide what the visitor encounters first, what it lets them discover, and how they get from there to the main action.

## 1. Set the scope

Look at the brief, assets, content, components and, for existing work, the rendered screen. Separate what the user pinned from what you can design. Do not substitute a different product, add a shop, or discard specified sections to make the result stand out. For a fictional brief, create representative material; don't invent endorsements, real-world availability, official contact details or production capabilities.

- **New surface or approved redesign:** read [From brief to composition](references/composition.md) before coding. Commit to a direction while changing it is cheap. On a short brief, make reversible choices yourself; don't turn the method into an interview or a deliverable the user didn't request.
- **Refine:** keep the good parts of the current identity and flow. Locate the specific obstacle in a screenshot or a reproducible state. Change the smallest structural relationship that resolves it; don't invent a new visual world for a small fix.
- **Critique only:** inspect, do not implement. Name the location, what the visitor perceives, its consequence, and one remedy. If the screen already works, say so.

Set ambition by the visitor's job, not by the industry. **Persuade:** put evidence where a decision happens. **Experience:** let the visitor encounter the work, not a pitch about it. **Operate:** expose the working data and next action immediately; precision beats an original-looking shell. **Read:** make the material easy to enter, navigate and resume. A company's landing page and its control panel rarely have the same job.

## 2. Build the chosen structure, not a themed template

Start with the actual words and the subject-bearing artifact. Give each its intended space in the markup before styling navigation, badges or cards. Build the opening **and its handoff into the next section** together. A distinctive first viewport above a generic feature grid is half a composition. On a phone, preserve the decision or reveal, not the desktop coordinates.

Give richness to the content that earns attention. A diagram should explain a relationship, a specimen should be examinable, a preview should contain the relevant data, and a photograph needs an intentional crop. If a needed asset is unavailable, choose a viable composition around material you have. Don't call a decorative render a product screenshot or charge for asset generation without permission.

Write role-based tokens from the chosen material: the working edge or grid, display/body/metadata roles, a spacing contrast that expresses grouping, and where color carries meaning. Carry **one** recognizable rule into a second useful part of the page, rather than repeating the same component everywhere. Read the headline without its styling; trim copy that only announces a section the content already explains.

## 3. Make the primary action feel finished

Use native controls when they fit. Show feedback from the press, commit on activation, and leave a way back. Make the selected, unavailable, empty and recovery states that the task actually needs. Name actions by their outcome. Don't add a carousel, cursor effect or drag gesture merely to demonstrate motion.

For drag, sheets, interruption, transitions that preserve position, or material depth, use [Interaction and motion](references/interaction.md). Keyboard users must reach the same outcome; reducing motion must not hide content. On a static page, test an ordinary action such as opening an item, returning, and finding the previous position.

## 4. Redline the render once, then verify

Use [Browser finish check](references/finish-check.md). For new work, compare the opening and next section at desktop and phone sizes to the chosen composition. For a refinement, compare the affected state to the original at the same width and reproduce the action that was difficult. A tidy page with the wrong structure needs a layout correction, not a new accent. If the design holds, don't restyle it for the sake of difference. Collect findings, fix them together, then recheck affected states. Report what the browser showed and what you could not verify.

Adapted from Anthropic, Emil Kowalski, Leonxlnx, Paul Bakaus, and [Damir Sokolovsky's Unslop](https://github.com/heydamir/unslop) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); modified scope, direction and redline method). See `ATTRIBUTION.md` in the distribution. No upstream skill installation is required.
