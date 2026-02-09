# Contributing to Shadow Code

First off, thanks for taking the time to contribute! :heart:

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions. 🎉

> And if you like the project, but just don't have time to contribute, that's fine. There are other easy ways to support the project and show your appreciation, which we would also be very happy about:
> - Star the project
> - Tweet about it
> - Refer this project in your project's readme
> - Mention the project at local meetups and tell your friends/colleagues

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
  - [I Want To Contribute](#i-want-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Improving The Documentation](#improving-the-documentation)
- [Adding Language Support](#adding-language-support)

## Code of Conduct

This project and everyone participating in it is governed by the [Shadow Code - Code of Conduct](/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [shadowstuffai@outlook.com](mailto:shadowstuffai@outlook.com).

## I Have A Question

Before you ask a question, it is best to search for existing [Issues](https://github.com/adifyr/shadow-code/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [Issue](https://github.com/adifyr/shadow-code/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, etc), depending on what seems relevant.

We will then take care of the issue as soon as possible.

## I Want To Contribute

> [!IMPORTANT]
> ### Legal Notice
> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content and that the content you contribute may be provided under the project licence.

### Reporting Bugs

#### Before Submitting a Bug Report

A good bug report shouldn't leave others needing to chase you up for more information. Therefore, we ask you to investigate carefully, collect information and describe the issue in detail in your report. Please complete the following steps in advance to help us fix any potential bug as fast as possible.

- Make sure that you are using the latest version.
- Determine if your bug is really a bug and not an error on your side e.g. using incompatible environment components/versions (Make sure that you have read the documentation in the README. If you are looking for support, you might want to check [this section](#i-have-a-question)).
- To see if other users have experienced (and potentially already solved) the same issue you are having, check if there is not already a bug report existing for your bug or error in the [bug tracker](https://github.com/adifyr/shadow-code/issues?q=label%3Abug).
- Also make sure to search the internet (including Stack Overflow) to see if users outside of the GitHub community have discussed the issue.
- Collect information about the bug:
- Stack trace (Traceback)
- OS, Platform and Version (Windows, Linux, macOS, x86, ARM)
- Version of the interpreter, compiler, SDK, runtime environment, package manager, depending on what seems relevant.
- Possibly your input and the output
- Can you reliably reproduce the issue? And can you also reproduce it with older versions?

#### How Do I Submit a Good Bug Report?

> [!WARNING]
> You must never report security related issues, vulnerabilities or bugs including sensitive information to the issue tracker, or elsewhere in public. Instead sensitive bugs must be sent by email to [aditya.majethia@hotmail.com](mailto:shadowstuffai@outlook.com).

We use GitHub issues to track bugs and errors. If you run into an issue with the project:

- Open an [Issue](https://github.com/adifyr/shadow-code/issues/new). (Since we can't be sure at this point whether it is a bug or not, we ask you not to talk about a bug yet and not to label the issue.)
- Explain the behavior you would expect and the actual behavior.
- Please provide as much context as possible and describe the *reproduction steps* that someone else can follow to recreate the issue on their own. This usually includes your code. For good bug reports you should isolate the problem and create a reduced test case.
- Provide the information you collected in the previous section.

Once it's filed:

- The project team will label the issue accordingly.
- A team member will try to reproduce the issue with your provided steps. If there are no reproduction steps or no obvious way to reproduce the issue, the team will ask you for those steps and mark the issue as `needs-repro`. Bugs with the `needs-repro` tag will not be addressed until they are reproduced.
- If the team is able to reproduce the issue, it will be marked `needs-fix`, as well as possibly other tags (such as `critical`), and the issue will be left to be [implemented by someone](#your-first-code-contribution).

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Shadow Code, **including completely new features and minor improvements to existing functionality**. Following these guidelines will help maintainers and the community to understand your suggestion and find related suggestions.

<!-- omit in toc -->
#### Before Submitting an Enhancement

- Make sure that you are using the latest version.
- Read the documentation in the README carefully and find out if the functionality is already covered, maybe by an individual configuration.
- Perform a [search](https://github.com/adifyr/shadow-code/issues) to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.
- Find out whether your idea fits with the scope and aims of the project. It's up to you to make a strong case to convince the project's developers of the merits of this feature. Keep in mind that we want features that will be useful to the majority of our users and not just a small subset. If you're just targeting a minority of users, consider writing an add-on/plugin library.

#### How Do I Submit a Good Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](https://github.com/adifyr/shadow-code/issues).

- Use a **clear and descriptive title** for the issue to identify the suggestion.
- Provide a **step-by-step description of the suggested enhancement** in as many details as possible.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why. At this point you can also tell which alternatives do not work for you.
- We also encourage you to **include screenshots or screen recordings** which help you demonstrate the steps or point out the part which the suggestion is related to.

## Adding Language Support

If your contribution involves adding support for a programming language, please take note of the following:

- Language support is added via their respective handlers, which all extend the `ILanguageHandler` interface.
- Each language also requires its own system and user prompt in the form of Markdown files.
- For a good example of what a complete language implementation looks like, check out the prompts in `assets/prompts/dart` and `dart_handler.ts` inside `src/services/dart_handler.ts`.

The `ILanguageHandler` interface implements 2 key functionalities:

1. It prepares the user prompt for that specific language.
2. It includes the logic for adding any missing dependencies if found in the output/generated code.

```typescript
export interface ILanguageHandler {
  buildUserPrompt(baseUserPrompt: string): Promise<{userPrompt: string, configFileUri?: Uri, config: string}>;
  addMissingDependencies(configFileUri: Uri, config: string, output: string): void;
}
```

Your language handler must also extend the `ILanguageHandler` interface. For the logic in `addMissingDependencies(...)`, prefer to implement a deterministic, regex-based parser for the targer language. If it isn't feasible to implement a deterministic parser, you can proceed with using an AI-based approach - as long as you explain why in the PR.

Once your handler has been written, you can go ahead and add it to the `getLanguageHandler()` function inside `handler_interface.ts`:

```typescript
export function getLanguageHandler(langExtName: string): ILanguageHandler {
  switch (langExtName) {
    case "dart": return new DartHandler();
    case "js": case "jsx": return new JavaScriptHandler();
    case "ts": case "tsx": return new TypeScriptHandler();
    default: return new DefaultHandler();
  }
}
```

Your case clause must be of the form `case "<language-extension>": return new YourLanguageHandler()`.

---

Thank you for reading our contribution guide :heart:. We eagerly await your PRs.
