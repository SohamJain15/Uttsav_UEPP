const toSafeFilename = (name = 'document') => {
  const normalized = String(name || 'document').trim();
  if (normalized.toLowerCase().endsWith('.pdf')) return normalized;
  return `${normalized}.pdf`;
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
  const fileName = document?.fileName || 'document';
  const url = String(document?.url || '').trim();
  const canOpen = Boolean(url);

  const onView = () => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onDownload = async () => {
    if (!url) return;
    if (url.startsWith('data:')) {
      downloadDataUrl(url, fileName);
      return;
    }
    await downloadRemoteFile(url, fileName);
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-borderMain px-3 py-2 text-sm">
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
  );
};

export default DocumentRow;
