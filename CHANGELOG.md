# Change Log

All notable changes to the "shadow-code" extension will be documented in this file.

## [0.5.5] - 2026-02-17

### Changed

- Combined streamed edits made by AI into a single change. Now pressing "Undo" (`Ctrl + Z`) should undo the entire AI code and give you your old code back.
- Further updated system prompts of all current languages (including "default") to retain comments in existing code.

### Changed

- Further updates to all system prompts.

## [0.5.3] - 2026-02-14

> Happy Valentine's Day. ❤️

### Changed

- Updated system prompts of Dart, TypeScript and JavaScript to better apply edits to existing code.

### Bug Fixes

- Fixed bad format of output diff in the `buildDiff()` function.

## [0.5.1] - 2026-02-12

### Changed

- Changed README videos to GIFs for Extension Page on VSCode.
- Prepare release for Open VSX (Cursor)

## [0.5.0] - 2026-02-10

### Changed

- Changed `context()` to `import()` for better syntax familiarity.

## [0.4.4] - 2026-02-09

### Changed

- Migrated `.shadow` file creation to the official VSCode `workspace.fs` API. Shadow Code should now work seamlessly in Remote SSH, Docker and GitHub Codespaces.

## [0.3.2] - 2026-02-05

Initial Beta Release.

### Includes

- Pseudocode to code conversion via `.shadow` files.
- Use of `context()` function in "shadow" code to add context of additional files.
- Basic support for all programming languages.
- Dedicated language support for Dart, JavaScript (+ jsx) and TypeScript (+ tsx).
- Extensive system prompt for the Dart Programming Language to serve as template for supporting additional languages in the future.