const fs = require('fs');
const path = require('path');
const RichTextService = require('./src/services/richText');
const he = require('he'); // HTML entity decoder

// Read the input file
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Please provide an input file path');
  process.exit(1);
}

async function convertFile() {
  try {
    const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    // Convert each resource's rich text to markdown
    const convertedData = {
      ...inputData,
      fields: {
        resources: {
          en: await Promise.all(inputData.fields.resources.en.map(async resource => ({
            ...resource,
            value: Object.fromEntries(
              await Promise.all(
                Object.entries(resource.value).map(async ([lang, content]) => [
                  lang,
                  content ? he.decode(await RichTextService.toMarkdown(content)) : ''
                ])
              )
            )
          })))
        }
      }
    };
    
    // Create output filename
    const outputFile = path.join(
      path.dirname(inputFile),
      `${path.basename(inputFile, '.json')}-markdown.json`
    );
    
    // Write the converted data
    fs.writeFileSync(outputFile, JSON.stringify(convertedData, null, 2));
    console.log(`Successfully converted to markdown format. Output saved to: ${outputFile}`);
  } catch (error) {
    console.error('Error processing file:', error.message);
    process.exit(1);
  }
}

convertFile(); 