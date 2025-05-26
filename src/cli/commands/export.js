const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const RichTextService = require('../../services/richText');

// Rate limiting utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 150; // 150ms between requests (6.67 requests/second, safely under 7/second limit)

async function rateLimitedRequest(requestFn) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await delay(waitTime);
  }
  
  lastRequestTime = Date.now();
  return await requestFn();
}

async function fetchEntryWithReferences(environment, entryId, contentType) {
  const entry = await rateLimitedRequest(() => environment.getEntry(entryId));

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
          const localizedField = fields[refField];
          const result_refs = {};
          
          // Handle localized reference fields
          for (const [locale, refValue] of Object.entries(localizedField)) {
            if (refValue && refValue.sys && refValue.sys.type === 'Link' && refValue.sys.linkType === 'Entry') {
              try {
                const refEntry = await rateLimitedRequest(() => environment.getEntry(refValue.sys.id));
                if (refEntry.sys.contentType.sys.id === refConfig.type) {
                  const refResult = {
                    id: refEntry.sys.id,
                    ...await extractTextFields(refEntry.fields, refConfig)
                  };
                  result_refs[locale] = refResult;
                } else {
                  result_refs[locale] = null;
                }
              } catch (error) {
                console.warn(`Failed to fetch reference ${refValue.sys.id}:`, error.message);
                result_refs[locale] = null;
              }
            } else if (Array.isArray(refValue)) {
              // Handle array of references
              const resolvedRefs = [];
              for (const ref of refValue) {
                if (ref && ref.sys && ref.sys.type === 'Link' && ref.sys.linkType === 'Entry') {
                  try {
                    const refEntry = await rateLimitedRequest(() => environment.getEntry(ref.sys.id));
                    if (refEntry.sys.contentType.sys.id === refConfig.type) {
                      const resolvedRef = {
                        id: refEntry.sys.id,
                        ...await extractTextFields(refEntry.fields, refConfig)
                      };
                      resolvedRefs.push(resolvedRef);
                    }
                  } catch (error) {
                    console.warn(`Failed to fetch reference ${ref.sys.id}:`, error.message);
                  }
                }
              }
              result_refs[locale] = resolvedRefs;
            } else {
              result_refs[locale] = null;
            }
          }
          
          result[refField] = result_refs;
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
  // Dynamic import for ora (ES module)
  const { default: ora } = await import('ora');
  const inquirer = require('inquirer');
  const spinner = ora('Initializing...').start();

  try {
    const contentType = getContentType(options.type);
    if (!contentType) {
      throw new Error(`Unknown content type: ${options.type}`);
    }

    spinner.text = 'Connecting to Contentful...';
    const environment = await contentfulConfig.getEnvironment();

    let entryId = options.id;

    // If no entry ID provided, show interactive selection
    if (!entryId) {
      spinner.text = `Fetching ${contentType.name} entries for selection...`;
      const entries = await rateLimitedRequest(() => environment.getEntries({
        content_type: contentType.id,
        limit: 100 // Limit to 100 entries for reasonable performance
      }));

      if (entries.items.length === 0) {
        spinner.fail(chalk.red(`No ${contentType.name} entries found`));
        return;
      }

      spinner.stop();

      // Create choices with ID and English title
      const choices = entries.items.map(entry => {
        const englishTitle = entry.fields.title?.en || entry.fields.name?.en || 'No title';
        return {
          name: `${entry.sys.id} - ${englishTitle}`,
          value: entry.sys.id
        };
      });

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'entryId',
          message: `Select a ${contentType.name} entry to export:`,
          choices: choices,
          pageSize: 15
        }
      ]);

      entryId = answer.entryId;
      spinner.start();
    }

    // Export single entry
    spinner.text = `Fetching entry ${entryId}...`;
    const data = await fetchEntryWithReferences(environment, entryId, contentType);
    
    // Generate filename using English title if available
    let filename = `${contentType.id}-${entryId}`;
    if (data.fields.title && data.fields.title.en) {
      const englishTitle = data.fields.title.en
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      if (englishTitle) {
        filename = `${contentType.id}-${englishTitle}-${entryId}`;
      }
    }
    
    // Save to file
    const outputFile = path.join(process.cwd(), `${filename}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    
    spinner.succeed(chalk.green(`Entry exported to ${outputFile}`));
  } catch (error) {
    spinner.fail(chalk.red('Export failed'));
    throw error;
  }
}

module.exports = {
  exportCommand
}; 