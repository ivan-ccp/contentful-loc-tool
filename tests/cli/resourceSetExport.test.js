const RichTextService = require('../../src/services/richText');
const he = require('he');

// Mock Contentful environment and data
const mockResourceEntry = {
  sys: { id: 'resource1', contentType: { sys: { id: 'resource' } } },
  fields: {
    val: {
      en: "There's no PLEX in your vault."
    }
  }
};

const mockResourceSetEntry = {
  sys: { id: 'set1', contentType: { sys: { id: 'resourceSet' } } },
  fields: {
    resources: {
      en: [
        { sys: { type: 'Link', linkType: 'Entry', id: 'resource1' } }
      ]
    }
  }
};

const mockEnvironment = {
  getEntry: jest.fn((id) => {
    if (id === 'resource1') return Promise.resolve(mockResourceEntry);
    if (id === 'set1') return Promise.resolve(mockResourceSetEntry);
    throw new Error('Not found');
  })
};

const SUPPORTED_LANGUAGES = ['en'];

const { contentTypes } = require('../../src/models/contentTypes');

// Import the export logic from shared utilities
const { extractTextFields } = require('../../src/utils/contentfulHelpers');

describe('resourceSet export', () => {
  it('exports resource markdown field and decodes apostrophes', async () => {
    const result = await extractTextFields(mockResourceSetEntry.fields, contentTypes.resourceSet, mockEnvironment, {
      includeAllLanguages: true,
      decodeHtml: true
    });
    const exportedValue = result.resources.en[0].val.en;
    expect(exportedValue).toBe("There's no PLEX in your vault.");
    // Ensure apostrophe is not encoded
    expect(exportedValue).not.toContain('&#39;');
  });
}); 