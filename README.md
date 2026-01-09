# Shadow Code AI

Transform pseudo-code into production-ready code with AI-powered assistance.

## Features

- **Shadow Mode**: Open any file in "Shadow Mode" to write pseudo-code alongside your actual code
- **Real-time Conversion**: Automatically converts pseudo-code to actual code using AI
- **Diff Preview**: Review changes before applying them to your source files
- **Smart Interpretation**: Understands TODO comments and context-specific instructions
- **Multi-language Support**: Works with Dart, JavaScript, TypeScript, Python, and more

## Getting Started

### 1. Install the Extension

Install Shadow Code AI from the VSCode Marketplace.

### 2. Set Your API Key

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Open VSCode Settings (Cmd/Ctrl + ,)
3. Search for "Shadow Code AI"
4. Enter your Gemini API key

### 3. Use Shadow Mode

1. Right-click on any file tab
2. Select "Open In Shadow Mode"
3. Write pseudo-code in the shadow file
4. Watch as AI converts it to real code!

## Usage Example

**Write this pseudo-code:**
```dart
stateless widget UserCard { UserCard(string name, string email)

build { Card( child: Column([ Text(name, size: 18, weight: bold), Text(email, color: gray), ]) ) } }

```

**Get this code:**

```dart
class UserCard extends StatelessWidget {
  final String name;
  final String email;
  
  const UserCard({
    required this.name,
    required this.email,
    super.key,
  });
  
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          Text(
            name,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            email,
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
```