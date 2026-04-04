import { useState } from 'react';

const toSafeFilename = (name = 'document') => {
  const normalized = String(name || 'document').trim();
  if (normalized.toLowerCase().endsWith('.pdf')) return normalized;
  return `${normalized}.pdf`;
};

const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:8001')
  .trim()
  .replace(/\/$/, '');

const normalizeDocumentUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) {
    return `${backendOrigin}${trimmed}`;
  }
  return trimmed;
};

const downloadDataUrl = (dataUrl, fileName) => {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = toSafeFilename(fileName);
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const downloadRemoteFile = async (url, fileName) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = toSafeFilename(fileName);
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const DocumentRow = ({ document }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const fileName = document?.fileName || 'document';
  const url = normalizeDocumentUrl(String(document?.url || ''));
  const canOpen = Boolean(url);

  const onView = () => {
    if (!url) return;
    setErrorMessage('');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onDownload = async () => {
    if (!url) return;
    setErrorMessage('');
    try {
      if (url.startsWith('data:')) {
        downloadDataUrl(url, fileName);
        return;
      }
      await downloadRemoteFile(url, fileName);
    } catch (error) {
      setErrorMessage('Unable to download this document right now. Please try again.');
    }
  };

  return (
    <div className="rounded-xl border border-borderMain px-3 py-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-textMain">{fileName}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onView}
            disabled={!canOpen}
            className="rounded-lg border border-borderMain px-2 py-1 text-xs text-textSecondary transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            View
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!canOpen}
            className="rounded-lg border border-borderMain px-2 py-1 text-xs text-textSecondary transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </div>
      {errorMessage ? <p className="mt-1 text-xs text-statusRed">{errorMessage}</p> : null}
    </div>
  );
};

export default DocumentRow;
