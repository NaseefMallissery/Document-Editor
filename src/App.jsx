import { useEffect, useState } from 'react';
import DocumentWorkspace from './components/DocumentWorkspace.jsx';

const STORAGE_KEY = 'crm-document-editor-v1';

function createDocument() {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Contract',
    content: '<h1>Contract Agreement</h1><p>Enter your contract details here.</p>',
    updatedAt: new Date().toISOString(),
  };
}

function readDocuments() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Unable to read saved documents:', error);
  }

  return [createDocument()];
}

export default function App() {
  const [documents, setDocuments] = useState(readDocuments);
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [storageError, setStorageError] = useState(false);

  const activeDocument =
    documents.find(item => item.id === activeId) || documents[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
      setStorageError(false);
    } catch (error) {
      setStorageError(true);
      console.error('Unable to save documents:', error);
    }
  }, [documents]);

  function saveDocument(updatedDocument) {
    setDocuments(current =>
      current.map(item =>
        item.id === updatedDocument.id ? updatedDocument : item,
      ),
    );
  }

  function createNewDocument() {
    const nextDocument = createDocument();

    setDocuments(current => [nextDocument, ...current]);
    setActiveId(nextDocument.id);
  }

  function deleteDocument(id) {
    const confirmed = window.confirm(
      'Delete this document from this browser?',
    );

    if (!confirmed) return;

    const remaining = documents.filter(item => item.id !== id);

    if (remaining.length === 0) {
      const replacement = createDocument();

      setDocuments([replacement]);
      setActiveId(replacement.id);
      return;
    }

    setDocuments(remaining);

    if (activeDocument?.id === id) {
      setActiveId(remaining[0].id);
    }
  }

  const filteredDocuments = documents.filter(item =>
    (item.title || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="app-layout">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-icon">D</div>

          <div>
            <strong>CRM Workspace</strong>
            <div className="small text-secondary">Documents</div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary w-100 new-document"
          onClick={createNewDocument}
        >
          + New document
        </button>

        <label className="small text-secondary mb-2" htmlFor="document-search">
          YOUR DOCUMENTS
        </label>

        <input
          id="document-search"
          className="form-control form-control-sm mb-3"
          placeholder="Search documents..."
          value={search}
          onChange={event => setSearch(event.target.value)}
        />

        <div className="document-list">
          {filteredDocuments.map(item => (
            <div
              key={item.id}
              className={`document-list-item ${
                item.id === activeDocument?.id ? 'selected' : ''
              }`}
            >
              <button
                type="button"
                className="document-select"
                onClick={() => setActiveId(item.id)}
              >
                <span className="document-icon">▤</span>

                <span className="document-name">
                  <strong>{item.title || 'Untitled Contract'}</strong>

                  <small>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="delete-document"
                title={`Delete ${item.title || 'document'}`}
                aria-label={`Delete ${item.title || 'document'}`}
                onClick={() => deleteDocument(item.id)}
              >
                ×
              </button>
            </div>
          ))}

          {filteredDocuments.length === 0 && (
            <p className="small text-secondary p-2">
              No matching documents.
            </p>
          )}
        </div>

        <div className="sidebar-note">
          <strong>Demo</strong>
          <p>
         This is just a demo. Documents are saved in this browser.
          </p>
        </div>
      </aside>

      <div className="main-area">
        {storageError && (
          <div className="alert alert-danger m-3 mb-0 no-print" role="alert">
            Browser storage is full, so your latest changes are NOT saved.
            Remove large images or delete old documents, or connect the CRM
            backend to store documents on the server.
          </div>
        )}

        {activeDocument && (
          <DocumentWorkspace
            key={activeDocument.id}
            doc={activeDocument}
            onSave={saveDocument}
          />
        )}
      </div>
    </div>
  );
}
