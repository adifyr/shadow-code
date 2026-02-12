# Change Log

All notable changes to the "shadow-code" extension will be documented in this file.

## [0.6.0] - 2026-02-12

### Added

- Dedicated Rust language support with handler, system prompt, and auto-dependency installation via `cargo add`.
- `smol-toml` dependency for Cargo.toml parsing.

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