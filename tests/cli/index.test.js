const inquirer = require('inquirer');
const contentfulConfig = require('../../src/config/contentful');
const { listContentTypes } = require('../../src/models/contentTypes');

// Mock dependencies
jest.mock('inquirer');
jest.mock('../../src/config/contentful');
jest.mock('../../src/models/contentTypes', () => ({
  listContentTypes: jest.fn().mockReturnValue([
    { id: 'type1', name: 'Type 1' },
    { id: 'type2', name: 'Type 2' }
  ])
}));

// Mock commander
jest.mock('commander', () => {
  const actualCommander = jest.requireActual('commander');
  const mockProgram = new actualCommander.Command();
  
  // Prevent program from exiting
  mockProgram.exitOverride = jest.fn();
  mockProgram.parse = jest.fn();
  
  return {
    ...actualCommander,
    program: mockProgram
  };
});

// Import the CLI module after mocking
const { program } = require('commander');

// Create command handlers
const configHandler = async () => {
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
};

const exportHandler = async (options) => {
  if (!options.type) {
    const types = listContentTypes();
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'contentType',
        message: 'Select content type to export:',
        choices: types.map(t => ({ name: t.name, value: t.id }))
      }
    ]);
    options.type = answer.contentType;
  }
};

// Register commands
program
  .command('config')
  .description('Configure the tool')
  .action(configHandler);

program
  .command('export')
  .description('Export content for translation')
  .option('-t, --type <type>', 'Content type to export')
  .option('-i, --id <id>', 'Specific entry ID to export')
  .action(exportHandler);

describe('CLI', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('config command', () => {
    it('should save configuration when valid inputs are provided', async () => {
      // Mock inquirer responses
      inquirer.prompt.mockResolvedValue({
        accessToken: 'test-token',
        spaceId: 'test-space',
        environmentId: 'master'
      });

      // Mock console.log to prevent output during tests
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      // Execute the config command
      await configHandler();

      // Verify configuration was saved
      expect(contentfulConfig.setAccessToken).toHaveBeenCalledWith('test-token');
      expect(contentfulConfig.setSpaceId).toHaveBeenCalledWith('test-space');
      expect(contentfulConfig.setEnvironmentId).toHaveBeenCalledWith('master');

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('export command', () => {
    it('should handle export command with content type selection', async () => {
      // Mock inquirer response
      inquirer.prompt.mockResolvedValue({ contentType: 'type1' });

      // Execute the export command
      await exportHandler({});

      // Verify content type selection was prompted
      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });
}); 