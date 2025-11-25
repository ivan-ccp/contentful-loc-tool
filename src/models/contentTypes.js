const contentTypes = {
  storeOffer: {
    id: 'storeOffer',
    name: 'Store Offer',
    fields: ['title', 'description', 'badge', 'offerDetail'],
    references: {
      badge: {
        type: 'storeBadge',
        fields: ['text']
      },
      offerDetail: {
        type: 'storeOfferDetails',
        fields: ['title', 'description', 'sections'],
        references: {
          sections: {
            type: 'storeOfferSection',
            fields: ['title', 'description', 'items'],
            references: {
              items: {
                type: 'storeOfferContent',
                fields: ['title', 'description']
              }
            }
          }
        }
      }
    }
  },
  // resource type is kept for internal reference, but not exported in listContentTypes
  resource: {
    id: 'resource',
    name: 'Resource',
    fields: ['val']
  },
  resourceSet: {
    id: 'resourceSet',
    name: 'Resource Set',
    fields: ['resources'],
    references: {
      resources: {
        type: 'resource',
        fields: ['val']
      }
    }
  },
  textBlock: {
    id: 'textBlock',
    name: 'Text Block',
    fields: ['title', 'text'],
    richTextFields: ['text']
  }
  // Add more content types here as needed
};

function getContentType(id) {
  return contentTypes[id];
}

function listContentTypes() {
  // Only return types that should be user-selectable (exclude 'resource')
  return Object.values(contentTypes)
    .filter(({ id }) => id !== 'resource')
    .map(({ id, name }) => ({ id, name }));
}

/**
 * Recursively extract all content type IDs from the model, including nested references
 * @param {Object} typeConfig - Content type configuration object
 * @param {Set} typeIds - Set to collect type IDs
 */
function extractContentTypeIds(typeConfig, typeIds = new Set()) {
  if (!typeConfig) return typeIds;
  
  // Add the current type ID
  if (typeConfig.id) {
    typeIds.add(typeConfig.id);
  }
  
  // Recursively process references
  if (typeConfig.references) {
    for (const refConfig of Object.values(typeConfig.references)) {
      if (refConfig.type) {
        typeIds.add(refConfig.type);
      }
      // Recursively process nested references
      extractContentTypeIds(refConfig, typeIds);
    }
  }
  
  return typeIds;
}

/**
 * Get all supported content type IDs including nested references
 * @returns {Set<string>} Set of all supported content type IDs
 */
function getAllSupportedContentTypeIds() {
  const typeIds = new Set();
  
  // Process all top-level content types
  for (const typeConfig of Object.values(contentTypes)) {
    extractContentTypeIds(typeConfig, typeIds);
  }
  
  return typeIds;
}

/**
 * Build a map of content type IDs to their display names
 * Includes nested types with best available name
 * @returns {Map<string, string>} Map of content type ID to name
 */
function getContentTypeIdToNameMap() {
  const idToName = new Map();
  
  // First, add all top-level content types
  for (const typeConfig of Object.values(contentTypes)) {
    if (typeConfig.id && typeConfig.name) {
      idToName.set(typeConfig.id, typeConfig.name);
    }
    
    // Recursively add nested types
    function addNestedTypes(refConfig) {
      if (refConfig.type) {
        // Use the type ID as name if we don't have a better name
        if (!idToName.has(refConfig.type)) {
          // Try to find a better name by looking for a content type with this ID
          const foundType = Object.values(contentTypes).find(t => t.id === refConfig.type);
          idToName.set(refConfig.type, foundType?.name || refConfig.type);
        }
      }
      
      if (refConfig.references) {
        for (const nestedRef of Object.values(refConfig.references)) {
          addNestedTypes(nestedRef);
        }
      }
    }
    
    if (typeConfig.references) {
      for (const refConfig of Object.values(typeConfig.references)) {
        addNestedTypes(refConfig);
      }
    }
  }
  
  return idToName;
}

module.exports = {
  contentTypes,
  getContentType,
  listContentTypes,
  getAllSupportedContentTypeIds,
  getContentTypeIdToNameMap
}; 