const { contentTypes, getContentType, listContentTypes } = require('../../src/models/contentTypes');

describe('Content Types Model', () => {
  describe('listContentTypes', () => {
    it('should return list of content types', () => {
      const types = listContentTypes();
      expect(types).toHaveLength(2);
      expect(types).toContainEqual({ id: 'storeOffer', name: 'Store Offer' });
      expect(types).toContainEqual({ id: 'resourceSet', name: 'Resource Set' });
    });
  });

  describe('getContentType', () => {
    it('should return content type by id', () => {
      const type = getContentType('storeOffer');
      expect(type).toEqual(contentTypes.storeOffer);
    });

    it('should return resourceSet content type by id', () => {
      const type = getContentType('resourceSet');
      expect(type).toEqual(contentTypes.resourceSet);
    });

    it('should return undefined for non-existent content type', () => {
      const type = getContentType('nonExistent');
      expect(type).toBeUndefined();
    });
  });
}); 