const Conf = require('conf');

const config = new Conf({
  projectName: 'contentful-loc-tool',
  defaults: {
    spaceId: null,
    accessToken: null,
    lastUsedContentType: null
  }
});

module.exports = config; 