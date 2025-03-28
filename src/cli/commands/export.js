const fs = require('fs');
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const RichTextService = require('../../services/richText');

async function fetchEntryWithReferences(environment, entryId, contentType) {
  const entry = await environment.getEntry(entryId);

  // Ensure the content type matches
  if (entry.sys.contentType.sys.id !== contentType.id) {
    throw new Error(`Entry is not of content type '${contentType.id}'. Found: ${entry.sys.contentType.sys.id}`);
  }

  // Extract fields based on content type definition
  const extractTextFields = async (fields, typeConfig) => {
    const result = {};
    
    for (const fieldName of typeConfig.fields) {
      if (fields[fieldName]) {
        if (fields[fieldName].nodeType === 'document') {
          // Handle Rich Text fields
          result[fieldName] = await RichTextService.toMarkdown(fields[fieldName]);
        } else {
          result[fieldName] = fields[fieldName];
        }
      }
    }

    // Handle references
    if (typeConfig.references) {
      for (const [refField, refConfig] of Object.entries(typeConfig.references)) {
        if (fields[refField]) {
          const refs = Array.isArray(fields[refField]) ? fields[refField] : [fields[refField]];
          result[refField] = await Promise.all(
            refs.map(async (ref) => {
              if (ref.sys && ref.sys.type === 'Link' && ref.sys.linkType === 'Entry') {
                const refEntry = await environment.getEntry(ref.sys.id);
                if (refEntry.sys.contentType.sys.id === refConfig.type) {
                  const refResult = {
                    id: refEntry.sys.id,
                    ...await extractTextFields(refEntry.fields, refConfig)
                  };
                  return refResult;
                }
              }
              return null;
            })
          );
        }
      }
    }

    return result;
  };

  const structuredData = {
    id: entry.sys.id,
    contentType: entry.sys.contentType.sys.id,
    fields: await extractTextFields(entry.fields, contentType)
  };

  return structuredData;
}

async function exportCommand(options) {
  const spinner = ora('Initializing...').start();

  try {
    const contentType = getContentType(options.type);
    if (!contentType) {
      throw new Error(`Unknown content type: ${options.type}`);
    }

    spinner.text = 'Connecting to Contentful...';
    const client = contentfulConfig.createClient();
    const space = await client.getSpace(contentfulConfig.getSpaceId());
    const environment = await space.getEnvironment('master');

    if (options.id) {
      // Export single entry
      spinner.text = `Fetching entry ${options.id}...`;
      const data = await fetchEntryWithReferences(environment, options.id, contentType);
      
      // Save to file
      const outputFile = path.join(process.cwd(), `${contentType.id}-${options.id}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
      
      spinner.succeed(chalk.green(`Entry exported to ${outputFile}`));
    } else {
      // Export all entries of type
      spinner.text = `Fetching all ${contentType.name} entries...`;
      const entries = await environment.getEntries({
        content_type: contentType.id
      });

      const results = await Promise.all(
        entries.items.map(entry => 
          fetchEntryWithReferences(environment, entry.sys.id, contentType)
        )
      );

      // Save to file
      const outputFile = path.join(process.cwd(), `${contentType.id}-all.json`);
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      
      spinner.succeed(chalk.green(`${results.length} entries exported to ${outputFile}`));
    }
  } catch (error) {
    spinner.fail(chalk.red('Export failed'));
    throw error;
  }
}

module.exports = {
  exportCommand
}; 