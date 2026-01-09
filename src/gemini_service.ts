import {GoogleGenAI} from '@google/genai';

/**
 * Service for interacting with Google Gemini API
 * Uses the latest @google/genai SDK (updated January 2025)
 */
export class GeminiService {
  private client: GoogleGenAI | null = null;
  private currentModel: string = 'gemini-2.0-flash-lite';

  /**
   * Initialize the Gemini API with the provided API key
   * @param apiKey Your Google AI API key
   * @param modelName The Gemini model to use (default: gemini-flash-lite-latest)
   */
  async initialize(apiKey: string, modelName: string = 'gemini-flash-lite-latest'): Promise<void> {
    try {
      // Initialize the client with API key
      this.client = new GoogleGenAI({apiKey});
      this.currentModel = modelName;

      console.log('Gemini service initialized successfully with model:', modelName);
    } catch (error) {
      console.error('Failed to initialize Gemini:', error);
      throw new Error(`Failed to initialize Gemini API: ${error}`);
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Generate code from pseudo-code using Gemini
   * @param originalCode The current code in the original file
   * @param pseudoCode The pseudo-code from the shadow file
   * @param filePath The file path for context
   * @param diff The changes made in the shadow file
   * @returns Generated code as a string
   */
  async generateCode(
    originalCode: string,
    pseudoCode: string,
    filePath: string,
    diff: string
  ): Promise<string> {
    if (!this.isInitialized() || !this.client) {
      throw new Error('Gemini service not initialized. Please set your API key in settings.');
    }

    try {
      const prompt = this.buildPrompt(originalCode, pseudoCode, filePath, diff);

      // Generate content using the new API
      const result = await this.client.models.generateContent({
        model: this.currentModel,
        contents: prompt,
        config: {
          temperature: 0.2,        // Lower temperature for consistent code
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: 'text/plain',  // Ensure plain text response
        },
      });

      // Check if the response was blocked
      if (!result || !result.text) {
        throw new Error('Empty or blocked response from Gemini');
      }

      const text = result.text;

      if (!text) {
        throw new Error('No text in response from Gemini');
      }

      return this.extractCodeFromResponse(text);
    } catch (error) {
      console.error('Error generating code:', error);

      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Invalid API key. Please check your Gemini API key in settings.');
        } else if (error.message.includes('quota')) {
          throw new Error('API quota exceeded. Please check your Google AI Studio quota.');
        } else if (error.message.includes('model')) {
          throw new Error('Model not found or not accessible. Please check the model name in settings.');
        }
      }

      throw new Error(`Failed to generate code: ${error}`);
    }
  }

  /**
   * Build the prompt for Gemini using the new content format
   */
  private buildPrompt(
    originalCode: string,
    pseudoCode: string,
    filePath: string,
    diff: string
  ): string {
    const fileExtension = filePath.split('.').pop() || 'dart';
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';

    const promptText = `You are an expert code generator specializing in converting pseudo-code into production-ready, idiomatic code.

**Task**: Convert the pseudo-code below into clean, well-structured ${fileExtension} code.

**File Context**:
- File: ${fileName}
- Language: ${fileExtension}
- Purpose: Generate actual ${fileExtension} code from pseudo-code

**Current Code in Original File**:
\`\`\`${fileExtension}
${originalCode || '// Empty file - generate from scratch'}
\`\`\`

**Pseudo-Code from Shadow File** (this is what needs to be converted):
\`\`\`
${pseudoCode}
\`\`\`

**Recent Changes** (what the user just modified):
\`\`\`diff
${diff || 'Initial content'}
\`\`\`

**Instructions**:

1. **Interpret the Pseudo-Code**: Understand the user's intent from the simplified syntax
2. **Generate Clean Code**: Produce idiomatic, well-formatted ${fileExtension} code
3. **Handle TODO Comments**: When you see \`// TODO:\` comments, implement the described functionality
4. **Maintain Context**: If there's existing code, integrate changes smoothly
5. **Follow Best Practices**:
   ${this.getLanguageSpecificGuidelines(fileExtension)}
6. **Complete Output**: Return the ENTIRE file content, not just the changed parts
7. **No Markdown**: Return ONLY raw code - no \`\`\` fences, no explanations, no preamble

**Critical**: Your response must be ONLY the code, ready to be written directly to the file.`;

    return promptText;
  }

  /**
   * Get language-specific guidelines
   */
  private getLanguageSpecificGuidelines(language: string): string {
    const guidelines: {[key: string]: string} = {
      'dart': `- Use proper Dart/Flutter syntax and conventions
   - Add \`const\` constructors where appropriate
   - Use \`final\` for immutable fields
   - Include proper imports (material.dart, etc.)
   - Follow Flutter widget patterns
   - Use proper StatelessWidget/StatefulWidget structure`,

      'ts': `- Use TypeScript types and interfaces
   - Prefer \`const\` and \`let\` over \`var\`
   - Use arrow functions where appropriate
   - Include proper type annotations
   - Follow modern ES6+ syntax`,

      'tsx': `- Use proper React/TypeScript syntax
   - Include necessary imports (React, types)
   - Use functional components with hooks
   - Add proper prop types
   - Follow React best practices`,

      'js': `- Use modern JavaScript (ES6+)
   - Prefer \`const\` and \`let\` over \`var\`
   - Use arrow functions where appropriate
   - Follow clean code principles`,

      'jsx': `- Use proper React syntax
   - Include necessary imports
   - Use functional components
   - Follow React best practices`,

      'py': `- Follow PEP 8 style guidelines
   - Use proper type hints (Python 3.6+)
   - Include docstrings for functions/classes
   - Use meaningful variable names`,

      'java': `- Follow Java naming conventions
   - Use proper access modifiers
   - Include necessary imports
   - Add JavaDoc comments for public methods`,

      'cpp': `- Follow C++ best practices
   - Use modern C++ features (C++11/14/17)
   - Include necessary headers
   - Use smart pointers where appropriate`,

      'go': `- Follow Go idioms and conventions
   - Use proper error handling
   - Add comments for exported functions
   - Follow gofmt formatting`,
    };

    return guidelines[language] || `- Follow ${language} best practices and conventions
   - Use proper syntax and formatting
   - Include necessary imports/includes
   - Write clean, maintainable code`;
  }

  /**
   * Extract code from Gemini's response
   * Removes any markdown formatting that might slip through
   */
  private extractCodeFromResponse(response: string): string {
    let code = response.trim();

    // Remove markdown code fences if present (shouldn't be, but just in case)
    // Match opening fence with optional language identifier
    code = code.replace(/^```[\w]*\n?/gm, '');
    // Remove closing fence
    code = code.replace(/\n?```\s*$/gm, '');

    // Remove any leading/trailing whitespace
    code = code.trim();

    return code;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.client = null;
  }
}