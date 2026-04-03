const DocumentRow = ({ documentName }) => (
  <div className="flex items-center justify-between rounded-xl border border-borderMain px-3 py-2 text-sm">
    <span className="text-textMain">{documentName}</span>
    <div className="flex items-center gap-2">
      <button className="rounded-lg border border-borderMain px-2 py-1 text-xs text-textSecondary hover:text-primary">
        View
      </button>
      <button className="rounded-lg border border-borderMain px-2 py-1 text-xs text-textSecondary hover:text-primary">
        Download
      </button>
    </div>
  </div>
);

export default DocumentRow;
