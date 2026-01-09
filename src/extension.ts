import * as vscode from 'vscode';
import {CodeGenerator} from './code_generator';
import {GeminiService} from './gemini_service';
import {ShadowFileManager} from './shadow_file_manager';

let geminiService: GeminiService;
let shadowFileManager: ShadowFileManager;
let codeGenerator: CodeGenerator;
let changeListeners: vscode.Disposable[] = [];

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
	console.log('Shadow Code AI extension is now active');

	// Initialize services
	geminiService = new GeminiService();
	shadowFileManager = new ShadowFileManager();
	codeGenerator = new CodeGenerator(geminiService, shadowFileManager);

	// Initialize Gemini with API key from settings
	await initializeGemini();

	// Register command: Open In Shadow Mode
	const openShadowCommand = vscode.commands.registerCommand(
		'shadow-code-ai.openInShadowMode',
		async (uri?: vscode.Uri) => {
			try {
				// Get the URI from context or active editor
				const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

				if (!targetUri) {
					vscode.window.showErrorMessage('No file selected');
					return;
				}

				// Don't allow opening shadow mode for shadow files
				if (ShadowFileManager.isShadowFile(targetUri.fsPath)) {
					vscode.window.showWarningMessage('Cannot open shadow mode for a shadow file');
					return;
				}

				// Create or get shadow file
				const shadowUri = await shadowFileManager.createShadowFile(targetUri);

				// Open in split view
				await shadowFileManager.openInSplitView(targetUri, shadowUri);

				// Set up change listener for this shadow file
				setupShadowFileWatcher(shadowUri);

				vscode.window.showInformationMessage(
					'Shadow mode activated! Start writing pseudo-code.'
				);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				vscode.window.showErrorMessage(`Failed to open shadow mode: ${errorMessage}`);
			}
		}
	);

	// Register configuration change listener
	const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration('shadowCodeAI.geminiApiKey') ||
			e.affectsConfiguration('shadowCodeAI.modelName')) {
			await initializeGemini();
		}
	});

	// Register close listener to clean up
	const closeListener = vscode.workspace.onDidCloseTextDocument((document) => {
		if (ShadowFileManager.isShadowFile(document.uri.fsPath)) {
			console.log('Shadow file closed:', document.uri.fsPath);
		}
	});

	// Add to subscriptions
	context.subscriptions.push(
		openShadowCommand,
		configChangeListener,
		closeListener,
		geminiService,
		shadowFileManager
	);
}

/**
 * Initialize or reinitialize Gemini service with API key from settings
 */
async function initializeGemini(): Promise<void> {
	const config = vscode.workspace.getConfiguration('shadowCodeAI');
	const apiKey = config.get<string>('geminiApiKey');
	const modelName = config.get<string>('modelName') || 'gemini-2.0-flash-lite';

	if (!apiKey) {
		vscode.window.showWarningMessage(
			'Shadow Code AI: Please set your Gemini API key in settings',
			'Open Settings'
		).then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand(
					'workbench.action.openSettings',
					'shadowCodeAI.geminiApiKey'
				);
			}
		});
		return;
	}

	try {
		await geminiService.initialize(apiKey, modelName);
		console.log('Gemini initialized with model:', modelName);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to initialize Gemini: ${error}`,
			'Check Settings'
		).then(selection => {
			if (selection === 'Check Settings') {
				vscode.commands.executeCommand(
					'workbench.action.openSettings',
					'shadowCodeAI'
				);
			}
		});
	}
}

/**
 * Set up change watcher for shadow file with debouncing
 */
function setupShadowFileWatcher(shadowUri: vscode.Uri): void {
	const config = vscode.workspace.getConfiguration('shadowCodeAI');
	const delay = config.get<number>('autoTriggerDelay') || 2000;

	// Remove existing listener for this file if any
	cleanupListenerForFile();

	// Set up debounced listener
	const listener = shadowFileManager.setupDebounce(
		shadowUri.fsPath,
		async () => {
			console.log('Auto-triggering code generation for:', shadowUri.fsPath);

			// Check if Gemini is initialized
			if (!geminiService.isInitialized()) {
				vscode.window.showWarningMessage(
					'Shadow Code AI: Please set your Gemini API key in settings'
				);
				return;
			}

			// Generate and apply code
			await codeGenerator.generateAndApply(shadowUri);
		},
		delay
	);

	changeListeners.push(listener);
}

/**
 * Clean up listener for a specific file
 */
function cleanupListenerForFile(): void {
	changeListeners = changeListeners.filter(_ => {
		// This is a simple cleanup - in a production app, you'd want to track which listener belongs to which file
		return true;
	});
}

/**
 * Extension deactivation
 */
export function deactivate() {
	// Dispose all listeners
	changeListeners.forEach(listener => listener.dispose());
	changeListeners = [];

	console.log('Shadow Code AI extension deactivated');
}