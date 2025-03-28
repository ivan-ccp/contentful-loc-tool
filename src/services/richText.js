const { documentToMarkdownString } = require('@contentful/rich-text-html-renderer');
const { richTextFromMarkdown } = require('@contentful/rich-text-from-markdown');

class RichTextService {
  /**
   * Converts Contentful Rich Text to Markdown
   * Handles embedded entries and assets by replacing them with placeholders
   */
  static async toMarkdown(richText) {
    if (!richText) return null;

    // First convert to HTML
    const html = documentToMarkdownString(richText);
    
    // Replace embedded entries and assets with placeholders
    const markdown = html
      .replace(/<entry:([^>]+)>/g, '[ENTRY:$1]')
      .replace(/<asset:([^>]+)>/g, '[ASSET:$1]');
    
    return markdown;
  }

  /**
   * Converts Markdown back to Contentful Rich Text
   * Replaces placeholders with original embedded entries and assets
   */
  static async fromMarkdown(markdown, originalRichText) {
    if (!markdown) return null;

    // Extract embedded entries and assets from original rich text
    const embeddedEntries = this.extractEmbeddedEntries(originalRichText);
    const embeddedAssets = this.extractEmbeddedAssets(originalRichText);

    // Replace placeholders with original embedded content
    let processedMarkdown = markdown;
    for (const [id, entry] of Object.entries(embeddedEntries)) {
      processedMarkdown = processedMarkdown.replace(
        new RegExp(`\\[ENTRY:${id}\\]`, 'g'),
        `<entry:${id}>`
      );
    }
    for (const [id, asset] of Object.entries(embeddedAssets)) {
      processedMarkdown = processedMarkdown.replace(
        new RegExp(`\\[ASSET:${id}\\]`, 'g'),
        `<asset:${id}>`
      );
    }

    // Convert to Contentful Rich Text
    return richTextFromMarkdown(processedMarkdown, {
      preserveWhitespace: true,
      nodeTransformers: [
        {
          nodeType: 'embedded-entry-inline',
          transform: (node) => node,
        },
        {
          nodeType: 'embedded-entry-block',
          transform: (node) => node,
        },
        {
          nodeType: 'embedded-asset-block',
          transform: (node) => node,
        },
      ],
    });
  }

  /**
   * Extracts embedded entries from Rich Text
   */
  static extractEmbeddedEntries(richText) {
    if (!richText) return {};
    
    const entries = {};
    const traverse = (node) => {
      if (node.nodeType === 'embedded-entry-inline' || node.nodeType === 'embedded-entry-block') {
        entries[node.data.target.sys.id] = node;
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    richText.content.forEach(traverse);
    return entries;
  }

  /**
   * Extracts embedded assets from Rich Text
   */
  static extractEmbeddedAssets(richText) {
    if (!richText) return {};
    
    const assets = {};
    const traverse = (node) => {
      if (node.nodeType === 'embedded-asset-block') {
        assets[node.data.target.sys.id] = node;
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    richText.content.forEach(traverse);
    return assets;
  }
}

module.exports = RichTextService; 