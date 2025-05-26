# Contentful Localization Tool

A command-line tool for exporting Contentful entries for translation and importing them back.

## Features

- Export content from Contentful with support for nested references
- Convert Rich Text fields to Markdown for translation
- Import translated content back to Contentful
- Preserve embedded entries and assets in Rich Text fields
- Support for multiple content types
- Interactive CLI interface
- Development environment support

## Installation

```bash
npm install
```

## Configuration

Before using the tool, you need to configure your Contentful settings:

```bash
contentful-loc config
```

This will prompt you for:
- Contentful Management API token
- Space ID
- Environment ID (defaults to 'master')

### Obtaining a Contentful API Token

1. Log in to your Contentful account at https://app.contentful.com
2. Go to Settings > API keys
3. Click "Generate personal token"
4. Give your token a name (e.g., "Localization Tool")
5. Select the following permissions:
   - Content management
   - Content delivery
   - Content preview
6. Click "Generate token"
7. Copy the generated token (it starts with "CFPAT-")
8. Use this token when running the `contentful-loc config` command

### Development Environment

The tool supports working with different Contentful environments:
- Use `master` for production content
- Use separate environments (e.g., `dev`) for testing
- Environment ID can be changed at any time using `contentful-loc config`

**Important Security Notes**:
- Each user should generate their own API token
- Never share your API token with others
- The token will be stored locally on your machine in `node_modules/conf/config.json`
- This config file is NOT tracked in git to prevent accidental token sharing
- If you need to share the project, make sure to run `git clean -fd` to remove untracked files before pushing

## Usage

### Export Content

Export a specific entry:
```bash
contentful-loc export -t storeOffer -i <entry-id>
```

Export all entries of a type:
```bash
contentful-loc export -t storeOffer
```

Or use the interactive mode:
```bash
contentful-loc export
```

### Import Translations

Import translated content back to Contentful:
```bash
contentful-loc import -f <json-file>
```

## Content Type Support

Currently supported content types:
- Store Offer (`storeOffer`)
  - Store Badge (`storeBadge`)
  - Store Offer Detail (`storeOfferDetail`)
  - Store Offer Section (`storeOfferSection`)
  - Store Offer Content (`storeOfferContent`)

## Development

### Project Structure

```
contentful-loc-tool/
├── src/
│   ├── config/         # Configuration management
│   ├── models/         # Content type definitions
│   ├── services/       # Core functionality
│   ├── utils/          # Helper functions
│   └── cli/           # CLI interface
├── templates/          # Content type templates
└── tests/             # Test files
```

### Adding New Content Types

To add support for new content types, edit `src/models/contentTypes.js` and add your content type definition following the existing pattern.

### Running Tests

```bash
npm test
```

## License

MIT 