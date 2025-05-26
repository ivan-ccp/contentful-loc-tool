const contentfulConfig = require('./src/config/contentful');

(async () => {
  try {
    console.log('Fetching entry...');
    const env = await contentfulConfig.getEnvironment();
    const entry = await env.getEntry('5zKyaOq5qeOSezg5KQ8rSx');
    
    console.log('OfferDetail field specifically:');
    console.log(JSON.stringify(entry.fields.offerDetail, null, 2));
    
    // Try to fetch the referenced entry
    const refId = entry.fields.offerDetail.en.sys.id;
    console.log(`\nFetching referenced entry: ${refId}`);
    
    try {
      const refEntry = await env.getEntry(refId);
      console.log('Referenced entry content type:', refEntry.sys.contentType.sys.id);
      console.log('Referenced entry fields:');
      console.log(JSON.stringify(refEntry.fields, null, 2));
    } catch (refError) {
      console.error('Error fetching referenced entry:', refError.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})(); 