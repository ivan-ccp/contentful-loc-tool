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

module.exports = {
  SUPPORTED_LANGUAGES,
  rateLimitedRequest,
  extractTextFields,
  fetchEntryWithReferences
}; 