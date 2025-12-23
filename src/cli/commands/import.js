const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const RichTextService = require('../../services/richText');
const { fetchEntryWithReferences, removeTagFromEntry, SUPPORTED_LANGUAGES } = require('../../utils/contentfulHelpers');

// Function to sanitize JSON content
function sanitizeJsonContent(content) {
  return content
    // Replace unbreakable spaces (U+00A0) with regular spaces
    .replace(/\u00A0/g, ' ')
    // Replace other common problematic whitespace characters
    .replace(/\u200B/g, '') // Zero-width space
    .replace(/\u200C/g, '') // Zero-width non-joiner
    .replace(/\u200D/g, '') // Zero-width joiner
    .replace(/\u2060/g, '') // Word joiner
    // Replace smart quotes with regular quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // Replace em dash and en dash with regular dash
    .replace(/[\u2013\u2014]/g, '-')
    // Trim whitespace
    .trim();
}

/**
 * Check if a value is non-empty
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is non-empty, false otherwise
 */
function isNonEmpty(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  return true;
}

/**
 * Check if all supported localizations are present and non-empty in the merged fields
 * @param {Object} mergedFields - The merged fields object
 * @param {Object} contentType - Content type configuration
 * @returns {boolean} True if all localizations are present and non-empty, false otherwise
 */
function hasAllLocalizations(mergedFields, contentType) {
  let hasLocalizedFields = false;
  
  // Check all regular fields
  for (const fieldName of contentType.fields) {
    const fieldValue = mergedFields[fieldName];
    
    // Only check if the field exists and is a localized field
    if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue) && !fieldValue.nodeType) {
      hasLocalizedFields = true;
      // Check if all supported languages are present and non-empty
      for (const lang of SUPPORTED_LANGUAGES) {
        if (!(lang in fieldValue) || !isNonEmpty(fieldValue[lang])) {
          return false;
        }
      }
    }
  }
  
  // If no localized fields were found, return false (can't have all localizations if there are no fields)
  if (!hasLocalizedFields && contentType.fields.length > 0) {
    return false;
  }
  
  // Check reference fields
  if (contentType.references) {
    for (const [refField, refConfig] of Object.entries(contentType.references)) {
      if (mergedFields[refField]) {
        const localizedRefField = mergedFields[refField];
        
        // Check if all locales are present for the reference field
        for (const lang of SUPPORTED_LANGUAGES) {
          if (!(lang in localizedRefField)) {
            return false;
          }
        }
        
        // For each locale, check the referenced entries
        for (const [locale, refValue] of Object.entries(localizedRefField)) {
          if (Array.isArray(refValue)) {
            // Check each referenced entry in the array
            for (const ref of refValue) {
              if (ref && typeof ref === 'object') {
                // Check all fields in the referenced entry
                for (const refFieldName of refConfig.fields) {
                  if (ref[refFieldName]) {
                    const refFieldValue = ref[refFieldName];
                    // Check if it's a localized field
                    if (refFieldValue && typeof refFieldValue === 'object' && !Array.isArray(refFieldValue) && !refFieldValue.nodeType) {
                      // Check if all supported languages are present and non-empty
                      for (const lang of SUPPORTED_LANGUAGES) {
                        if (!(lang in refFieldValue) || !isNonEmpty(refFieldValue[lang])) {
                          return false;
                        }
                      }
                    }
                  }
                }
              }
            }
          } else if (refValue && typeof refValue === 'object' && refValue.id) {
            // Single reference object
            for (const refFieldName of refConfig.fields) {
              if (refValue[refFieldName]) {
                const refFieldValue = refValue[refFieldName];
                // Check if it's a localized field
                if (refFieldValue && typeof refFieldValue === 'object' && !Array.isArray(refFieldValue) && !refFieldValue.nodeType) {
                  // Check if all supported languages are present and non-empty
                  for (const lang of SUPPORTED_LANGUAGES) {
                    if (!(lang in refFieldValue) || !isNonEmpty(refFieldValue[lang])) {
                      return false;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  return true;
}

async function importCommand(options) {
  // Dynamic import for ora (ES module)
  const { default: ora } = await import('ora');
  const spinner = ora('Initializing...').start();

  try {
    // Read and parse the translation file
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file content and sanitize it
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const sanitizedContent = sanitizeJsonContent(rawContent);
    
    const data = JSON.parse(sanitizedContent);
    const entries = Array.isArray(data) ? data : [data];
    
    spinner.text = 'Connecting to Contentful...';
    const environment = await contentfulConfig.getEnvironment();

    // Process each entry
    for (const translatedEntry of entries) {
      spinner.text = `Processing entry ${translatedEntry.id}...`;
      
      const contentType = getContentType(translatedEntry.contentType);
      if (!contentType) {
        throw new Error(`Unknown content type: ${translatedEntry.contentType}`);
      }

      // Get the original entry with all nested references
      const currentEntry = await fetchEntryWithReferences(environment, translatedEntry.id, contentType, {
        includeAllLanguages: false,
        useRateLimit: false
      });
      
      // Merge translations with current fields
      const mergeTranslations = (current, translated) => {
        const merged = { ...current };
        
        // Handle each field in the translated data
        for (const [fieldName, fieldValue] of Object.entries(translated)) {
          if (fieldName === 'resources' && fieldValue && typeof fieldValue === 'object') {
            // Handle resources field specifically
            for (const [locale, resources] of Object.entries(fieldValue)) {
              if (!resources || !Array.isArray(resources)) {
                continue;
              }
              
              // Initialize merged resources if it doesn't exist
              if (!merged.resources) {
                merged.resources = {};
              }
              if (!merged.resources[locale]) {
                merged.resources[locale] = [];
              }
              
              merged.resources[locale] = resources.map((translatedResource, index) => {
                const currentResource = current.resources?.[locale]?.[index];
                  
                if (!currentResource) {
                  return translatedResource;
                }
                
                // Merge the resource's val field
                const mergedResource = { ...currentResource };
                
                if (translatedResource.val && currentResource.val) {
                  // Start with current values and merge in new translations
                  mergedResource.val = { ...currentResource.val };
                  
                  // Only add non-empty translations from the file
                  for (const [lang, text] of Object.entries(translatedResource.val)) {
                    if (text && text.trim && text.trim() !== '' && text !== '') {
                      mergedResource.val[lang] = text;
                    }
                  }
                } else if (translatedResource.val) {
                  // If current resource has no val but translated does, use translated
                  mergedResource.val = translatedResource.val;
                }
                
                return mergedResource;
              });
                }
          } else {
            // Handle other fields - merge localized fields instead of overwriting
            if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue) && !fieldValue.nodeType) {
              // It's a localized field - merge the locales
              if (!merged[fieldName]) {
                merged[fieldName] = {};
              }
              // Preserve existing locales from current entry
              if (current[fieldName] && typeof current[fieldName] === 'object' && !Array.isArray(current[fieldName])) {
                merged[fieldName] = { ...current[fieldName] };
              }
              // Merge each locale from translated into merged (only non-empty values)
              for (const [lang, text] of Object.entries(fieldValue)) {
                if (text && text.trim && text.trim() !== '' && text !== '') {
                  merged[fieldName][lang] = text;
                }
              }
            } else {
              // Non-localized field - overwrite
              merged[fieldName] = fieldValue;
            }
          }
        }

        return merged;
      };

      // Merge the translations
      const mergedFields = mergeTranslations(currentEntry.fields, translatedEntry.fields);
      
      // Check if all localizations are present before updating (check merged fields which represent final state)
      const allLocalizationsPresent = hasAllLocalizations(mergedFields, contentType);
      
      // Now we need to update the actual Contentful entries
      await updateContentfulEntries(environment, translatedEntry.id, mergedFields, contentType);
      
      if (allLocalizationsPresent) {
        // Remove the "toLocalize" tag only if all localizations are present
        spinner.text = `Removing "toLocalize" tag from entry ${translatedEntry.id}...`;
        const tagRemoved = await removeTagFromEntry(environment, translatedEntry.id, 'toLocalize');
        
        if (tagRemoved) {
          spinner.succeed(chalk.green(`Updated entry ${translatedEntry.id} and removed "toLocalize" tag`));
        } else {
          spinner.succeed(chalk.green(`Updated entry ${translatedEntry.id}`));
        }
      } else {
        // Keep the tag if not all localizations are present
        spinner.succeed(chalk.yellow(`Updated entry ${translatedEntry.id} (keeping "toLocalize" tag - not all localizations present)`));
      }
    }

    spinner.succeed(chalk.green('Import completed successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Import failed'));
    console.error('Error details:', error);
    throw error;
  }
}

// Function to update Contentful entries with merged data
async function updateContentfulEntries(environment, entryId, mergedFields, contentType) {
  // Update the main entry
  try {
    const mainEntry = await environment.getEntry(entryId);
    
    // Update each field in the main entry
    for (const fieldName of contentType.fields) {
      if (mergedFields[fieldName]) {
        const fieldValue = mergedFields[fieldName];
        
        // Check if this is a Rich Text field
        const isRichText = contentType.richTextFields?.includes(fieldName);
        
        if (isRichText) {
          // Convert markdown/plain text to Rich Text format
          const richTextValue = await RichTextService.fromMarkdown(fieldValue, mainEntry.fields[fieldName]);
          mainEntry.fields[fieldName] = richTextValue;
        } else {
          // Regular localized field - use merged value directly
          mainEntry.fields[fieldName] = fieldValue;
        }
      }
    }
    
    await mainEntry.update();
  } catch (error) {
    console.warn(`Failed to update main entry ${entryId}:`, error.message);
    throw error;
  }
  
  // Handle references
  if (contentType.references) {
    for (const [refField, refConfig] of Object.entries(contentType.references)) {
      if (mergedFields[refField]) {
        const localizedField = mergedFields[refField];
        
        // Handle localized reference fields
        for (const [locale, refValue] of Object.entries(localizedField)) {
          if (Array.isArray(refValue)) {
            // Handle array of references
            for (const ref of refValue) {
              if (ref && ref.id) {
                try {
                  const refEntry = await environment.getEntry(ref.id);
                  if (refEntry.sys.contentType.sys.id === refConfig.type) {
                    // Update the referenced entry's fields
                    for (const [fieldName, fieldValue] of Object.entries(ref)) {
                      if (fieldName !== 'id' && fieldValue) {
                        // Check if this is a Rich Text field
                        const isRichText = refEntry.fields[fieldName]?.nodeType === 'document' || 
                                         refConfig.richTextFields?.includes(fieldName);
                        
                        if (isRichText) {
                          // Convert plain text to Rich Text format
                          const richTextValue = await RichTextService.fromMarkdown(fieldValue, refEntry.fields[fieldName]);
                          refEntry.fields[fieldName] = richTextValue;
                        } else {
                          refEntry.fields[fieldName] = fieldValue;
                        }
                      }
                    }
                    await refEntry.update();
                  }
                } catch (error) {
                  console.warn(`Failed to update reference ${ref.id}:`, error.message);
                }
              }
            }
          }
        }
      }
    }
  }
}

module.exports = {
  importCommand
}; 