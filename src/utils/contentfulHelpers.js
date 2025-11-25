const RichTextService = require('../services/richText');
const he = require('he');

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh'];

// Rate limiting utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 150; // 150ms between requests (6.67 requests/second, safely under 7/second limit)

async function rateLimitedRequest(requestFn) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await delay(waitTime);
  }
  
  lastRequestTime = Date.now();
  return await requestFn();
}

async function extractTextFields(fields, typeConfig, environment, options = {}) {
  const { includeAllLanguages = false, decodeHtml = false } = options;
  const result = {};
  
  for (const fieldName of typeConfig.fields) {
    if (fields[fieldName]) {
      if (fields[fieldName].nodeType === 'document' || typeConfig.richTextFields?.includes(fieldName)) {
        // Handle Rich Text fields
        const richTextResult = await RichTextService.toMarkdown(fields[fieldName]);
        
        if (includeAllLanguages) {
          // Ensure all languages are present and decode HTML entities
          result[fieldName] = {};
          SUPPORTED_LANGUAGES.forEach(lang => {
            result[fieldName][lang] = richTextResult[lang] ? 
              (decodeHtml ? he.decode(richTextResult[lang]) : richTextResult[lang]) : '';
          });
        } else {
          result[fieldName] = richTextResult;
        }
      } else {
        // Handle regular localized fields
        if (includeAllLanguages) {
          result[fieldName] = {};
          SUPPORTED_LANGUAGES.forEach(lang => {
            result[fieldName][lang] = fields[fieldName][lang] || '';
          });
        } else {
          result[fieldName] = fields[fieldName];
        }
      }
    }
  }

  // Handle references
  if (typeConfig.references) {
    for (const [refField, refConfig] of Object.entries(typeConfig.references)) {
      if (fields[refField]) {
        const localizedField = fields[refField];
        const result_refs = {};
        let hasAnyReferences = false;
        
        // Handle localized reference fields
        for (const [locale, refValue] of Object.entries(localizedField)) {
          if (refValue && refValue.sys && refValue.sys.type === 'Link' && refValue.sys.linkType === 'Entry') {
            try {
              const refEntry = await (options.useRateLimit ? 
                rateLimitedRequest(() => environment.getEntry(refValue.sys.id)) : 
                environment.getEntry(refValue.sys.id));
              
              if (refEntry.sys.contentType.sys.id === refConfig.type) {
                const refResult = {
                  id: refEntry.sys.id,
                  ...await extractTextFields(refEntry.fields, refConfig, environment, options)
                };
                result_refs[locale] = refResult;
                hasAnyReferences = true;
              }
            } catch (error) {
              console.warn(`Failed to fetch reference ${refValue.sys.id}:`, error.message);
            }
          } else if (Array.isArray(refValue)) {
            // Handle array of references
            const resolvedRefs = [];
            for (const ref of refValue) {
              if (ref && ref.sys && ref.sys.type === 'Link' && ref.sys.linkType === 'Entry') {
                try {
                  const refEntry = await (options.useRateLimit ? 
                    rateLimitedRequest(() => environment.getEntry(ref.sys.id)) : 
                    environment.getEntry(ref.sys.id));
                  
                  if (refEntry.sys.contentType.sys.id === refConfig.type) {
                    const resolvedRef = {
                      id: refEntry.sys.id,
                      ...await extractTextFields(refEntry.fields, refConfig, environment, options)
                    };
                    resolvedRefs.push(resolvedRef);
                  }
                } catch (error) {
                  console.warn(`Failed to fetch reference ${ref.sys.id}:`, error.message);
                }
              }
            }
            if (resolvedRefs.length > 0) {
              result_refs[locale] = resolvedRefs;
              hasAnyReferences = true;
            }
          }
        }
        
        // Only include the field if it has any actual references
        if (hasAnyReferences) {
          result[refField] = result_refs;
        }
      }
    }
  }

  return result;
}

async function fetchEntryWithReferences(environment, entryId, contentType, options = {}) {
  const entry = await (options.useRateLimit ? 
    rateLimitedRequest(() => environment.getEntry(entryId)) : 
    environment.getEntry(entryId));

  // Ensure the content type matches
  if (entry.sys.contentType.sys.id !== contentType.id) {
    throw new Error(`Entry is not of content type '${contentType.id}'. Found: ${entry.sys.contentType.sys.id}`);
  }

  const structuredData = {
    id: entry.sys.id,
    contentType: entry.sys.contentType.sys.id,
    fields: await extractTextFields(entry.fields, contentType, environment, options)
  };

  return structuredData;
}

/**
 * Fetch tag ID by tag name
 * @param {Object} environment - Contentful environment
 * @param {string} tagName - Name of the tag
 * @returns {Promise<string|null>} Tag ID or null if not found
 */
async function getTagIdByName(environment, tagNameOrId) {
  try {
    const tags = await rateLimitedRequest(() => environment.getTags());
    console.log(`[DEBUG] Found ${tags.items.length} total tags`);
    console.log(`[DEBUG] Tag names:`, tags.items.map(t => t.name));
    console.log(`[DEBUG] Tag IDs:`, tags.items.map(t => t.sys.id));
    
    // First, try to find by ID (if it looks like an ID or if exact match)
    let tag = tags.items.find(t => t.sys.id === tagNameOrId);
    
    // If not found by ID, try case-insensitive name match
    if (!tag) {
      const normalizedSearch = tagNameOrId.toLowerCase().trim();
      tag = tags.items.find(t => {
        const normalizedName = t.name.toLowerCase().trim();
        return normalizedName === normalizedSearch || 
               normalizedName.replace(/\s+/g, '') === normalizedSearch.replace(/\s+/g, '');
      });
    }
    
    if (tag) {
      console.log(`[DEBUG] Found tag "${tagNameOrId}" -> "${tag.name}" with ID: ${tag.sys.id}`);
    } else {
      console.log(`[DEBUG] Tag "${tagNameOrId}" not found in available tags`);
    }
    return tag ? tag.sys.id : null;
  } catch (error) {
    console.warn(`Failed to fetch tag "${tagNameOrId}":`, error.message);
    return null;
  }
}

/**
 * Fetch entries across multiple content types that have a specific tag
 * @param {Object} environment - Contentful environment
 * @param {string} tagName - Name of the tag to search for
 * @param {Object} contentTypesModel - Content types model with getAllSupportedContentTypeIds
 * @returns {Promise<Array>} Array of entries with metadata (entry, contentType)
 */
async function fetchEntriesByTag(environment, tagName, contentTypesModel) {
  const tagId = await getTagIdByName(environment, tagName);
  if (!tagId) {
    console.log(`[DEBUG] No tag ID found for "${tagName}", returning empty array`);
    return [];
  }

  // Get all supported content type IDs including nested ones
  const supportedTypeIds = contentTypesModel.getAllSupportedContentTypeIds();
  const contentTypeIdToName = contentTypesModel.getContentTypeIdToNameMap();
  
  console.log(`[DEBUG] Supported content type IDs:`, Array.from(supportedTypeIds));
  console.log(`[DEBUG] Content type ID to name map:`, Object.fromEntries(contentTypeIdToName));

  if (supportedTypeIds.size === 0) {
    console.log(`[DEBUG] No supported content types found`);
    return [];
  }

  const allEntries = [];
  let skip = 0;
  const limit = 1000;
  let hasMore = true;

  // Query all entries with the tag (pagination support)
  while (hasMore) {
    try {
      console.log(`[DEBUG] Querying entries with tag ID "${tagId}", skip: ${skip}, limit: ${limit}`);
      const entries = await rateLimitedRequest(() => environment.getEntries({
        'metadata.tags.sys.id[in]': tagId,
        limit: limit,
        skip: skip,
        order: '-sys.updatedAt' // Sort by last updated date, newest first
      }));

      console.log(`[DEBUG] Found ${entries.items.length} entries with tag (total: ${entries.total})`);

      // Filter to only supported content types and add metadata
      entries.items.forEach(entry => {
        const entryContentTypeId = entry.sys.contentType.sys.id;
        console.log(`[DEBUG] Entry ${entry.sys.id} has content type: ${entryContentTypeId}, supported: ${supportedTypeIds.has(entryContentTypeId)}`);
        
        // Only include entries with supported content types
        if (supportedTypeIds.has(entryContentTypeId)) {
          // Get the content type config (may be nested, so try getContentType first)
          let contentType = contentTypesModel.getContentType(entryContentTypeId);
          
          // If not found in top-level, it's a nested type - create a minimal config
          if (!contentType) {
            const contentTypeName = contentTypeIdToName.get(entryContentTypeId) || entryContentTypeId;
            contentType = {
              id: entryContentTypeId,
              name: contentTypeName
            };
          }
          
          console.log(`[DEBUG] Adding entry ${entry.sys.id} with content type ${contentType.name}`);
          allEntries.push({
            entry,
            contentType: contentType
          });
        } else {
          console.log(`[DEBUG] Skipping entry ${entry.sys.id} - content type ${entryContentTypeId} not in supported list`);
        }
      });

      // Check if there are more entries to fetch
      skip += entries.items.length;
      hasMore = entries.items.length === limit && entries.total > skip;
      console.log(`[DEBUG] Processed ${entries.items.length} entries, hasMore: ${hasMore}`);
    } catch (error) {
      console.warn(`Failed to fetch entries with tag "${tagName}":`, error.message);
      console.error(`[DEBUG] Error details:`, error);
      hasMore = false;
    }
  }

  console.log(`[DEBUG] Returning ${allEntries.length} entries after filtering`);
  return allEntries;
}

/**
 * Remove a specific tag from an entry while preserving all other tags
 * @param {Object} environment - Contentful environment
 * @param {string} entryId - ID of the entry
 * @param {string} tagName - Name of the tag to remove
 * @returns {Promise<boolean>} True if tag was removed, false otherwise
 */
async function removeTagFromEntry(environment, entryId, tagName) {
  try {
    // Get the entry
    const entry = await rateLimitedRequest(() => environment.getEntry(entryId));
    
    // Get current tags
    const currentTags = entry.metadata.tags || [];
    
    // Get tag ID to remove
    const tagId = await getTagIdByName(environment, tagName);
    if (!tagId) {
      console.warn(`Tag "${tagName}" not found, cannot remove from entry ${entryId}`);
      return false;
    }
    
    // Filter out the tag to remove
    const updatedTags = currentTags.filter(tag => tag.sys.id !== tagId);
    
    // Only update if tags actually changed
    if (updatedTags.length !== currentTags.length) {
      entry.metadata.tags = updatedTags;
      await rateLimitedRequest(() => entry.update());
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`Failed to remove tag "${tagName}" from entry ${entryId}:`, error.message);
    return false;
  }
}

module.exports = {
  SUPPORTED_LANGUAGES,
  rateLimitedRequest,
  extractTextFields,
  fetchEntryWithReferences,
  getTagIdByName,
  fetchEntriesByTag,
  removeTagFromEntry
}; 