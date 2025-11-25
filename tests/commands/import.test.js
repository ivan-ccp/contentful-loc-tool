// Mock conf module before storage is required
jest.mock('conf', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn()
  }));
});

const fs = require('fs');
const path = require('path');

const { importCommand } = require('../../src/cli/commands/import');
const contentfulConfig = require('../../src/config/contentful');
const { fetchEntryWithReferences, removeTagFromEntry } = require('../../src/utils/contentfulHelpers');
const contentTypesModel = require('../../src/models/contentTypes');
const { createMockEntry } = require('../utils/testHelpers');

// Mock dependencies
jest.mock('../../src/config/contentful');
jest.mock('../../src/utils/contentfulHelpers');
jest.mock('../../src/models/contentTypes');
jest.mock('fs');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn(() => ({
      text: '',
      succeed: jest.fn(),
      fail: jest.fn(),
      info: jest.fn(),
      stop: jest.fn()
    })),
    fail: jest.fn(),
    succeed: jest.fn()
  }));
});

describe('Import Command', () => {
  let mockEnvironment;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = {
      getEntry: jest.fn(),
      getEntries: jest.fn()
    };

    contentfulConfig.getEnvironment.mockResolvedValue(mockEnvironment);
    
    // Mock contentTypesModel.getContentType
    contentTypesModel.getContentType.mockImplementation((id) => {
      if (id === 'resource') {
        return { id: 'resource', name: 'Resource', fields: ['val'] };
      }
      return undefined;
    });
    
    // Mock fs.existsSync and readFileSync
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({
      id: 'entry1',
      contentType: 'resource',
      fields: { val: { en: 'English', de: 'German' } }
    }));
  });

  it('should remove tag after successful import', async () => {
    const mockCurrentEntry = {
      id: 'entry1',
      contentType: 'resource',
      fields: { val: { en: 'English' } }
    };

    const mockEntry = createMockEntry('entry1', 'resource', {
      val: { en: 'English', de: 'German' }
    });

    fetchEntryWithReferences.mockResolvedValue(mockCurrentEntry);
    mockEnvironment.getEntry.mockResolvedValue(mockEntry);
    removeTagFromEntry.mockResolvedValue(true);

    const options = { file: 'test.json' };
    await importCommand(options);

    expect(removeTagFromEntry).toHaveBeenCalledWith(
      mockEnvironment,
      'entry1',
      'toLocalize'
    );
  });

  it('should handle tag removal failure gracefully', async () => {
    const mockCurrentEntry = {
      id: 'entry1',
      contentType: 'resource',
      fields: { val: { en: 'English' } }
    };

    const mockEntry = createMockEntry('entry1', 'resource', {
      val: { en: 'English', de: 'German' }
    });

    fetchEntryWithReferences.mockResolvedValue(mockCurrentEntry);
    mockEnvironment.getEntry.mockResolvedValue(mockEntry);
    removeTagFromEntry.mockResolvedValue(false); // Tag removal failed

    const options = { file: 'test.json' };
    await importCommand(options);

    expect(removeTagFromEntry).toHaveBeenCalled();
  });

  it('should process multiple entries and remove tags from all', async () => {
    const mockData = [
      {
        id: 'entry1',
        contentType: 'resource',
        fields: { val: { en: 'English 1', de: 'German 1' } }
      },
      {
        id: 'entry2',
        contentType: 'resource',
        fields: { val: { en: 'English 2', de: 'German 2' } }
      }
    ];

    fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

    const mockCurrentEntries = [
      { id: 'entry1', contentType: 'resource', fields: { val: { en: 'English 1' } } },
      { id: 'entry2', contentType: 'resource', fields: { val: { en: 'English 2' } } }
    ];

    fetchEntryWithReferences
      .mockResolvedValueOnce(mockCurrentEntries[0])
      .mockResolvedValueOnce(mockCurrentEntries[1]);

    mockEnvironment.getEntry
      .mockResolvedValueOnce(createMockEntry('entry1', 'resource', {}))
      .mockResolvedValueOnce(createMockEntry('entry2', 'resource', {}));

    removeTagFromEntry
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const options = { file: 'test.json' };
    await importCommand(options);

    expect(removeTagFromEntry).toHaveBeenCalledTimes(2);
    expect(removeTagFromEntry).toHaveBeenCalledWith(mockEnvironment, 'entry1', 'toLocalize');
    expect(removeTagFromEntry).toHaveBeenCalledWith(mockEnvironment, 'entry2', 'toLocalize');
  });

  it('should handle file not found', async () => {
    fs.existsSync.mockReturnValue(false);

    const options = { file: 'nonexistent.json' };
    
    await expect(importCommand(options)).rejects.toThrow('File not found');
  });

  it('should handle invalid JSON', async () => {
    fs.readFileSync.mockReturnValue('invalid json');

    const options = { file: 'test.json' };
    
    await expect(importCommand(options)).rejects.toThrow();
  });
});

