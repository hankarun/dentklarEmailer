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

## Database

The app uses SQLite to store:

- **Templates**: Email templates with subject and body
- **Email History**: Record of all sent emails with attached PDFs

Data is stored in the user's application data directory.

## License

MIT

## Author

hankarun (hankarun@gmail.com)
