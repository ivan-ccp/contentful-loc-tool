# Contentful Localization Tool

A command-line tool for exporting Contentful entries for translation and importing them back with full support for nested references and rate limiting.

## Features

- **Interactive Entry Selection** - Browse and select entries with ID and English title display
- **Smart Export** - Export content with nested references resolved automatically
- **Rate Limiting** - Built-in API rate limiting to prevent Contentful API errors
- **Rich Text Support** - Convert Rich Text fields to Markdown for translation
- **Intelligent Filenames** - Generate kebab-case filenames using English titles
- **Sorted Listings** - Entries sorted by last updated date (newest first)
- **Multiple Content Types** - Support for complex nested content structures
- **Environment Support** - Work with different Contentful environments (dev, staging, production)
- **Comprehensive Testing** - Full test suite with unit and integration tests

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

### Obtaining a Contentful API Token

1. Log in to your Contentful account at https://app.contentful.com
2. Go to **Settings > API keys**
3. Click **"Generate personal token"**
4. Give your token a name (e.g., "Localization Tool")
5. Select the following permissions:
   - Content management
   - Content delivery
   - Content preview
6. Click **"Generate token"**
7. Copy the generated token (starts with "CFPAT-")
8. Use this token when running `contentful-loc config`

### Environment Support

The tool supports different Contentful environments:
- **`master`** - Production content
- **`dev`** - Development environment
- **Custom environments** - Any environment you've created

Change environments anytime with `contentful-loc config`.

**Security Notes**:
- Each user should generate their own API token
- Never share your API token
- Tokens are stored locally and not tracked in git
- Run `git clean -fd` before sharing projects

## Usage

### Export Content

**Interactive Mode** (Recommended):
```bash
contentful-loc export --type storeOffer
```
This will show a list of entries with their IDs, English titles, and last updated dates for easy selection.

**Direct Export**:
```bash
contentful-loc export --type storeOffer --id <entry-id>
```

**Available Options**:
- `-t, --type <type>` - Content type to export (required)
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
    - Supports exporting values from all child resource types

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
│   ├── integration/     # Integration tests
│   └── setup.js         # Test configuration
├── templates/           # Content templates
└── jest.config.js       # Test configuration
```

### Adding New Content Types

1. Edit `src/models/contentTypes.js`
2. Add your content type definition:

```javascript
{
  id: 'yourContentType',
  name: 'Your Content Type',
  fields: ['title', 'description'],
  references: {
    // Define reference fields if any
  }
}
```

### Running Tests

```bash
npm test                 # Run all tests
npm test -- --coverage  # Run with coverage report
npm test -- --watch     # Run in watch mode
```

### Test Coverage

The project includes comprehensive tests:
- **Unit Tests** - Individual component testing
- **Integration Tests** - End-to-end workflow testing
- **Mock Services** - Contentful API mocking
- **Error Handling** - Edge case and error scenario testing

### Rate Limiting

The tool implements proactive rate limiting:
- **150ms delays** between API requests
- **Sequential processing** for bulk operations
- **Automatic retry** logic for failed requests
- **Progress feedback** during long operations

## API Reference

### Export Command

```bash
contentful-loc export [options]
```

**Options:**
- `--type, -t <type>` - Content type to export
- `--id, -i <id>` - Entry ID (optional)

**Examples:**
```bash
# Interactive selection
contentful-loc export -t storeOffer

# Direct export
contentful-loc export -t storeOffer -i 5zKyaOq5qeOSezg5KQ8rSx

# Export with progress
contentful-loc export --type storeOffer --id abc123
```

### Configuration Command

```bash
contentful-loc config
```

Updates stored Contentful credentials and environment settings.

## Troubleshooting

### Rate Limiting Issues
- The tool automatically handles rate limiting
- If you see rate limit warnings, the tool will slow down automatically
- No manual intervention required

### Missing References
- Check that referenced entries exist in the specified environment
- Verify content type definitions match your Contentful schema
- Missing references are logged as warnings but don't stop the export

### Authentication Issues
- Regenerate your API token if you get 401 errors
- Ensure your token has the correct permissions
- Run `contentful-loc config` to update credentials

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT 