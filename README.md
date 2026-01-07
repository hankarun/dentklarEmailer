# DentKlar - Dental Practice Email Client

An Electron desktop application for sending invoices and communications from a dental practice. Built with Electron, TypeScript, and Vite.

## Features

- **Email Sending**: Send emails with PDF attachments via SMTP
- **PDF Processing**: Extract patient data (name, title) from PDF invoices automatically
- **Email Templates**: Create, edit, and manage reusable email templates with placeholders
- **Email History**: Track all sent emails with search functionality and statistics
- **SMTP Configuration**: Configurable SMTP settings with connection testing
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tooling
- **Electron Forge** - Packaging and distribution
- **better-sqlite3** - Local database for templates and email history
- **nodemailer** - Email sending
- **pdf-parse** - PDF text extraction

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd my-app

# Install dependencies
npm install
```

### Development

```bash
# Start the app in development mode
npm start
```

### Building

```bash
# Package the app
npm run package

# Create distributables
npm run make
```

## Project Structure

```
├── src/
│   ├── main.ts          # Main process - handles app lifecycle, IPC, email sending
│   ├── preload.ts       # Preload script - exposes APIs to renderer
│   ├── renderer.ts      # Renderer process - UI logic
│   ├── database.ts      # SQLite database operations
│   └── index.css        # Styles
├── index.html           # Main HTML template
├── forge.config.ts      # Electron Forge configuration
├── vite.*.config.ts     # Vite configurations for main, preload, and renderer
└── package.json
```

## Configuration

### SMTP Settings

Configure your SMTP server through the Settings window in the app:

- **Host**: SMTP server hostname
- **Port**: SMTP port (typically 587 for TLS, 465 for SSL)
- **Secure**: Enable for SSL connections
- **User**: SMTP username/email
- **Password**: SMTP password

### Email Templates

Templates support the following placeholders:

- `{{NAME}}` - Recipient's name
- `{{ANREDE}}` - Salutation (Herr/Frau)
- `{{ANREDE_SUFFIX}}` - Suffix for formal address (r/empty)

## Auto-Update

The application supports automatic updates via GitHub releases using `electron-updater`. When a new version is published, the app will:

1. Check for updates automatically at startup (packaged app only)
2. Download the update in the background
3. Notify the user when an update is ready
4. Install the update when the app is quit

### Auto-Update Configuration

The `app-update.yml` file in the root directory configures the update provider:

```yaml
owner: hankarun
repo: dentklarEmailer
provider: github
```

This file is automatically included in the packaged app as an extra resource so that `electron-updater` can find it at runtime. It tells the updater to check for new releases on the GitHub repository.

### Publishing Updates

To publish a new version:

```bash
# Update version in package.json
npm version <major|minor|patch>

# Build and publish to GitHub releases
npm run publish
```

The build process automatically generates `latest.yml` with update metadata and publishes it along with the installer to GitHub releases.

## Database

The app uses SQLite to store:

- **Templates**: Email templates with subject and body
- **Email History**: Record of all sent emails with attached PDFs

Data is stored in the user's application data directory.

## License

MIT

## Author

hankarun (hankarun@gmail.com)
