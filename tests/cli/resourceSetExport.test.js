const RichTextService = require('../../src/services/richText');
const he = require('he');

// Mock Contentful environment and data
const mockResourceEntry = {
  sys: { id: 'resource1', contentType: { sys: { id: 'resource' } } },
  fields: {
    value: {
      en: {
        nodeType: 'document',
        data: {},
        content: [
          {
            nodeType: 'paragraph',
            data: {},
            content: [
              {
                nodeType: 'text',
                value: "There's no PLEX in your vault.",
                marks: [],
                data: {}
              }
            ]
          }
        ]
      }
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

// Import the export logic
const { extractTextFields } = require('../../src/cli/commands/export');

describe('resourceSet export', () => {
  it('converts resource rich text to markdown and decodes apostrophes', async () => {
    const result = await extractTextFields(mockResourceSetEntry.fields, contentTypes.resourceSet, mockEnvironment);
    const exportedValue = result.resources.en[0].value.en;
    expect(exportedValue).toBe("There's no PLEX in your vault.");
    // Ensure apostrophe is not encoded
    expect(exportedValue).not.toContain('&#39;');
  });
}); 