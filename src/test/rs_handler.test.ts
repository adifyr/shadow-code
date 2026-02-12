import * as assert from 'assert';
import {parse} from 'smol-toml';

suite('Rust Handler Test Suite', () => {
	suite('NON_EXTERNAL_ROOTS constants', () => {
		const NON_EXTERNAL_ROOTS = new Set([
			"std", "core", "alloc", "proc_macro", "test",
			"crate", "self", "super",
		]);

		test('Standard library roots are recognized', () => {
			assert.ok(NON_EXTERNAL_ROOTS.has('std'));
			assert.ok(NON_EXTERNAL_ROOTS.has('core'));
			assert.ok(NON_EXTERNAL_ROOTS.has('alloc'));
			assert.ok(NON_EXTERNAL_ROOTS.has('proc_macro'));
			assert.ok(NON_EXTERNAL_ROOTS.has('test'));
		});

		test('Module keywords are recognized', () => {
			assert.ok(NON_EXTERNAL_ROOTS.has('crate'));
			assert.ok(NON_EXTERNAL_ROOTS.has('self'));
			assert.ok(NON_EXTERNAL_ROOTS.has('super'));
		});

		test('External crates are not in NON_EXTERNAL_ROOTS', () => {
			assert.ok(!NON_EXTERNAL_ROOTS.has('tokio'));
			assert.ok(!NON_EXTERNAL_ROOTS.has('serde'));
			assert.ok(!NON_EXTERNAL_ROOTS.has('axum'));
		});
	});

	suite('Cargo.toml parsing', () => {
		test('Parse simple Cargo.toml with dependencies', () => {
			const toml = `
[package]
name = "my-app"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }
`;
			const doc = parse(toml) as any;
			assert.strictEqual(doc.package.name, 'my-app');
			assert.ok(doc.dependencies);
			assert.ok(doc.dependencies.serde);
			assert.ok(doc.dependencies.tokio);
		});

		test('Parse Cargo.toml with dev-dependencies', () => {
			const toml = `
[package]
name = "test-app"

[dependencies]
serde = "1.0"

[dev-dependencies]
criterion = "0.5"
`;
			const doc = parse(toml) as any;
			assert.ok(doc.dependencies.serde);
			assert.ok(doc['dev-dependencies'].criterion);
		});

		test('Parse Cargo.toml with build-dependencies', () => {
			const toml = `
[package]
name = "build-app"

[build-dependencies]
cc = "1.0"
`;
			const doc = parse(toml) as any;
			assert.ok(doc['build-dependencies'].cc);
		});

		test('Parse Cargo.toml with workspace dependencies', () => {
			const toml = `
[workspace]
members = ["crate1", "crate2"]

[workspace.dependencies]
shared-dep = "1.0"
`;
			const doc = parse(toml) as any;
			assert.ok(doc.workspace);
			assert.ok(doc.workspace.dependencies);
			assert.ok(doc.workspace.dependencies['shared-dep']);
		});

		test('Handle empty Cargo.toml sections', () => {
			const toml = `
[package]
name = "minimal"

[dependencies]
`;
			const doc = parse(toml) as any;
			assert.strictEqual(doc.package.name, 'minimal');
		});
	});

	suite('Dependency name normalization', () => {
		test('Hyphens are converted to underscores for use statements', () => {
			const depName = 'my-crate';
			const normalized = depName.replace(/-/g, '_');
			assert.strictEqual(normalized, 'my_crate');
		});

		test('Multiple hyphens are converted', () => {
			const depName = 'my-awesome-crate';
			const normalized = depName.replace(/-/g, '_');
			assert.strictEqual(normalized, 'my_awesome_crate');
		});

		test('Underscores are converted to hyphens for cargo add', () => {
			const crateName = 'my_crate';
			const forCargo = crateName.replace(/_/g, '-');
			assert.strictEqual(forCargo, 'my-crate');
		});

		test('Package name with hyphens', () => {
			const toml = `
[package]
name = "my-rust-app"
`;
			const doc = parse(toml) as any;
			const normalized = doc.package.name.replace(/-/g, '_');
			assert.strictEqual(normalized, 'my_rust_app');
		});
	});

	suite('Use statement regex extraction', () => {
		test('Extract simple use statement', () => {
			const code = 'use tokio::runtime::Runtime;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'tokio');
		});

		test('Extract use statement with semicolon', () => {
			const code = 'use serde;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'serde');
		});

		test('Extract use statement with alias', () => {
			const code = 'use axum as web;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'axum');
		});

		test('Extract pub use statement', () => {
			const code = 'pub use tokio::sync::Mutex;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'tokio');
		});

		test('Extract pub(crate) use statement', () => {
			const code = 'pub(crate) use serde::Serialize;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'serde');
		});

		test('Extract multiple use statements', () => {
			const code = `
use tokio::runtime::Runtime;
use serde::{Serialize, Deserialize};
use axum::Router;
`;
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const crates = new Set<string>();
			let match;
			while ((match = regex.exec(code)) !== null) {
				crates.add(match[1]);
			}
			assert.strictEqual(crates.size, 3);
			assert.ok(crates.has('tokio'));
			assert.ok(crates.has('serde'));
			assert.ok(crates.has('axum'));
		});

		test('Do not extract std library use statements as external', () => {
			const code = 'use std::collections::HashMap;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const NON_EXTERNAL_ROOTS = new Set([
				"std", "core", "alloc", "proc_macro", "test",
				"crate", "self", "super",
			]);
			const match = regex.exec(code);
			assert.ok(match);
			const crateName = match[1];
			assert.strictEqual(crateName, 'std');
			assert.ok(NON_EXTERNAL_ROOTS.has(crateName));
		});

		test('Do not extract crate keyword as external', () => {
			const code = 'use crate::models::User;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const NON_EXTERNAL_ROOTS = new Set([
				"std", "core", "alloc", "proc_macro", "test",
				"crate", "self", "super",
			]);
			const match = regex.exec(code);
			assert.ok(match);
			assert.ok(NON_EXTERNAL_ROOTS.has(match[1]));
		});

		test('Extract use with underscore in crate name', () => {
			const code = 'use my_crate::utils;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'my_crate');
		});

		test('Extract use with numbers in crate name', () => {
			const code = 'use base64::encode;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'base64');
		});
	});

	suite('Extern crate regex extraction', () => {
		test('Extract simple extern crate', () => {
			const code = 'extern crate serde;';
			const regex = /extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'serde');
		});

		test('Extract multiple extern crate declarations', () => {
			const code = `
extern crate serde;
extern crate tokio;
`;
			const regex = /extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
			const crates = new Set<string>();
			let match;
			while ((match = regex.exec(code)) !== null) {
				crates.add(match[1]);
			}
			assert.strictEqual(crates.size, 2);
			assert.ok(crates.has('serde'));
			assert.ok(crates.has('tokio'));
		});

		test('Extract extern crate with underscore', () => {
			const code = 'extern crate my_crate;';
			const regex = /extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'my_crate');
		});
	});

	suite('Missing dependency detection', () => {
		test('Filter out existing dependencies', () => {
			const existing = new Set(['std', 'serde', 'tokio']);
			const found = ['std', 'serde', 'axum'];
			const missing = found.filter(c => !existing.has(c));
			assert.strictEqual(missing.length, 1);
			assert.strictEqual(missing[0], 'axum');
		});

		test('All dependencies exist', () => {
			const existing = new Set(['std', 'serde', 'tokio', 'axum']);
			const found = ['std', 'serde', 'axum'];
			const missing = found.filter(c => !existing.has(c));
			assert.strictEqual(missing.length, 0);
		});

		test('No dependencies exist', () => {
			const existing = new Set(['std']);
			const found = ['serde', 'tokio', 'axum'];
			const missing = found.filter(c => !existing.has(c));
			assert.strictEqual(missing.length, 3);
		});

		test('Package name is excluded from missing', () => {
			const packageName = 'my_app';
			const existing = new Set(['std', packageName]);
			const found = ['my_app', 'serde'];
			const missing = found.filter(c => !existing.has(c));
			assert.strictEqual(missing.length, 1);
			assert.strictEqual(missing[0], 'serde');
		});
	});

	suite('Cargo add command construction', () => {
		test('Single dependency', () => {
			const required = ['serde'];
			const command = `cargo add ${required.join(' ')}`;
			assert.strictEqual(command, 'cargo add serde');
		});

		test('Multiple dependencies', () => {
			const required = ['serde', 'tokio', 'axum'];
			const command = `cargo add ${required.join(' ')}`;
			assert.strictEqual(command, 'cargo add serde tokio axum');
		});

		test('Dependencies with hyphens for cargo', () => {
			const required = ['my-crate', 'another-crate'];
			const command = `cargo add ${required.join(' ')}`;
			assert.strictEqual(command, 'cargo add my-crate another-crate');
		});
	});

	suite('Edge cases and error handling', () => {
		test('Empty use statement block', () => {
			const code = '';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const matches = Array.from(code.matchAll(regex));
			assert.strictEqual(matches.length, 0);
		});

		test('Regex matches inside comments (known limitation)', () => {
			const code = '// use serde::Serialize;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match, 'regex currently matches inside comments (known limitation)');
		});

		test('Regex matches inside string literals (known limitation)', () => {
			const code = 'let s = "use serde::Serialize;";';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match, 'regex currently matches inside string literals (known limitation)');
		});

		test('Invalid crate names are not matched', () => {
			const code = 'use 123invalid::Something;';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(!match);
		});

		test('Nested braces in use statement', () => {
			const code = 'use serde::{Serialize, Deserialize};';
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			assert.ok(match);
			assert.strictEqual(match[1], 'serde');
		});

		test('Parse malformed TOML gracefully', () => {
			const invalidToml = '[package\nname = "broken';
			try {
				parse(invalidToml);
				assert.fail('Should have thrown an error');
			} catch (err) {
				assert.ok(err);
			}
		});
	});

	suite('Template replacement', () => {
		test('Replace cargo_toml placeholder in user prompt', () => {
			const basePrompt = 'Here is the Cargo.toml:\n```toml\n{{cargo_toml}}\n```';
			const cargoToml = '[package]\nname = "test"';
			const userPrompt = basePrompt.replace('{{cargo_toml}}', cargoToml);
			assert.ok(userPrompt.includes('[package]'));
			assert.ok(userPrompt.includes('name = "test"'));
			assert.ok(!userPrompt.includes('{{cargo_toml}}'));
		});

		test('Empty cargo_toml replacement', () => {
			const basePrompt = 'Cargo.toml: {{cargo_toml}}';
			const cargoToml = '';
			const userPrompt = basePrompt.replace('{{cargo_toml}}', cargoToml);
			assert.strictEqual(userPrompt, 'Cargo.toml: ');
		});
	});

	suite('Integration scenarios', () => {
		test('Complete flow: parse TOML, extract dependencies, find missing', () => {
			const toml = `
[package]
name = "my-app"

[dependencies]
serde = "1.0"
`;
			const code = `
use serde::Serialize;
use tokio::runtime::Runtime;
use axum::Router;
`;

			const doc = parse(toml) as any;
			const NON_EXTERNAL_ROOTS = new Set([
				"std", "core", "alloc", "proc_macro", "test",
				"crate", "self", "super",
			]);

			const deps = new Set<string>([
				...NON_EXTERNAL_ROOTS,
				...(doc.package?.name ? [doc.package.name.replace(/-/g, '_')] : []),
				...Object.keys(doc.dependencies ?? {}).map((k: string) => k.replace(/-/g, '_')),
			]);

			const crates = new Set<string>();
			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			let match;
			while ((match = regex.exec(code)) !== null) {
				crates.add(match[1]);
			}

			const required = Array.from(crates)
				.filter((c) => !deps.has(c))
				.map((c) => c.replace(/_/g, '-'));

			assert.strictEqual(required.length, 2);
			assert.ok(required.includes('tokio'));
			assert.ok(required.includes('axum'));
			assert.ok(!required.includes('serde'));
		});

		test('Workspace dependency is recognized', () => {
			const toml = `
[workspace.dependencies]
shared = "1.0"

[dependencies]
shared = { workspace = true }
`;
			const code = 'use shared::utils;';

			const doc = parse(toml) as any;
			const deps = new Set<string>([
				...Object.keys(doc.dependencies ?? {}),
				...Object.keys(doc.workspace?.dependencies ?? {}),
			]);

			assert.ok(deps.has('shared'));

			const regex = /(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:::|;|\s+as\s)/g;
			const match = regex.exec(code);
			const crateName = match![1];

			assert.ok(deps.has(crateName));
		});
	});
});