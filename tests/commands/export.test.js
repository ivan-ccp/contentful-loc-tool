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

const { exportCommand } = require('../../src/cli/commands/export');
const contentfulConfig = require('../../src/config/contentful');
const { fetchEntriesByTag, fetchEntryWithReferences } = require('../../src/utils/contentfulHelpers');
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

describe('Export Command', () => {
  let mockEnvironment;
  let mockSpinner;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEnvironment = {
      getEntries: jest.fn(),
      getEntry: jest.fn()
    };

    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      text: '',
      succeed: jest.fn(),
      fail: jest.fn(),
      info: jest.fn(),
      stop: jest.fn()
    };

    contentfulConfig.getEnvironment.mockResolvedValue(mockEnvironment);
    
    // Mock contentTypesModel.getContentType
    contentTypesModel.getContentType.mockImplementation((id) => {
      if (id === 'resourceSet') {
        return { id: 'resourceSet', name: 'Resource Set', fields: ['resources'] };
      }
      if (id === 'resource') {
        return { id: 'resource', name: 'Resource', fields: ['val'] };
      }
      return undefined;
    });
    
    // Mock contentTypesModel.getAllSupportedContentTypeIds
    contentTypesModel.getAllSupportedContentTypeIds.mockReturnValue(
      new Set(['resource', 'resourceSet', 'textBlock'])
    );
    
    // Mock contentTypesModel.getContentTypeIdToNameMap
    contentTypesModel.getContentTypeIdToNameMap.mockReturnValue(
      new Map([
        ['resource', 'Resource'],
        ['resourceSet', 'Resource Set'],
        ['textBlock', 'Text Block']
      ])
    );
  });

  describe('Tag-based export', () => {
    it('should export all entries with tag to a single file', async () => {
      const mockTaggedEntries = [
        {
          entry: createMockEntry('entry1', 'resource', { val: { en: 'Test 1' } }),
          contentType: { id: 'resource', name: 'Resource' }
        },
        {
          entry: createMockEntry('entry2', 'resource', { val: { en: 'Test 2' } }),
          contentType: { id: 'resource', name: 'Resource' }
        }
      ];

      const mockExportedData = [
        { id: 'entry1', contentType: 'resource', fields: { val: { en: 'Test 1' } } },
        { id: 'entry2', contentType: 'resource', fields: { val: { en: 'Test 2' } } }
      ];

      fetchEntriesByTag.mockResolvedValue(mockTaggedEntries);
      fetchEntryWithReferences
        .mockResolvedValueOnce(mockExportedData[0])
        .mockResolvedValueOnce(mockExportedData[1]);

      const options = { selectionMode: 'tag' };
      await exportCommand(options);

      expect(fetchEntriesByTag).toHaveBeenCalledWith(
        mockEnvironment,
        'toLocalize',
        contentTypesModel
      );
      expect(fetchEntryWithReferences).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).toHaveBeenCalled();
      
      // Verify file was written with array of entries
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[1]).toContain('entry1');
      expect(writeCall[1]).toContain('entry2');
    });

    it('should handle no entries found with tag', async () => {
      fetchEntriesByTag.mockResolvedValue([]);

      const options = { selectionMode: 'tag' };
      await exportCommand(options);

      expect(fetchEntriesByTag).toHaveBeenCalled();
      expect(fetchEntryWithReferences).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should generate filename with timestamp for tag export', async () => {
      const mockTaggedEntries = [
        {
          entry: createMockEntry('entry1', 'resource', { val: { en: 'Test' } }),
          contentType: { id: 'resource', name: 'Resource' }
        }
      ];

      fetchEntriesByTag.mockResolvedValue(mockTaggedEntries);
      fetchEntryWithReferences.mockResolvedValue({
        id: 'entry1',
        contentType: 'resource',
        fields: { val: { en: 'Test' } }
      });

      const options = { selectionMode: 'tag' };
      await exportCommand(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const filename = fs.writeFileSync.mock.calls[0][0];
      expect(filename).toMatch(/exported-toLocalize-/);
      expect(filename).toMatch(/\.json$/);
    });
  });

  describe('Content type-based export', () => {
    it('should export single entry when ID is provided', async () => {
      const mockEntry = createMockEntry('entry1', 'resourceSet', {
        resources: { en: [] }
      });

      const mockExportedData = {
        id: 'entry1',
        contentType: 'resourceSet',
        fields: { resources: { en: [] } }
      };

      mockEnvironment.getEntry.mockResolvedValue(mockEntry);
      fetchEntryWithReferences.mockResolvedValue(mockExportedData);

      const options = { type: 'resourceSet', id: 'entry1' };
      await exportCommand(options);

      expect(fetchEntryWithReferences).toHaveBeenCalledWith(
        mockEnvironment,
        'entry1',
        expect.objectContaining({ id: 'resourceSet' }),
        expect.any(Object)
      );
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });
  });
});

