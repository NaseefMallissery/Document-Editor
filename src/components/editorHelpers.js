import { findParentNode } from '@tiptap/core';

function findTable(editor) {
  return findParentNode(node => node.type.name === 'table')(
    editor.state.selection,
  );
}

// Colors every cell in the first row of the table the cursor is in.
// Pass null to clear the color.
export function setHeaderRowColor(editor, color) {
  const table = findTable(editor);
  const firstRow = table?.node.firstChild;

  if (!table || !firstRow) return false;

  const { state, view } = editor;
  const tr = state.tr;

  firstRow.forEach((cell, offset) => {
    // table.pos is before the table; +1 enters the table, +1 enters the row.
    tr.setNodeMarkup(table.pos + 2 + offset, undefined, {
      ...cell.attrs,
      backgroundColor: color,
    });
  });

  view.dispatch(tr);
  return true;
}

export function getHeaderRowColor(editor) {
  const table = findTable(editor);

  return table?.node.firstChild?.firstChild?.attrs.backgroundColor || null;
}

// Reads an image file, shrinks it (large photos would fill up browser storage
// very quickly) and returns a data URL.
export function imageFileToDataUrl(file, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      if (!image.naturalWidth) {
        reject(new Error('Image has no size'));
        return;
      }

      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const width = Math.round(image.naturalWidth * scale);
      const height = Math.round(image.naturalHeight * scale);

      const canvas = window.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      const keepTransparency = /^image\/(png|gif|webp|svg\+xml)$/.test(
        file.type,
      );

      if (!keepTransparency) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
      }

      context.drawImage(image, 0, 0, width, height);

      resolve(
        canvas.toDataURL(
          keepTransparency ? 'image/png' : 'image/jpeg',
          0.85,
        ),
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };

    image.src = objectUrl;
  });
}
