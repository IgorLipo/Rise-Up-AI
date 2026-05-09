"use client";

interface DuplicateInfo {
  fileName: string;
  existingFilename: string;
  existingPeriod: string;
}

interface Props {
  duplicate: DuplicateInfo;
  onResolve: (action: "replace" | "skip") => void;
}

export function DuplicateConfirmDialog({ duplicate, onResolve }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={() => onResolve("skip")} />

      {/* Dialog */}
      <div className="relative bg-white border border-zinc-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            This statement has already been uploaded
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            A statement covering the same period already exists in your account.
          </p>
        </div>

        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Existing:</span>
            <span className="text-zinc-900 font-medium truncate ml-4">{duplicate.existingFilename}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">New:</span>
            <span className="text-zinc-900 font-medium truncate ml-4">{duplicate.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Period:</span>
            <span className="text-zinc-900 ml-4">{duplicate.existingPeriod}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onResolve("replace")}
            className="flex-1 px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Replace existing
          </button>
          <button
            onClick={() => onResolve("skip")}
            className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Skip this file
          </button>
        </div>
      </div>
    </div>
  );
}
