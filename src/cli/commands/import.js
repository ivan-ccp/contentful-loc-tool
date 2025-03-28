const fs = require('fs');
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const RichTextService = require('../../services/richText');

async function importCommand(options) {
  const spinner = ora('Initializing...').start();

  try {
    // Read and parse the translation file
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entries = Array.isArray(data) ? data : [data];
    
    spinner.text = 'Connecting to Contentful...';
    const client = contentfulConfig.createClient();
    const space = await client.getSpace(contentfulConfig.getSpaceId());
    const environment = await space.getEnvironment('master');

    // Process each entry
    for (const translatedEntry of entries) {
      spinner.text = `Processing entry ${translatedEntry.id}...`;
      
      const contentType = getContentType(translatedEntry.contentType);
      if (!contentType) {
        throw new Error(`Unknown content type: ${translatedEntry.contentType}`);
      }

      // Get the original entry to compare
      const entry = await environment.getEntry(translatedEntry.id);
      
      // Update fields based on content type definition
      const updateFields = async (fields, translatedFields, typeConfig) => {
        const updates = {};
        
        for (const fieldName of typeConfig.fields) {
          if (translatedFields[fieldName]) {
            if (fields[fieldName]?.nodeType === 'document') {
              // Handle Rich Text fields
              updates[fieldName] = await RichTextService.fromMarkdown(
                translatedFields[fieldName],
                fields[fieldName]
              );
            } else {
              updates[fieldName] = translatedFields[fieldName];
            }
          }
        }

        return updates;
      };

      // Update the entry's fields
      const updates = await updateFields(entry.fields, translatedEntry.fields, contentType);
      Object.assign(entry.fields, updates);

      // Save the changes
      await entry.update();
      await entry.publish();

      spinner.succeed(chalk.green(`Updated entry ${entry.sys.id}`));
    }

    spinner.succeed(chalk.green('Import completed successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Import failed'));
    throw error;
  }
}

module.exports = {
  importCommand
}; 