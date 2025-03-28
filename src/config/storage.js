const Conf = require('conf');

const config = new Conf({
  projectName: 'contentful-loc-tool',
  defaults: {
    spaceId: '7lhcm73ukv5p',
    accessToken: null,
    lastUsedContentType: null
  }
});

module.exports = config; 