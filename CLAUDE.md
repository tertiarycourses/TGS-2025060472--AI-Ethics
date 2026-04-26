# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static web course called **"Responsible Generative AI Basics"** — a collection of interactive HTML/CSS/JS web apps teaching AI ethics. There is no build system, bundler, or package manager. All apps are self-contained HTML files served directly.

## Architecture

- **`hub/index.html`** — Main course hub page linking to all learning unit activities
- **`index.html`** (root) — Standalone "Cognitive Threat Matrix" AI risk scenario generator (bonus activity)
- **`course.md`** — Full course content, learning objectives, and activity descriptions (the canonical reference for what each app should teach)

### Learning Units

Each learning unit has its own directory with subdirectories per activity:

- **`lu1-ethical-principles/`** — Ethical dilemma simulator, principles quiz, prompt injection playground, decision framework, scepticism checker
- **`lu2-privacy/`** — Privacy policy generator, Python anonymisation pipeline demo
- **`lu3-best-practices/`** — AI comparison matrix, differential privacy explorer, XAI explorer, resource allocation simulator, ethics case study analyzer
- **`dataprivacy/`** — Data anonymisation techniques demo (uses OpenAI API client-side)

### Conventions

- Each activity is a standalone `index.html` (with inline `<style>` and `<script>`) — no shared component library
- Dark/light theme toggle is standard across all apps, using `data-theme` attribute on `<html>` and CSS custom properties (`--bg`, `--card-bg`, `--text`, etc.)
- Theme preference persists via `localStorage`
- The `dataprivacy/` app is the exception: it uses separate `styles.css` and `app.js` files and requires an OpenAI API key entered by the user

## Development

No build or install step. Open any `index.html` in a browser, or serve locally:

```
python3 -m http.server 8000
```

Hub is at `hub/index.html`. Activities link using relative paths (e.g., `../lu1-ethical-principles/ethical-dilemma/`).

## Style Guidelines

- Font: Georgia/Times New Roman serif stack
- Color scheme uses CSS custom properties for theme switching (dark theme is default)
- Consistent card-based layouts with `border-radius: 10px`, hover lift effects
- British English spelling in content (e.g., "scepticism", "anonymisation", "generalisation")
