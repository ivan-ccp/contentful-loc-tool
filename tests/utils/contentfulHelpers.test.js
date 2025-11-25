const { createMockEntry } = require('../utils/testHelpers');

// Mock the rateLimitedRequest function
const mockRateLimitedRequest = jest.fn((fn) => Promise.resolve(fn()));

jest.mock('../../src/utils/contentfulHelpers', () => {
  const original = jest.requireActual('../../src/utils/contentfulHelpers');
  // Replace rateLimitedRequest with our mock
  const helpers = { ...original };
  helpers.rateLimitedRequest = mockRateLimitedRequest;
  return helpers;
});

const {
  getTagIdByName,
  fetchEntriesByTag,
  removeTagFromEntry
} = require('../../src/utils/contentfulHelpers');

describe('Contentful Helpers - Tag Functions', () => {
  let mockEnvironment;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvironment = {
      getTags: jest.fn(),
      getEntries: jest.fn(),
      getEntry: jest.fn()
    };
  });

  describe('getTagIdByName', () => {
    it('should find tag by exact ID match', async () => {
      const mockTags = {
        items: [
          { sys: { id: 'toLocalize' }, name: 'To Localize' },
          { sys: { id: 'otherTag' }, name: 'Other Tag' }
        ]
      };
      mockEnvironment.getTags.mockResolvedValue(mockTags);

      const tagId = await getTagIdByName(mockEnvironment, 'toLocalize');
      expect(tagId).toBe('toLocalize');
    });

    it('should find tag by case-insensitive name match', async () => {
      const mockTags = {
        items: [
          { sys: { id: 'toLocalize' }, name: 'To Localize' },
          { sys: { id: 'otherTag' }, name: 'Other Tag' }
        ]
      };
      mockEnvironment.getTags.mockResolvedValue(mockTags);

      const tagId = await getTagIdByName(mockEnvironment, 'to localize');
      expect(tagId).toBe('toLocalize');
    });

    it('should find tag ignoring spaces in name', async () => {
      const mockTags = {
        items: [
          { sys: { id: 'toLocalize' }, name: 'To Localize' }
        ]
      };
      mockEnvironment.getTags.mockResolvedValue(mockTags);

      const tagId = await getTagIdByName(mockEnvironment, 'tolocalize');
      expect(tagId).toBe('toLocalize');
    });

    it('should return null if tag not found', async () => {
      const mockTags = {
        items: [
          { sys: { id: 'otherTag' }, name: 'Other Tag' }
        ]
      };
      mockEnvironment.getTags.mockResolvedValue(mockTags);

      const tagId = await getTagIdByName(mockEnvironment, 'nonExistent');
      expect(tagId).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockEnvironment.getTags.mockRejectedValue(new Error('API Error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const tagId = await getTagIdByName(mockEnvironment, 'test');
      
      expect(tagId).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchEntriesByTag', () => {
    const mockContentTypesModel = {
      getAllSupportedContentTypeIds: jest.fn(() => new Set(['resource', 'resourceSet', 'storeOffer'])),
      getContentTypeIdToNameMap: jest.fn(() => {
        const map = new Map();
        map.set('resource', 'Resource');
        map.set('resourceSet', 'Resource Set');
        map.set('storeOffer', 'Store Offer');
        return map;
      }),
      getContentType: jest.fn((id) => {
        if (id === 'resource') return { id: 'resource', name: 'Resource' };
        if (id === 'resourceSet') return { id: 'resourceSet', name: 'Resource Set' };
        return undefined;
      })
    };

    it('should fetch entries with the specified tag', async () => {
      const mockTagId = 'toLocalize';
      const mockEntries = {
        items: [
          createMockEntry('entry1', 'resource', { val: { en: 'Test' } }),
          createMockEntry('entry2', 'resourceSet', { resources: { en: [] } })
        ],
        total: 2
      };

      // Mock getTags to return the tag
      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: mockTagId }, name: 'To Localize' }]
      });

      // Mock getEntries to return tagged entries
      mockEnvironment.getEntries.mockResolvedValue(mockEntries);

      const result = await fetchEntriesByTag(mockEnvironment, 'toLocalize', mockContentTypesModel);

      expect(result).toHaveLength(2);
      expect(result[0].entry.sys.id).toBe('entry1');
      expect(result[0].contentType.id).toBe('resource');
      expect(result[1].entry.sys.id).toBe('entry2');
      expect(result[1].contentType.id).toBe('resourceSet');
    });

    it('should filter entries to only supported content types', async () => {
      const mockTagId = 'toLocalize';
      const mockEntries = {
        items: [
          createMockEntry('entry1', 'resource', { val: { en: 'Test' } }),
          createMockEntry('entry2', 'unsupportedType', { field: { en: 'Test' } })
        ],
        total: 2
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: mockTagId }, name: 'To Localize' }]
      });
      mockEnvironment.getEntries.mockResolvedValue(mockEntries);

      const result = await fetchEntriesByTag(mockEnvironment, 'toLocalize', mockContentTypesModel);

      expect(result).toHaveLength(1);
      expect(result[0].entry.sys.id).toBe('entry1');
    });

    it('should return empty array if tag not found', async () => {
      mockEnvironment.getTags.mockResolvedValue({
        items: []
      });

      const result = await fetchEntriesByTag(mockEnvironment, 'nonExistent', mockContentTypesModel);
      expect(result).toEqual([]);
    });

    it('should handle pagination', async () => {
      const mockTagId = 'toLocalize';
      const firstPage = {
        items: Array.from({ length: 1000 }, (_, i) => 
          createMockEntry(`entry${i}`, 'resource', { val: { en: 'Test' } })
        ),
        total: 1500
      };
      const secondPage = {
        items: Array.from({ length: 500 }, (_, i) => 
          createMockEntry(`entry${1000 + i}`, 'resource', { val: { en: 'Test' } })
        ),
        total: 1500
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: mockTagId }, name: 'To Localize' }]
      });
      mockEnvironment.getEntries
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      const result = await fetchEntriesByTag(mockEnvironment, 'toLocalize', mockContentTypesModel);

      expect(result).toHaveLength(1500);
      expect(mockEnvironment.getEntries).toHaveBeenCalledTimes(2);
    });

    it('should create minimal config for nested content types', async () => {
      const mockTagId = 'toLocalize';
      const mockEntries = {
        items: [
          createMockEntry('entry1', 'storeOfferContent', { title: { en: 'Test' } })
        ],
        total: 1
      };

      const mockModelWithNested = {
        getAllSupportedContentTypeIds: jest.fn(() => new Set(['storeOfferContent'])),
        getContentTypeIdToNameMap: jest.fn(() => {
          const map = new Map();
          map.set('storeOfferContent', 'Store Offer Content');
          return map;
        }),
        getContentType: jest.fn(() => undefined) // Nested type not in top-level
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: mockTagId }, name: 'To Localize' }]
      });
      mockEnvironment.getEntries.mockResolvedValue(mockEntries);

      const result = await fetchEntriesByTag(mockEnvironment, 'toLocalize', mockModelWithNested);

      expect(result).toHaveLength(1);
      expect(result[0].contentType.id).toBe('storeOfferContent');
      expect(result[0].contentType.name).toBe('Store Offer Content');
    });
  });

  describe('removeTagFromEntry', () => {
    it('should remove tag from entry while preserving other tags', async () => {
      const entryId = 'entry1';
      const tagToRemove = 'toLocalize';
      const tagToKeep = 'otherTag';

      const mockEntry = {
        sys: { id: entryId },
        metadata: {
          tags: [
            { sys: { id: tagToRemove } },
            { sys: { id: tagToKeep } }
          ]
        },
        update: jest.fn().mockResolvedValue({})
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [
          { sys: { id: tagToRemove }, name: 'To Localize' },
          { sys: { id: tagToKeep }, name: 'Other Tag' }
        ]
      });
      mockEnvironment.getEntry.mockResolvedValue(mockEntry);

      const result = await removeTagFromEntry(mockEnvironment, entryId, tagToRemove);

      expect(result).toBe(true);
      expect(mockEntry.metadata.tags).toHaveLength(1);
      expect(mockEntry.metadata.tags[0].sys.id).toBe(tagToKeep);
      expect(mockEntry.update).toHaveBeenCalled();
    });

    it('should return false if tag not found', async () => {
      const entryId = 'entry1';
      const tagToRemove = 'nonExistent';

      const mockEntry = {
        sys: { id: entryId },
        metadata: {
          tags: [{ sys: { id: 'otherTag' } }]
        }
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: 'otherTag' }, name: 'Other Tag' }]
      });
      mockEnvironment.getEntry.mockResolvedValue(mockEntry);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await removeTagFromEntry(mockEnvironment, entryId, tagToRemove);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return false if tag already not present', async () => {
      const entryId = 'entry1';
      const tagToRemove = 'toLocalize';

      const mockEntry = {
        sys: { id: entryId },
        metadata: {
          tags: [{ sys: { id: 'otherTag' } }]
        },
        update: jest.fn().mockResolvedValue({})
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [
          { sys: { id: tagToRemove }, name: 'To Localize' },
          { sys: { id: 'otherTag' }, name: 'Other Tag' }
        ]
      });
      mockEnvironment.getEntry.mockResolvedValue(mockEntry);

      const result = await removeTagFromEntry(mockEnvironment, entryId, tagToRemove);

      expect(result).toBe(false);
      expect(mockEntry.update).not.toHaveBeenCalled();
    });

    it('should handle entry with no tags', async () => {
      const entryId = 'entry1';
      const tagToRemove = 'toLocalize';

      const mockEntry = {
        sys: { id: entryId },
        metadata: {
          tags: []
        }
      };

      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: tagToRemove }, name: 'To Localize' }]
      });
      mockEnvironment.getEntry.mockResolvedValue(mockEntry);

      const result = await removeTagFromEntry(mockEnvironment, entryId, tagToRemove);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const entryId = 'entry1';
      const tagToRemove = 'toLocalize';

      mockEnvironment.getTags.mockResolvedValue({
        items: [{ sys: { id: tagToRemove }, name: 'To Localize' }]
      });
      mockEnvironment.getEntry.mockRejectedValue(new Error('Entry not found'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await removeTagFromEntry(mockEnvironment, entryId, tagToRemove);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

