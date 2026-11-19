import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message }) => {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
      <div>
        <p className="font-semibold">Invalid Parameter Configuration</p>
        <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-300">{message}</p>
      </div>
    </div>
  );
};
