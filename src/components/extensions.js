import Image from '@tiptap/extension-image';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

// Picks a readable text color (dark or light) for a given #rrggbb background.
function contrastText(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');

  if (!match) return null;

  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.6 ? '#212529' : '#ffffff';
}

const backgroundColorAttribute = {
  default: null,
  parseHTML: element =>
    element.getAttribute('data-bgcolor') ||
    element.style.backgroundColor ||
    null,
  renderHTML: attributes => {
    if (!attributes.backgroundColor) return {};

    const text = contrastText(attributes.backgroundColor);

    return {
      'data-bgcolor': attributes.backgroundColor,
      style: `background-color: ${attributes.backgroundColor};${
        text ? ` color: ${text};` : ''
      }`,
    };
  },
};

// Table cells and header cells that remember a background color.
export const ColoredTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: backgroundColorAttribute,
    };
  },
});

export const ColoredTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: backgroundColorAttribute,
    };
  },
});

// Image with a width (for example "50%") and alignment (left/center/right).
export const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element =>
          element.getAttribute('data-width') || element.style.width || null,
        renderHTML: attributes =>
          attributes.width
            ? {
                'data-width': attributes.width,
                style: `width: ${attributes.width}`,
              }
            : {},
      },
      align: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-align') || 'left',
        renderHTML: attributes => ({ 'data-align': attributes.align }),
      },
    };
  },
});
