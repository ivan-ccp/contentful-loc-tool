const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const RichTextService = require('../../services/richText');
const { fetchEntryWithReferences } = require('../../utils/contentfulHelpers');

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
                
                // Merge the resource's value field
                const mergedResource = { ...currentResource };
                
                if (translatedResource.value && currentResource.value) {
                  // Start with current values and merge in new translations
                  mergedResource.value = { ...currentResource.value };
                  
                  // Only add non-empty translations from the file
                  for (const [lang, text] of Object.entries(translatedResource.value)) {
                    if (text && text.trim && text.trim() !== '' && text !== '') {
                      mergedResource.value[lang] = text;
                    }
                  }
                } else if (translatedResource.value) {
                  // If current resource has no value but translated does, use translated
                  mergedResource.value = translatedResource.value;
                }
                
                return mergedResource;
              });
                }
          } else {
            // Handle other fields normally
            merged[fieldName] = fieldValue;
          }
        }

        return merged;
      };

      // Merge the translations
      const mergedFields = mergeTranslations(currentEntry.fields, translatedEntry.fields);
      
      // Now we need to update the actual Contentful entries
      await updateContentfulEntries(environment, mergedFields, contentType);
      
      spinner.succeed(chalk.green(`Updated entry ${translatedEntry.id}`));
    }

    spinner.succeed(chalk.green('Import completed successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Import failed'));
    console.error('Error details:', error);
    throw error;
  }
}

// Function to update Contentful entries with merged data
async function updateContentfulEntries(environment, mergedFields, contentType) {
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