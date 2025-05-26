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
  }
  // Add more content types here as needed
};

function getContentType(id) {
  return contentTypes[id];
}

function listContentTypes() {
  return Object.values(contentTypes).map(({ id, name }) => ({ id, name }));
}

module.exports = {
  contentTypes,
  getContentType,
  listContentTypes
}; 