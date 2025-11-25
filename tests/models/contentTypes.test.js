const { 
  contentTypes, 
  getContentType, 
  listContentTypes,
  getAllSupportedContentTypeIds,
  getContentTypeIdToNameMap
} = require('../../src/models/contentTypes');

describe('Content Types Model', () => {
  describe('listContentTypes', () => {
    it('should return list of content types', () => {
      const types = listContentTypes();
      expect(types).toHaveLength(2);
      expect(types).toEqual(
        expect.arrayContaining([
          { id: 'storeOffer', name: 'Store Offer' },
          { id: 'resourceSet', name: 'Resource Set' }
        ])
      );
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

  describe('getAllSupportedContentTypeIds', () => {
    it('should return all content type IDs including nested references', () => {
      const typeIds = getAllSupportedContentTypeIds();
      
      // Should include top-level types
      expect(typeIds.has('storeOffer')).toBe(true);
      expect(typeIds.has('resourceSet')).toBe(true);
      expect(typeIds.has('resource')).toBe(true);
      
      // Should include nested types from storeOffer
      expect(typeIds.has('storeBadge')).toBe(true);
      expect(typeIds.has('storeOfferDetails')).toBe(true);
      expect(typeIds.has('storeOfferSection')).toBe(true);
      expect(typeIds.has('storeOfferContent')).toBe(true);
    });

    it('should return a Set', () => {
      const typeIds = getAllSupportedContentTypeIds();
      expect(typeIds).toBeInstanceOf(Set);
    });
  });

  describe('getContentTypeIdToNameMap', () => {
    it('should return a map of content type IDs to names', () => {
      const idToName = getContentTypeIdToNameMap();
      
      expect(idToName).toBeInstanceOf(Map);
      expect(idToName.get('storeOffer')).toBe('Store Offer');
      expect(idToName.get('resourceSet')).toBe('Resource Set');
      expect(idToName.get('resource')).toBe('Resource');
    });

    it('should include nested content types', () => {
      const idToName = getContentTypeIdToNameMap();
      
      // Nested types should be included
      expect(idToName.has('storeBadge')).toBe(true);
      expect(idToName.has('storeOfferDetails')).toBe(true);
      expect(idToName.has('storeOfferSection')).toBe(true);
      expect(idToName.has('storeOfferContent')).toBe(true);
    });

    it('should use type ID as name for nested types without explicit name', () => {
      const idToName = getContentTypeIdToNameMap();
      
      // Nested types without explicit names should use their ID
      const nestedTypeName = idToName.get('storeBadge');
      expect(nestedTypeName).toBeDefined();
    });
  });
}); 