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
    fields: ['value'],
    richTextFields: ['value']
  },
  resourceSet: {
    id: 'resourceSet',
    name: 'Resource Set',
    fields: ['resources'],
    references: {
      resources: {
        type: 'resource',
        fields: ['value'],
        richTextFields: ['value']
      }
    }
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

module.exports = {
  contentTypes,
  getContentType,
  listContentTypes
}; 