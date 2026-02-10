<p align="center"><img width="640" alt="shadow_code_logo" src="https://github.com/user-attachments/assets/4b379b0b-c711-4735-a9bd-9a8230979da3"/></p>
<p align="center"><i><b><code>"Developers think in code, not paragraphs."<br/></code></b></i></p>

# About Shadow Code

Shadow Coding<sup>TM</sup> is an AI coding technique that involves transforming human-written pseudocode to clean, accurate & production-ready code in the target language. _(At least, that's what I've told the AI to do in the system prompt.)_

In Shadow Coding, since users prompt using pseudocode instead of plain english, the input that the AI receives is much closer in nature to the intended output. As a result, compared to vibe coding, Shadow Coding can:

- Produce consistently high-quality code,
- That is closer to what the developer intends,
- Faster and with less tokens,
- Using cheaper/open-source models.

Most importantly, Shadow Coding puts developers back in the driver's seat. With Shadow Coding, developers can control how predictable they want their AI-generated code to be based on the detail & expressiveness of their pseudocode.

**But, that's not all. Check out the [Features](#features) section below to know more.**

# Installation

Shadow Code is currently available as a free & open-source VS Code Extension. Go ahead and install it from the Extensions Marketplace.

# Instructions

## 1. Open Shadow Mode

There are 3 ways to open Shadow Mode:

1. Right-click on the file tab in the editor. In the context menu that opens, click on "Open In Shadow Mode".
2. Click on the Shadow Code Icon located at the end of the editor tabs line, in the top-right corner.
3. Press Ctrl+Alt+S (Windows) or Cmd+Ctrl+S (Mac) with your preferred code file active in the editor.

https://github.com/user-attachments/assets/7257c5e1-c229-4a35-b05d-a5cebfb0ff0e

Shadow Mode opens up a parallel tab in your editor in split-view where you enter your pseudocode. You'll notice that it also creates a `.shadow` file as well. These "shadow" files live inside a `.shadows/` folder at the root of your workspace - within a path that mirrors the location of your original code file.

> [!NOTE]
> If you're in a shared workspace, you should ideally include the `.shadows/` folder in your `.gitignore`. This will ensure your shadow files don't mess with those of your collaborators.

## 2. Write Your "Shadow" Code

In the `.shadow` file, You are now free to write pseudocode as you see fit. Forget about syntax and lint errors - think of it as your own personal coding language.

## 3. Transform Into Code

Once you're done writing your "shadow" code, there's 2 ways you can convert it to your target code:

1. Click on the sparkles ✨ icon at the end of the editor tabs line, in the top-right corner.
2. Press Ctrl+Alt+Enter (Windows) or Cmd+Opt+Enter (Mac) with your shadow file active in the editor.

The first time you trigger this command, you may be asked to choose an AI model to generate the code. Go ahead and select your preferred model.

> [!IMPORTANT]
> Shadow Code integrates with VS Code's native Language Models API. As such, a model provider (such as Github Copilot) is required for Shadow Code to work.

Shadow Code will generate the target code in your original code file:

https://github.com/user-attachments/assets/f654a0f9-d216-4ccf-ac7b-d3024cf4b636

_The above code was generated using Gemini 2.5 Flash._

> [!WARNING]
> If you experience an error along the lines of `Failed To Stream AI Response: Response got filtered`, you need to go into your [Copilot settings on the GitHub website](https://github.com/settings/copilot/features) and - under Privacy - set **"Suggestions matching public code"** to **Allowed**.
>
> This is assuming you have GitHub Copilot as your model provider in VS Code.

# Features

## Extends Language Syntax

If you think about it, Shadow Coding is essentially interpreting one syntax and converting it to another. This can lead to some interesting use-cases. For example, if you find yourself writing the same set of boilerplate code in nearly every project, it may be prudent to "teach" the AI a specific "shadow syntax" that can consistently generate that boilerplate code for you. **This way, you can extend the syntax of your target programming language and even add features that your language doesn't have.**

A good case-study for this is data classes in [Dart](https://dart.dev). Dart, the programming language powering [Flutter](https://flutter.dev/), very famously lacks data classes. And though [the feature has been heavily requested since 2017](https://github.com/dart-lang/language/issues/314), there hasn't been much progress made on that front.

**Shadow Coding to the rescue! 🎉**

In this case, we can prompt the AI model to treat our shadow code in a certain way. Here's an example of such a "shadow syntax" that instructs the AI model to generate a Dart class that serves as an ORM for Firestore:

```
firestore class Payment {
	id?: string,
	payer_id: string,
	payer_name: string,
	merchant_id: string,
	method: enum(cash, card, online),
	amount: double,
	reversible: boolean,
	created_at: DateTime,
	updated_at: DateTime,
}
```

Here's what the AI generates:

https://github.com/user-attachments/assets/db65e0a7-a6e8-406d-8225-0a89f3df7dda

_The above code was generated using Open AI's GPT-OSS 20B Model._

Did you notice something? The AI didn't just generate something "close" to what we wanted - it generated EXACTLY the code we wanted. With shadow coding, you will find that your output code is often **more consistent and deterministic than what vibe coding would have given you.**

## Accepts Selective Context

The only dedicated syntax in a shadow file is the `import()` function. Unlike vibe coding, where you would be compelled to index your entire codebase and hope for the best, shadow coding lets you control exactly what code files the AI should be aware of to generate your target code.

The `import()` function goes at the top of your shadow file:

```javascript
import("lib/models/user.dart", "lib/screens/home.dart");

// Your pseudocode goes here...
```

By picking exactly what the model sees, you stop it from guessing or hallucinating based on unrelated files. It keeps the output sharp and doesn't waste tokens on code that doesn't matter.

> [!TIP]
> Shadow Code automatically picks up your `pubspec.yaml` (Dart) or `package.json` (JS/TS) config file to know what libraries you're using. So, no need to include them in your import function.

## Automatically Installs Dependencies

If the generated code makes use of dependencies that haven't been installed yet, Shadow Code goes the extra mile and installs those dependencies for you automatically. 🙂

# Performance

| Category        | Usage                                                       |
| --------------- | ----------------------------------------------------------- |
| Input Tokens    | 5k-8k tokens on average. _10k-12k tokens on the upper end._ |
| Output Tokens   | As big as your output code. _800-2000 tokens on average._   |
| Generation Time | Depends on the model. _~10 seconds on average._             |

# Contributions

Technically, Shadow Code supports any language via its `DefaultHandler`, but dedicated support currently exists for only Dart, JavaScript & TypeScript - along with `jsx/tsx` files. We'd appreciate all the help we can get in expanding our support to more languages. Please have a look at our [Contributing Guide](https://github.com/adifyr/shadow-code/blob/main/CONTRIBUTING.md) if you would like to contribute.

# Roadmap

| **Feature / Language**   | **Goal**                                                     | **Status**                |
| ------------------------ | ------------------------------------------------------------ | ------------------------- |
| **Inline Insertions**    | Insert code at a specific place without creating a new file. | 🏗️ In Progress            |
| **Inline Modifications** | Modify code at a specific place without creating a new file. | 🏗️ In Progress            |
| **Python Support**       | Add dedicated prompt and dependency addition for Python.     | 🕓 Planning Phase         |
| **Java Support**         | Add dedicated prompt and dependency addition for Java        | _Accepting Contributions_ |

---

### **Made with ❤️ and ☕ for Developers, by Developers**
