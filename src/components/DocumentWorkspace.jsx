import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';

import FontSize from './FontSize';
import SignaturePad from './SignaturePad';
import ToolbarButton from './ToolbarButton';
import {
  ColoredTableCell,
  ColoredTableHeader,
  RichImage,
} from './extensions';
import {
  getHeaderRowColor,
  imageFileToDataUrl,
  setHeaderRowColor,
} from './editorHelpers';

const DEFAULT_CONTENT = `
  <h1>Document Title</h1>
  <p>Start writing your document here...</p>
`;

const AUTOSAVE_DELAY = 800;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const HEADER_PRESETS = [
  '#1f3a5f',
  '#0d6efd',
  '#198754',
  '#6f42c1',
  '#dc3545',
  '#e9ecef',
];
const IMAGE_SIZES = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
  { label: 'Original', value: null },
];

function Swatch({ color, title, onClick }) {
  return (
    <button
      type="button"
      className="swatch"
      title={title}
      aria-label={title}
      style={{ backgroundColor: color }}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    />
  );
}

// NOTE: the prop is called `doc` (not `document`) so it does not shadow
// the browser's global `document` object.
export default function DocumentWorkspace({ doc, onSave }) {
  const [showSignature, setShowSignature] = useState(false);
  const [title, setTitle] = useState(doc.title || '');
  const [status, setStatus] = useState('All changes saved');

  const docRef = useRef(doc);
  const titleRef = useRef(title);
  const htmlRef = useRef(doc.content || DEFAULT_CONTENT);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const onSaveRef = useRef(onSave);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  docRef.current = doc;
  onSaveRef.current = onSave;

  function persist() {
    clearTimeout(timerRef.current);

    if (!dirtyRef.current) return;

    dirtyRef.current = false;
    onSaveRef.current?.({
      ...docRef.current,
      title: titleRef.current,
      content: htmlRef.current,
      updatedAt: new Date().toISOString(),
    });
    setStatus('All changes saved');
  }

  function markDirty() {
    dirtyRef.current = true;
    setStatus('Saving...');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persist, AUTOSAVE_DELAY);
  }

  // Reads image files, shrinks them, and inserts them at `position`
  // (or at the cursor when no position is given).
  async function insertImages(files, position) {
    const instance = editorRef.current;

    if (!instance) return;

    const images = Array.from(files).filter(file =>
      file.type.startsWith('image/'),
    );
    let nextPosition = position;

    for (const file of images) {
      if (file.size > MAX_IMAGE_BYTES) {
        setStatus(`"${file.name}" is larger than 10 MB and was skipped.`);
        continue;
      }

      try {
        const src = await imageFileToDataUrl(file);
        const chain = instance.chain().focus();

        if (nextPosition != null) chain.setTextSelection(nextPosition);

        chain.setImage({ src, alt: file.name }).run();
        nextPosition = null;
      } catch {
        setStatus(`Could not read "${file.name}".`);
      }
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      // allowBase64 must be true: uploaded images and signatures are data
      // URLs, and with `false` they disappear when the document is reloaded.
      RichImage.configure({
        inline: false,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      ColoredTableHeader,
      ColoredTableCell,
    ],
    content: doc.content || DEFAULT_CONTENT,
    editorProps: {
      attributes: {
        class: 'document-editor-content',
        spellcheck: 'true',
        'aria-label': 'Document content editor',
      },
      // Drag an image file from the desktop into the document.
      handleDrop: (view, event, slice, moved) => {
        const files = event.dataTransfer?.files;

        if (moved || !files?.length) return false;
        if (!Array.from(files).some(file => file.type.startsWith('image/'))) {
          return false;
        }

        event.preventDefault();

        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        insertImages(files, coords?.pos);
        return true;
      },
      // Paste a screenshot or copied image.
      handlePaste: (view, event) => {
        const files = event.clipboardData?.files;

        if (!files?.length) return false;
        // Pasting from Word / web pages carries HTML too; let that through.
        if (event.clipboardData.getData('text/html')) return false;
        if (!Array.from(files).some(file => file.type.startsWith('image/'))) {
          return false;
        }

        event.preventDefault();
        insertImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      htmlRef.current = instance.getHTML();
      markDirty();
    },
  });

  editorRef.current = editor;

  // Save any pending changes when the user switches to another document.
  useEffect(() => {
    return () => persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!editor) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        Loading document editor...
      </div>
    );
  }

  const textStyle = editor.getAttributes('textStyle');
  const inTable = editor.isActive('table');
  const imageSelected = editor.isActive('image');
  const imageAttrs = editor.getAttributes('image');
  const cellColor =
    editor.getAttributes('tableCell').backgroundColor ||
    editor.getAttributes('tableHeader').backgroundColor ||
    '#ffffff';

  const exportHtml = () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || 'Document')}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 850px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #222; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #aaa; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f3f6; }
    mark { padding: 0 0.1em; }
    img { max-width: 100%; height: auto; display: block; }
    img[data-align="center"] { margin-left: auto; margin-right: auto; }
    img[data-align="right"] { margin-left: auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  ${editor.getHTML()}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');

    anchor.href = url;
    anchor.download = `${safeFilename(title || 'document')}.html`;
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleTitleChange = event => {
    const value = event.target.value;

    setTitle(value);
    titleRef.current = value;
    markDirty();
  };

  const handleLink = () => {
    const currentHref = editor.getAttributes('link').href || '';
    const input = window.prompt('Enter the link URL:', currentHref);

    if (input === null) return;

    const url = input.trim();

    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    try {
      const parsed = new URL(url);

      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        setStatus('Unsupported link type. Use http, https or mailto.');
        return;
      }

      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } catch {
      setStatus('Enter a valid URL, including https://');
    }
  };

  const handleImageUrl = () => {
    const input = window.prompt('Enter an image URL (https://...):');

    if (!input?.trim()) return;

    try {
      const parsed = new URL(input.trim());

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setStatus('Please use an http or https image URL.');
        return;
      }

      editor.chain().focus().setImage({ src: input.trim() }).run();
    } catch {
      setStatus('Enter a valid image URL.');
    }
  };

  const handleImageAlt = () => {
    const input = window.prompt(
      'Describe this image (alt text):',
      imageAttrs.alt || '',
    );

    if (input === null) return;

    editor.chain().focus().updateAttributes('image', { alt: input }).run();
  };

  const insertSignature = dataUrl => {
    if (!dataUrl) return;

    editor
      .chain()
      .focus()
      .setImage({
        src: dataUrl,
        alt: 'Signature',
        title: 'Signature',
      })
      .run();

    setShowSignature(false);
  };

  const setCellColor = color =>
    editor.chain().focus().setCellAttribute('backgroundColor', color).run();

  const headingValue = [1, 2, 3].find(level =>
    editor.isActive('heading', { level }),
  );

  return (
    <div className="document-workspace container-fluid py-3">
      {/* Header */}
      <div className="no-print d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <input
            className="form-control form-control-lg document-title-input"
            value={title}
            placeholder="Untitled document"
            aria-label="Document title"
            onChange={handleTitleChange}
          />
          <small className="text-muted ms-2">{status}</small>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={exportHtml}
          >
            Export HTML
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              dirtyRef.current = true;
              htmlRef.current = editor.getHTML();
              persist();
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar no-print card card-body mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <ToolbarButton
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarButton>

          <ToolbarButton
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarButton>

          <ToolbarButton
            title="Underline"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <u>U</u>
          </ToolbarButton>

          <ToolbarButton
            title="Strike through"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <s>S</s>
          </ToolbarButton>

          <div className="vr mx-1" />

          <select
            className="form-select form-select-sm toolbar-select"
            aria-label="Text style"
            value={headingValue ? `h${headingValue}` : 'paragraph'}
            onChange={event => {
              const value = event.target.value;

              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else {
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(value.slice(1)) })
                  .run();
              }
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>

          <select
            className="form-select form-select-sm toolbar-select"
            aria-label="Font size"
            value={textStyle.fontSize || '16px'}
            onChange={event =>
              editor.chain().focus().setFontSize(event.target.value).run()
            }
          >
            {['12px', '14px', '16px', '18px', '20px', '24px', '32px'].map(
              size => (
                <option key={size} value={size}>
                  {size.replace('px', ' px')}
                </option>
              ),
            )}
          </select>

          <label className="d-flex align-items-center gap-1 small">
            Color
            <input
              type="color"
              className="form-control form-control-color form-control-sm"
              title="Text color"
              value={textStyle.color || '#222222'}
              onChange={event =>
                editor.chain().focus().setColor(event.target.value).run()
              }
            />
          </label>

          <label className="d-flex align-items-center gap-1 small">
            Highlight
            <input
              type="color"
              className="form-control form-control-color form-control-sm"
              title="Highlight color"
              value={editor.getAttributes('highlight').color || '#fff59d'}
              onChange={event =>
                editor
                  .chain()
                  .focus()
                  .setHighlight({ color: event.target.value })
                  .run()
              }
            />
          </label>

          <ToolbarButton
            title="Remove highlight"
            disabled={!editor.isActive('highlight')}
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            ✕
          </ToolbarButton>

          <div className="vr mx-1" />

          <ToolbarButton
            title="Align left"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            Left
          </ToolbarButton>

          <ToolbarButton
            title="Align center"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            Center
          </ToolbarButton>

          <ToolbarButton
            title="Align right"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            Right
          </ToolbarButton>

          <div className="vr mx-1" />

          <ToolbarButton
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </ToolbarButton>

          <ToolbarButton
            title="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </ToolbarButton>

          <ToolbarButton
            title="Blockquote"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            “ ”
          </ToolbarButton>

          <ToolbarButton
            title="Insert horizontal line"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            ―
          </ToolbarButton>

          <div className="vr mx-1" />

          <ToolbarButton
            title="Insert table"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            Table
          </ToolbarButton>

          <ToolbarButton
            title="Insert link"
            active={editor.isActive('link')}
            onClick={handleLink}
          >
            Link
          </ToolbarButton>

          <ToolbarButton
            title="Upload an image from your device"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload image
          </ToolbarButton>

          <ToolbarButton title="Insert image from URL" onClick={handleImageUrl}>
            Image URL
          </ToolbarButton>

          <ToolbarButton
            title="Add signature"
            onClick={() => setShowSignature(true)}
          >
            Signature
          </ToolbarButton>

          <div className="vr mx-1" />

          <ToolbarButton
            title="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            ↶
          </ToolbarButton>

          <ToolbarButton
            title="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            ↷
          </ToolbarButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={event => {
              insertImages(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        {/* Table tools: only shown while the cursor is inside a table */}
        {inTable && (
          <div className="toolbar-row d-flex flex-wrap align-items-center gap-2">
            <span className="toolbar-label">Table</span>

            <ToolbarButton
              title="Add row below"
              disabled={!editor.can().addRowAfter()}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              + Row
            </ToolbarButton>

            <ToolbarButton
              title="Add column after"
              disabled={!editor.can().addColumnAfter()}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              + Column
            </ToolbarButton>

            <ToolbarButton
              title="Delete row"
              disabled={!editor.can().deleteRow()}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              − Row
            </ToolbarButton>

            <ToolbarButton
              title="Delete column"
              disabled={!editor.can().deleteColumn()}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              − Column
            </ToolbarButton>

            <ToolbarButton
              title="Turn the first row into a header row (or back)"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            >
              Header row
            </ToolbarButton>

            <ToolbarButton
              title="Merge the selected cells (drag across cells to select)"
              disabled={!editor.can().mergeCells()}
              onClick={() => editor.chain().focus().mergeCells().run()}
            >
              Merge
            </ToolbarButton>

            <ToolbarButton
              title="Split a merged cell"
              disabled={!editor.can().splitCell()}
              onClick={() => editor.chain().focus().splitCell().run()}
            >
              Split
            </ToolbarButton>

            <ToolbarButton
              title="Delete table"
              disabled={!editor.can().deleteTable()}
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              Delete table
            </ToolbarButton>

            <div className="vr mx-1" />

            <span className="toolbar-label">Header color</span>

            {HEADER_PRESETS.map(color => (
              <Swatch
                key={color}
                color={color}
                title={`Header row color ${color}`}
                onClick={() => setHeaderRowColor(editor, color)}
              />
            ))}

            <input
              type="color"
              className="form-control form-control-color form-control-sm"
              title="Custom header row color"
              value={getHeaderRowColor(editor) || '#e9ecef'}
              onChange={event => setHeaderRowColor(editor, event.target.value)}
            />

            <ToolbarButton
              title="Clear header row color"
              onClick={() => setHeaderRowColor(editor, null)}
            >
              ✕
            </ToolbarButton>

            <div className="vr mx-1" />

            <label className="d-flex align-items-center gap-1 small">
              Cell color
              <input
                type="color"
                className="form-control form-control-color form-control-sm"
                title="Background color of the selected cell(s)"
                value={cellColor}
                onChange={event => setCellColor(event.target.value)}
              />
            </label>

            <ToolbarButton
              title="Clear cell color"
              onClick={() => setCellColor(null)}
            >
              ✕
            </ToolbarButton>
          </div>
        )}

        {/* Image tools: only shown while an image is selected */}
        {imageSelected && (
          <div className="toolbar-row d-flex flex-wrap align-items-center gap-2">
            <span className="toolbar-label">Image</span>

            {IMAGE_SIZES.map(size => (
              <ToolbarButton
                key={size.label}
                title={`Image width ${size.label}`}
                active={(imageAttrs.width || null) === size.value}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes('image', { width: size.value })
                    .run()
                }
              >
                {size.label}
              </ToolbarButton>
            ))}

            <div className="vr mx-1" />

            {['left', 'center', 'right'].map(align => (
              <ToolbarButton
                key={align}
                title={`Align image ${align}`}
                active={(imageAttrs.align || 'left') === align}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes('image', { align })
                    .run()
                }
              >
                {align[0].toUpperCase() + align.slice(1)}
              </ToolbarButton>
            ))}

            <div className="vr mx-1" />

            <ToolbarButton title="Edit alt text" onClick={handleImageAlt}>
              Alt text
            </ToolbarButton>

            <ToolbarButton
              title="Delete image"
              onClick={() => editor.chain().focus().deleteSelection().run()}
            >
              Delete image
            </ToolbarButton>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="document-paper card">
        <div className="card-body">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Signature modal */}
      {showSignature && (
        <div
          className="signature-modal-backdrop no-print"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setShowSignature(false);
            }
          }}
        >
          <div
            className="signature-modal card shadow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signature-modal-title"
          >
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 id="signature-modal-title" className="mb-0">
                Add Signature
              </h5>

              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setShowSignature(false)}
              />
            </div>

            <div className="card-body">
              <SignaturePad
                onInsert={insertSignature}
                onClose={() => setShowSignature(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeFilename(value) {
  return (
    String(value)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .trim()
      .slice(0, 100) || 'document'
  );
}
