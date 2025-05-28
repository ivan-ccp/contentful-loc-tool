/**
 * Helper function to create a mock Contentful entry
 * @param {string} id - Entry ID
 * @param {string} contentTypeId - Content Type ID
 * @param {Object} fields - Entry fields
 * @returns {Object} Mock Contentful entry
 */
const createMockEntry = (id, contentTypeId, fields) => ({
  sys: {
    id,
    type: 'Entry',
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: contentTypeId
      }
    }
  },
  fields
});

/**
 * Helper function to create a mock Contentful content type
 * @param {string} id - Content Type ID
 * @param {string} name - Content Type name
 * @param {string} displayField - Display field name
 * @param {Array} fields - Content Type fields
 * @returns {Object} Mock Contentful content type
 */
const createMockContentType = (id, name, displayField, fields = []) => ({
  sys: {
    id,
    type: 'ContentType'
  },
  name,
  displayField,
  fields
});

/**
 * Helper function to mock console methods
 * @returns {Object} Object with original console methods and restore function
 */
const mockConsole = () => {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();

  return {
    originalConsole,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    }
  };
};

module.exports = {
  createMockEntry,
  createMockContentType,
  mockConsole
}; 