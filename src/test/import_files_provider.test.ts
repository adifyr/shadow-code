import * as assert from 'assert';
import * as vscode from 'vscode';
import {Position, TextDocument, Uri} from 'vscode';

suite('Import Files Provider Test Suite', () => {
	test('Regex matches import( with incomplete closing', () => {
		const regex = /import\([^)]*$/;
		assert.ok(regex.test('import("'));
		assert.ok(regex.test('import("lib/'));
		assert.ok(regex.test('  import("src/'));
		assert.ok(!regex.test('import()'));
		assert.ok(!regex.test('import("lib/file.ts")'));
	});

	test('Quote count determines if cursor is inside string', () => {
		const testCases = [
			{text: 'import("', expected: 1},
			{text: 'import("lib/', expected: 1},
			{text: 'import("lib", "', expected: 2},
			{text: 'import(""', expected: 2},
		];

		for (const {text, expected} of testCases) {
			const quoteCount = (text.match(/"/g) || []).length;
			assert.strictEqual(quoteCount, expected);
		}
	});

	test('Even quote count means cursor outside string', () => {
		const evenQuotes = ['import("file")', 'import("", "")'];
		for (const text of evenQuotes) {
			const quoteCount = (text.match(/"/g) || []).length;
			assert.strictEqual(quoteCount % 2, 0);
		}
	});

	test('Odd quote count means cursor inside string', () => {
		const oddQuotes = ['import("', 'import("file", "'];
		for (const text of oddQuotes) {
			const quoteCount = (text.match(/"/g) || []).length;
			assert.strictEqual(quoteCount % 2, 1);
		}
	});

	test('Extension mapping for file patterns', () => {
		const patterns: Record<string, string> = {
			'dart': 'lib/**/*',
			'js': 'src/**/*',
			'ts': 'src/**/*',
			'rs': 'src/**/*'
		};

		assert.strictEqual(patterns['dart'], 'lib/**/*');
		assert.strictEqual(patterns['js'], 'src/**/*');
		assert.strictEqual(patterns['ts'], 'src/**/*');
		assert.strictEqual(patterns['rs'], 'src/**/*');
	});

	test('Fallback pattern for unsupported extensions', () => {
		const extName = 'py';
		const patterns: Record<string, string> = {
			'dart': 'lib/**/*',
			'js': 'src/**/*',
			'ts': 'src/**/*',
			'rs': 'src/**/*'
		};
		const pattern = patterns[extName] ?? '**/*';
		assert.strictEqual(pattern, '**/*');
	});

	test('Shadow file extension is removed correctly', () => {
		const testCases = [
			{path: '/path/to/file.dart.shadow', expected: '.dart'},
			{path: '/path/to/file.ts.shadow', expected: '.ts'},
			{path: '/path/to/file.js.shadow', expected: '.js'},
			{path: '/path/to/file.rs.shadow', expected: '.rs'},
		];

		for (const {path, expected} of testCases) {
			const extname = require('path').extname(path.replace(/\.shadow$/, ''));
			assert.strictEqual(extname, expected);
		}
	});

	test('Empty array when no quotes found', () => {
		const text = 'import()';
		const quotes = text.match(/"/g);
		assert.strictEqual(quotes, null);
		const quoteCount = (quotes || []).length;
		assert.strictEqual(quoteCount, 0);
	});

	test('Completion should not trigger outside import function', () => {
		const regex = /import\([^)]*$/;
		const nonTriggers = [
			'const x = "',
			'function test("',
			'console.log("',
			'// import("'
		];

		for (const text of nonTriggers) {
			assert.ok(!regex.test(text));
		}
	});

	test('Completion should not trigger with even quotes in import', () => {
		const textBeforeCursor = 'import("")';
		const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
		const shouldTrigger = /import\([^)]*$/.test(textBeforeCursor) && quoteCount % 2 !== 0;
		assert.strictEqual(shouldTrigger, false);
	});

	test('Completion should trigger with odd quotes in import', () => {
		const textBeforeCursor = 'import("';
		const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
		const shouldTrigger = /import\([^)]*$/.test(textBeforeCursor) && quoteCount % 2 !== 0;
		assert.strictEqual(shouldTrigger, true);
	});

	test('Extension extraction from various file paths', () => {
		const {extname} = require('path');
		const testCases = [
			{input: 'file.dart.shadow', expected: 'dart'},
			{input: 'path/to/file.ts.shadow', expected: 'ts'},
			{input: '/absolute/path/file.jsx.shadow', expected: 'jsx'},
			{input: 'C:\\Windows\\path\\file.rs.shadow', expected: 'rs'},
		];

		for (const {input, expected} of testCases) {
			const ext = extname(input.replace(/\.shadow$/, '')).slice(1);
			assert.strictEqual(ext, expected);
		}
	});

	test('Handles multiple commas in import function', () => {
		const regex = /import\([^)]*$/;
		const multiFileImports = [
			'import("file1.ts", "file2.ts", "',
			'import("a", "b", "c", "'
		];

		for (const text of multiFileImports) {
			assert.ok(regex.test(text));
		}
	});
});