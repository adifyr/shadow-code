import * as assert from 'assert';
import {getLanguageHandler} from '../services/handler_interface';
import DartHandler from '../services/dart_handler';
import DefaultHandler from '../services/default_handler';
import JavaScriptHandler from '../services/js_handler';
import RustHandler from '../services/rs_handler';
import TypeScriptHandler from '../services/ts_handler';

suite('Handler Interface Test Suite', () => {
	test('getLanguageHandler returns DartHandler for dart extension', () => {
		const handler = getLanguageHandler('dart');
		assert.ok(handler instanceof DartHandler);
	});

	test('getLanguageHandler returns JavaScriptHandler for js extension', () => {
		const handler = getLanguageHandler('js');
		assert.ok(handler instanceof JavaScriptHandler);
	});

	test('getLanguageHandler returns JavaScriptHandler for jsx extension', () => {
		const handler = getLanguageHandler('jsx');
		assert.ok(handler instanceof JavaScriptHandler);
	});

	test('getLanguageHandler returns TypeScriptHandler for ts extension', () => {
		const handler = getLanguageHandler('ts');
		assert.ok(handler instanceof TypeScriptHandler);
	});

	test('getLanguageHandler returns TypeScriptHandler for tsx extension', () => {
		const handler = getLanguageHandler('tsx');
		assert.ok(handler instanceof TypeScriptHandler);
	});

	test('getLanguageHandler returns RustHandler for rs extension', () => {
		const handler = getLanguageHandler('rs');
		assert.ok(handler instanceof RustHandler);
	});

	test('getLanguageHandler returns DefaultHandler for unknown extension', () => {
		const handler = getLanguageHandler('py');
		assert.ok(handler instanceof DefaultHandler);
	});

	test('getLanguageHandler returns DefaultHandler for empty string', () => {
		const handler = getLanguageHandler('');
		assert.ok(handler instanceof DefaultHandler);
	});

	test('getLanguageHandler returns DefaultHandler for unsupported language', () => {
		const handler = getLanguageHandler('go');
		assert.ok(handler instanceof DefaultHandler);
	});

	test('All handlers implement ILanguageHandler interface methods', () => {
		const handlers = [
			getLanguageHandler('dart'),
			getLanguageHandler('js'),
			getLanguageHandler('ts'),
			getLanguageHandler('rs'),
			getLanguageHandler('unknown')
		];

		for (const handler of handlers) {
			assert.ok(typeof handler.buildUserPrompt === 'function');
			assert.ok(typeof handler.addMissingDependencies === 'function');
		}
	});

	test('getLanguageHandler is case-sensitive', () => {
		const handlerLower = getLanguageHandler('rs');
		const handlerUpper = getLanguageHandler('RS');

		assert.ok(handlerLower instanceof RustHandler);
		assert.ok(handlerUpper instanceof DefaultHandler);
	});
});