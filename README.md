# Prompt IDE - Mac App

<div align="center">
  <img src="./assets/icon.svg" alt="Prompt IDE Logo" width="128" height="128">
  <h1>Prompt IDE</h1>
  <p>A powerful prompt development environment for Mac</p>
</div>

## 🚀 Features

- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting for AI prompts
- **Multi-Tab Support**: Work on multiple prompts simultaneously with tab-based editing
- **Local Storage**: All data is stored locally on your Mac - no cloud dependencies
- **Mac-Native Design**: Beautiful, Cursor-inspired interface that fits perfectly on macOS
- **Syntax Highlighting**: Custom syntax highlighting for AI prompts with auto-completion
- **Auto-Save**: Automatic saving of your work every 30 seconds
- **Prompt Templates**: Built-in templates for different AI model types (image, video, text)
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Keyboard Shortcuts**: Full keyboard shortcut support for efficient workflow
- **Export/Import**: Easy backup and restore of your prompt library

## 🛠️ Installation

### Option 1: Download Pre-built App (Recommended)

1. Download the latest release from the [Releases](https://github.com/your-username/prompt-ide/releases) page
2. Open the `.dmg` file and drag `Prompt IDE.app` to your Applications folder
3. Open the app from Applications (you may need to right-click and select "Open" on first launch)

### Option 2: Build from Source

#### Prerequisites

- Node.js 16 or later
- npm, yarn, or pnpm
- Xcode Command Line Tools (for macOS development)

#### Build Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/prompt-ide.git
   cd prompt-ide
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Build the app:
   ```bash
   npm run build
   npm run electron-build
   ```

4. The built app will be in the `dist-mac` folder

#### Development Mode

To run in development mode:

```bash
npm run electron-dev
```

This will start both the React dev server and the Electron app with hot reloading.

## 📖 Usage

### Getting Started

1. Launch Prompt IDE from your Applications folder
2. The app will open with a default prompt tab
3. Start writing your AI prompts in the editor
4. Use `Cmd+S` to save your work
5. Use `Cmd+N` to create new prompt tabs

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New prompt tab |
| `Cmd+S` | Save current tab |
| `Cmd+W` | Close current tab |
| `Cmd+T` | New tab (alternative) |
| `Cmd+1-9` | Switch to tab 1-9 |
| `Cmd+B` | Toggle sidebar |
| `Cmd+Shift+P` | Toggle properties panel |
| `Cmd+,` | Open preferences |
| `Cmd+Q` | Quit app |

### Menu Bar

The app includes a native macOS menu bar with all standard options:

- **File**: New, Open, Save, Close operations
- **Edit**: Cut, Copy, Paste, Select All
- **View**: Toggle sidebar, properties panel, zoom controls
- **Window**: Minimize, maximize, close window
- **Help**: About and help documentation

### Working with Prompts

#### Creating Prompts

1. Click the `+` button in the tab bar or use `Cmd+N`
2. Choose prompt type (Image, Video, Text)
3. Write your prompt in the editor
4. The app will auto-save every 30 seconds

#### Organizing Prompts

- **Collections**: Group related prompts together
- **Favorites**: Star your best prompts for quick access
- **Tags**: Add tags to prompts for better organization
- **Search**: Use the search bar to find prompts quickly

#### Prompt Types

- **Image Prompts**: For DALL-E, Midjourney, Stable Diffusion
- **Video Prompts**: For Runway, Pika Labs, and other video AI
- **Text Prompts**: For ChatGPT, Claude, and other text models

### Data Storage

All your data is stored locally on your Mac in:
```
~/Library/Application Support/Prompt IDE/prompt-ide-data/
```

This includes:
- All your prompts and collections
- App preferences and settings
- Tab states and editor configuration

### Backup and Sync

To backup your data:
1. Go to Settings → Data Management
2. Click "Export All Data"
3. Save the JSON file to your preferred location

To restore data:
1. Go to Settings → Data Management
2. Click "Import Data"
3. Select your backup JSON file

## 🎨 Customization

### Themes

The app automatically follows your system theme (Dark/Light mode). You can also manually toggle themes using the theme button in the editor.

### Editor Settings

Customize your editor experience:
- Font size and family
- Line numbers and word wrap
- Auto-completion preferences
- Tab size and indentation

### Syntax Highlighting

The app includes custom syntax highlighting for AI prompts:
- **Keywords**: `cinematic`, `realistic`, `professional`
- **Techniques**: `lighting`, `composition`, `depth of field`
- **Styles**: `portrait`, `landscape`, `close-up`
- **Quality**: `4k`, `ultra detailed`, `high resolution`
- **Artists**: `by Artist Name` (highlighted in italics)
- **Parameters**: `--parameter` (highlighted as operators)

## 🔧 Technical Details

### Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Editor**: Monaco Editor (VS Code editor)
- **Desktop**: Electron 32
- **Styling**: Tailwind CSS with custom variables
- **Data**: Local JSON files (no database required)

### Performance

- **Startup Time**: < 2 seconds on modern Macs
- **Memory Usage**: ~100MB typical usage
- **File Size**: ~200MB installed size
- **CPU Usage**: Minimal when idle

### Compatibility

- **macOS**: 10.14 (Mojave) or later
- **Architecture**: Universal Binary (Intel + Apple Silicon)
- **Permissions**: No special permissions required

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Start development: `npm run electron-dev`
5. Make your changes
6. Test thoroughly
7. Commit: `git commit -m 'Add amazing feature'`
8. Push: `git push origin feature/amazing-feature`
9. Submit a Pull Request

### Build Scripts

We provide a comprehensive build script:

```bash
# Check project structure
node scripts/build.js check

# Install dependencies
node scripts/build.js install

# Build for production
node scripts/build.js build

# Build Electron app
node scripts/build.js electron

# Complete build process
node scripts/build.js all

# Start development
node scripts/build.js dev
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/prompt-ide/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/prompt-ide/discussions)
- **Email**: support@promptide.app

## 🎯 Roadmap

- [ ] AI-powered prompt suggestions
- [ ] Prompt performance analytics
- [ ] Cloud sync (optional)
- [ ] Plugin system
- [ ] Advanced search and filtering
- [ ] Prompt version history
- [ ] Team collaboration features
- [ ] API integrations with AI services

## 🙏 Acknowledgments

- **Monaco Editor**: For the amazing code editor
- **Electron**: For making desktop apps with web technologies
- **Tailwind CSS**: For the beautiful styling system
- **React**: For the component framework
- **Vite**: For the fast build tool

---

<div align="center">
  <p>Made with ❤️ for the AI community</p>
  <p>
    <a href="https://github.com/your-username/prompt-ide/stargazers">⭐ Star us on GitHub</a> |
    <a href="https://twitter.com/promptide">🐦 Follow on Twitter</a> |
    <a href="https://promptide.app">🌐 Visit our website</a>
  </p>
</div>
