const contentful = require('contentful-management');
const config = require('./storage');

const DEFAULT_ENVIRONMENT = 'master';

function createClient() {
  const accessToken = config.get('accessToken');
  if (!accessToken) {
    throw new Error('Contentful access token not found. Please set it using the config command.');
  }

  return contentful.createClient({
    accessToken,
  });
}

async function getEnvironment(environmentId = null) {
  const client = createClient();
  const spaceId = config.get('spaceId');
  if (!spaceId) {
    throw new Error('Contentful space ID not found. Please set it using the config command.');
  }

  const space = await client.getSpace(spaceId);
  const envId = environmentId || config.get('environmentId') || DEFAULT_ENVIRONMENT;
  
  try {
    return await space.getEnvironment(envId);
  } catch (error) {
    if (error.name === 'NotFound') {
      throw new Error(`Environment '${envId}' not found. Please check your environment ID.`);
    }
    throw error;
  }
}

module.exports = {
  createClient,
  getEnvironment,
  getSpaceId: () => config.get('spaceId'),
  getAccessToken: () => config.get('accessToken'),
  getEnvironmentId: () => config.get('environmentId') || DEFAULT_ENVIRONMENT,
  setAccessToken: (token) => config.set('accessToken', token),
  setSpaceId: (id) => config.set('spaceId', id),
  setEnvironmentId: (id) => config.set('environmentId', id),
  setLastUsedContentType: (type) => config.set('lastUsedContentType', type),
  getLastUsedContentType: () => config.get('lastUsedContentType'),
}; 