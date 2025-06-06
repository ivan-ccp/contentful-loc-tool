const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contentfulConfig = require('../../config/contentful');
const { getContentType } = require('../../models/contentTypes');
const RichTextService = require('../../services/richText');

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

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

      // Get the original entry to compare
      const entry = await environment.getEntry(translatedEntry.id);
      
      // Update fields based on content type definition
      const updateFields = async (fields, translatedFields, typeConfig) => {
        const updates = {};
        
        for (const fieldName of typeConfig.fields) {
          const translatedValue = translatedFields[fieldName];
          
          // Skip if the field is empty in the translation file
          if (!translatedValue) continue;
          
          // Check if this is a rich text field
          const isRichText = fields[fieldName]?.nodeType === 'document' || 
                           typeConfig.richTextFields?.includes(fieldName);
          
          if (isRichText) {
            // Handle Rich Text fields - convert markdown to rich text
            updates[fieldName] = await RichTextService.fromMarkdown(
              translatedValue,
              fields[fieldName]
            );
          } else {
            // Handle regular fields - write as is
            updates[fieldName] = translatedValue;
          }
        }

        // Handle references if present
        if (typeConfig.references) {
          for (const [refField, refConfig] of Object.entries(typeConfig.references)) {
            const translatedRefs = translatedFields[refField];
            if (!translatedRefs) continue;

            const updates_refs = {};
            let hasAnyUpdates = false;

            // Process each locale's references
            for (const [locale, refValue] of Object.entries(translatedRefs)) {
              if (!refValue) continue;

              if (Array.isArray(refValue)) {
                // Handle array of references
                const resolvedRefs = [];
                for (const ref of refValue) {
                  if (!ref || !ref.id) continue;
                  
                  // Get the referenced entry
                  const refEntry = await environment.getEntry(ref.id);
                  
                  if (refEntry.sys.contentType.sys.id === refConfig.type) {
                    // Recursively update the referenced entry's fields
                    const refUpdates = await updateFields(refEntry.fields, ref, refConfig);
                    if (Object.keys(refUpdates).length > 0) {
                      Object.assign(refEntry.fields, refUpdates);
                      await refEntry.update();
                      resolvedRefs.push({ sys: { type: 'Link', linkType: 'Entry', id: ref.id } });
                      hasAnyUpdates = true;
                    }
                  }
                }
                if (resolvedRefs.length > 0) {
                  updates_refs[locale] = resolvedRefs;
                }
              } else if (refValue.id) {
                // Handle single reference
                const refEntry = await environment.getEntry(refValue.id);
                if (refEntry.sys.contentType.sys.id === refConfig.type) {
                  const refUpdates = await updateFields(refEntry.fields, refValue, refConfig);
                  if (Object.keys(refUpdates).length > 0) {
                    Object.assign(refEntry.fields, refUpdates);
                    await refEntry.update();
                    updates_refs[locale] = { sys: { type: 'Link', linkType: 'Entry', id: refValue.id } };
                    hasAnyUpdates = true;
                  }
                }
              }
            }

            if (hasAnyUpdates) {
              updates[refField] = updates_refs;
            }
          }
        }

        return updates;
      };

      // Update the entry's fields
      const updates = await updateFields(entry.fields, translatedEntry.fields, contentType);
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        Object.assign(entry.fields, updates);
        await entry.update();
        spinner.succeed(chalk.green(`Updated entry ${entry.sys.id}`));
      } else {
        spinner.info(chalk.blue(`No changes for entry ${entry.sys.id}`));
      }
    }

    spinner.succeed(chalk.green('Import completed successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Import failed'));
    console.error('Error details:', error);
    throw error;
  }
}

module.exports = {
  importCommand
}; 