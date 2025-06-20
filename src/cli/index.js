#!/usr/bin/env node
const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const contentfulConfig = require('../config/contentful');
const { listContentTypes } = require('../models/contentTypes');

program
  .name('contentful-loc')
  .description('Contentful localization tool')
  .version('1.0.0');

program
  .command('config')
  .description('Configure the tool')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'accessToken',
        message: 'Enter your Contentful Management API token:',
        validate: input => input.length > 0 || 'Token is required'
      },
      {
        type: 'input',
        name: 'spaceId',
        message: 'Enter your Contentful Space ID:',
        validate: input => input.length > 0 || 'Space ID is required'
      },
      {
        type: 'input',
        name: 'environmentId',
        message: 'Enter your Contentful Environment ID (default: master):',
        default: 'master'
      }
    ]);

    contentfulConfig.setAccessToken(answers.accessToken);
    contentfulConfig.setSpaceId(answers.spaceId);
    contentfulConfig.setEnvironmentId(answers.environmentId);
    
    console.log(chalk.green('Configuration saved successfully!'));
    console.log(chalk.blue('Current configuration:'));
    console.log(chalk.blue(`- Space ID: ${answers.spaceId}`));
    console.log(chalk.blue(`- Environment: ${answers.environmentId}`));
  });

program
  .command('config:show')
  .description('Show current configuration')
  .action(() => {
    const allConfig = contentfulConfig.getAllConfig();
    
    if (Object.keys(allConfig).length === 0) {
      console.log(chalk.yellow('No configuration found. Run "contentful-loc config" to set up your configuration.'));
      return;
    }
    
    console.log(chalk.blue('Current configuration:'));
    console.log(chalk.blue('==================='));
    
    Object.keys(allConfig).forEach(key => {
      const value = allConfig[key];
      if (key === 'accessToken' && value) {
        // Mask the access token for security
        const maskedToken = value.substring(0, 8) + '...' + value.substring(value.length - 4);
        console.log(chalk.white(`${key}: ${maskedToken}`));
      } else {
        console.log(chalk.white(`${key}: ${value || '(not set)'}`));
      }
    });
  });

program
  .command('export')
  .description('Export content for translation')
  .option('-t, --type <type>', 'Content type to export')
  .option('-i, --id <id>', 'Specific entry ID to export')
  .action(async (options) => {
    try {
      // If no content type specified, show list
      if (!options.type) {
        const types = listContentTypes();
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'contentType',
            message: 'Select content type to export:',
            choices: types.map(t => ({ name: t.name, value: t.id })),
            loop: false
          }
        ]);
        options.type = answer.contentType;
      }

      // Import and run the export command
      const { exportCommand } = require('./commands/export');
      await exportCommand(options);
    } catch (error) {
      console.error(chalk.red('Export failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('Import translations')
  .requiredOption('-f, --file <file>', 'Translation JSON file')
  .action(async (options) => {
    try {
      // Import and run the import command
      const { importCommand } = require('./commands/import');
      await importCommand(options);
    } catch (error) {
      console.error(chalk.red('Import failed:'), error.message);
      process.exit(1);
    }
  });

// Error on unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command'));
  console.log('Run --help for a list of available commands.');
  process.exit(1);
});

program.parse(); 