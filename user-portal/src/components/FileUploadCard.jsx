import { useState } from "react";
import { FileText, UploadCloud } from "lucide-react";

const FileUploadCard = ({
  title,
  required = false,
  onFileSelected,
  accepted = ".pdf,.png,.jpg,.jpeg",
  helperText = "Drag and drop or click to upload",
  uploadedFile = null,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localFileName, setLocalFileName] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setLocalFileName(file.name);
    onFileSelected?.(file.name, file);
  };

  const uploadedFileName = uploadedFile?.name || localFileName;
  const hasUploadedFile = Boolean(uploadedFile?.name);

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition ${
        isDragging ? "ring-2 ring-[#1E40AF]/20" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files[0]);
      }}
    >
      <label className="block cursor-pointer">
        <p className="text-sm font-semibold text-[#0F172A]">
          {title} {required ? <span className="text-[#DC2626]">*</span> : null}
        </p>

        <div
          className={`mt-3 rounded-lg border-2 border-dashed p-4 text-center transition ${
            isDragging ? "border-[#1E40AF] bg-[#EFF6FF]" : "border-gray-200 bg-[#F8FAFC]"
          }`}
        >
          <UploadCloud className="mx-auto text-[#64748B]" size={20} />
          <p className="mt-2 text-sm text-[#0F172A]">Upload File</p>
          <p className="text-xs text-[#64748B]">{helperText}</p>

          {uploadedFileName ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#ECFDF3] px-3 py-1">
              <FileText size={14} className="text-[#16A34A]" />
              <span className="text-xs font-medium text-[#16A34A]">
                {hasUploadedFile ? "Already Uploaded" : "Uploaded"}: {uploadedFileName}
              </span>
            </div>
          ) : null}

          <p className="mt-3 text-xs font-semibold text-[#1E40AF]">
            {uploadedFileName ? "Replace" : "Upload"}
          </p>
        </div>

        <input
          type="file"
          accept={accepted}
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </label>
    </div>
  );
};

export default FileUploadCard;
