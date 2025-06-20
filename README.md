# Contentful Localization Tool

A command-line tool for exporting Contentful entries for translation and importing them back with support for nested references and rate limiting.

## Installation

```bash
npm install
npm link  # Makes contentful-loc command globally available
```

## Configuration

Before using the tool, configure your Contentful settings:

```bash
contentful-loc config
```

This will prompt you for:
- **Contentful Management API token**
- **Space ID**
- **Environment ID** (defaults to 'master')

To view your current config:

```bash
contentful-loc config:show
```

### Obtaining a Contentful API Token

1. Log in to your Contentful account at https://contentful.ccpgames.com
2. Go to **Account Settings > CMA Tokens**
3. Click **"Generate personal access token"**
4. Give your token a name (e.g., "Localization Tool")
5. Click **"Generate token"**
6. Copy the generated token (starts with "CFPAT-")
7. Use this token when running `contentful-loc config`

## Usage

### Export Content

**Interactive Mode** (Recommended):
```bash
contentful-loc export
```
This will show a list of supported content types and entries with their IDs, English titles, and last updated dates for easy selection.

**Direct Export**:
```bash
contentful-loc export --type storeOffer
```
or
```bash
contentful-loc export --type storeOffer --id <entry-id>
```

**Available Options**:
- `-t, --type <type>` - Content type to export (optional)
- `-i, --id <id>` - Specific entry ID (optional, triggers interactive mode if omitted)

### Export Features

- **Automatic Reference Resolution** - Nested references are automatically fetched and included
- **Rate Limiting** - 150ms delays between API calls to prevent rate limit errors
- **Smart Filenames** - Files named as `contentType-english-title-entryId.json`
- **Sorted Results** - Entries displayed by last updated date (newest first)
- **Progress Indicators** - Visual feedback during export process

### Import Translations

```bash
contentful-loc import -f <json-file>
```

## Content Type Support

Currently supported content types with full nested reference resolution:

- **Store Offer** (`storeOffer`)
  - **Store Offer Details** (`storeOfferDetails`)
  - **Store Offer Section** (`storeOfferSection`)
  - **Store Offer Item** (`storeOfferItem`)
- **Resource Set** (`resourceSet`)
  - **Resource** (`resource`)

Each content type supports:
- Multi-language fields (en, de, es, fr, ja, ko, ru, zh)
- Rich text content conversion to Markdown
- Nested reference resolution
- Localized reference fields

## Development

### Project Structure

```
contentful-loc-tool/
├── src/
│   ├── cli/
│   │   ├── commands/    # CLI command implementations
│   │   └── index.js     # CLI entry point
│   ├── config/          # Contentful configuration
│   ├── models/          # Content type definitions
│   ├── services/        # Core services (RichText, etc.)
│   └── utils/           # Helper functions
├── tests/
│   ├── commands/        # Command tests
│   ├── models/          # Model tests
│   ├── services/        # Service tests
│   └── integration/     # Integration tests
└── jest.config.js       # Test configuration
```

### Running Tests

```bash
npm test                 # Run all tests
npm test -- --coverage  # Run with coverage report
npm test -- --watch     # Run in watch mode
```

## Troubleshooting

### Common Issues

- **Rate Limiting**: The tool automatically handles rate limiting with 150ms delays between requests
- **Missing References**: Check that referenced entries exist in the specified environment
- **Authentication**: Run `contentful-loc config` to update credentials if you get 401 errors

