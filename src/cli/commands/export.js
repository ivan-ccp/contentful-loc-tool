const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const { fetchEntryWithReferences, rateLimitedRequest } = require('../../utils/contentfulHelpers');

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
        limit: 100, // Limit to 100 entries for reasonable performance
        order: '-sys.updatedAt' // Sort by last updated date, newest first
      }));

      if (entries.items.length === 0) {
        spinner.fail(chalk.red(`No ${contentType.name} entries found`));
        return;
      }

      spinner.stop();

      // Create choices with ID and English title
      const choices = entries.items.map(entry => {
        const englishTitle = entry.fields.title?.en || entry.fields.name?.en || 'No title';
        const updatedDate = new Date(entry.sys.updatedAt).toLocaleDateString();
        return {
          name: `${entry.sys.id} - ${englishTitle} (updated: ${updatedDate})`,
          value: entry.sys.id
        };
      });

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'entryId',
          message: `Select a ${contentType.name} entry to export:`,
          choices: choices,
          pageSize: 15,
          loop: false
        }
      ]);

      entryId = answer.entryId;
      spinner.start();
    }

    // Export single entry
    spinner.text = `Fetching entry ${entryId}...`;
    const data = await fetchEntryWithReferences(environment, entryId, contentType, {
      includeAllLanguages: true,
      decodeHtml: true,
      useRateLimit: true
    });
    
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