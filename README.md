# CER Coach

A step-by-step coach that helps 8th graders build a Claim, Evidence and Reasoning (CER) response to any question, with a matching paper set. Supports fade as students show they can do each part alone.

Live site: **https://cer.mrbsocialstudies.org** (GitHub Pages from `main`).

## How It Works

- **Eight stations:** Set Up, Unpack, Gather, First Claim, Choose, Reasoning, Stress Test, Check.
- **Push-back:** simple rules in the browser check each answer and ask one follow-up question when it is vague, unsourced, or only repeats the evidence. Nothing is sent anywhere.
- **Support levels, per move (Claim, Evidence, Reasoning):** Model » Guided » Prompted » Solo. A move moves up after two CERs where the Coach's checks pass, the student scores it 3 or higher, and they tapped Stuck fewer than two times. A rough CER gives that move one level more support.
- **Versions:** Quick, Clear, Full, Deep, matching the paper set. Full and Deep require a counterpoint. Quick and Clear need 2 pieces of evidence, Full and Deep need 3.
- **Saving:** work saves in the student's browser only. The finished CER is written on paper.

## Adding a CER Question

1. Copy `prompts/_template.json` to `prompts/<id>.json` and fill it in. The `id` becomes the link: `https://cer.mrbsocialstudies.org/?q=<id>`.
2. Put any PDFs, images or document files in `sources/<id>/`.
3. Add a line for it to `prompts/index.json` so it shows in the question list.

Source types: `excerpt` (short passage + citation + link), `pdf`, `image`, `doc`, `link`.

## Files

```
index.html            app shell
assets/css/coach.css  look and print styles
assets/js/app.js      stations, routing, source viewer, check
assets/js/rules.js    push-back rules
assets/js/content.js  all student-facing wording (matches the paper set)
assets/js/store.js    browser saving and support levels
prompts/              one JSON file per CER question
sources/              files for each question
print/                paper-set build script and print-ready PDFs
docs/plan.md          the plan, research base and fade rules
```

## Working on It

No build step. To preview, run a local server from the repo folder (for example `python3 -m http.server`) and open `http://localhost:8000`.

Work on a branch, then merge to `main` to publish.

## Paper Set

`print/pdf/` holds the print masters (Plan, Build, Check at Quick and Full, plus the Steps Card). To rebuild them: `cd print && npm install && python3 build.py` (needs Python Playwright).
