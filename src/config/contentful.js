const contentful = require('contentful-management');
const config = require('./storage');

function createClient() {
  const accessToken = config.get('accessToken');
  if (!accessToken) {
    throw new Error('Contentful access token not found. Please set it using the config command.');
  }

  return contentful.createClient({
    accessToken,
  });
}

module.exports = {
  createClient,
  getSpaceId: () => config.get('spaceId'),
  getAccessToken: () => config.get('accessToken'),
  setAccessToken: (token) => config.set('accessToken', token),
  setLastUsedContentType: (type) => config.set('lastUsedContentType', type),
  getLastUsedContentType: () => config.get('lastUsedContentType'),
}; 