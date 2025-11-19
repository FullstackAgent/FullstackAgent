/**
 * useFileUpload Hook
 *
 * Custom hook for handling file uploads to FileBrowser service.
 * Provides seamless file upload functionality with progress tracking and toast notifications.
 *
 * Features:
 * - Batch file upload support
 * - Progress tracking with callbacks
 * - Automatic toast notifications
 * - Clipboard integration
 * - Error handling
 *
 * @example
 * ```tsx
 * const { uploadFiles, isUploading } = useFileUpload({
 *   fileBrowserUrl: 'https://...',
 *   fileBrowserUsername: 'admin',
 *   fileBrowserPassword: 'password',
 * });
 *
 * await uploadFiles([file1, file2]);
 * ```
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface FileUploadConfig {
  fileBrowserUrl?: string;
  fileBrowserUsername?: string;
  fileBrowserPassword?: string;
  enabled?: boolean;
}

export interface UploadOptions {
  /** Show toast notifications during upload */
  showToast?: boolean;
  /** Copy path to clipboard after successful upload */
  copyToClipboard?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useFileUpload(config: FileUploadConfig) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completed: number;
    total: number;
    currentFile: string;
  } | null>(null);

  // Keep refs for stable callbacks
  const uploadToastIdRef = useRef<string | number | null>(null);

  // Check if upload is properly configured
  const isConfigured = Boolean(
    config.enabled !== false &&
      config.fileBrowserUrl &&
      config.fileBrowserUsername &&
      config.fileBrowserPassword
  );

  /**
   * Upload multiple files to FileBrowser
   */
  const uploadFiles = useCallback(
    async (
      files: File[],
      options: UploadOptions = {
        showToast: true,
        copyToClipboard: true,
      }
    ) => {
      // Validation
      if (!isConfigured) {
        if (options.showToast) {
          toast.error('File upload not configured', {
            description: 'FileBrowser credentials are missing',
          });
        }
        throw new Error('File upload not configured');
      }

      if (files.length === 0) {
        return;
      }

      // Start upload
      setIsUploading(true);
      setUploadProgress({ completed: 0, total: files.length, currentFile: '' });

      // Show initial toast
      if (options.showToast) {
        uploadToastIdRef.current = toast.loading(`Uploading ${files.length} file(s)...`, {
          description: 'Please wait',
        });
      }

      try {
        // Dynamic import for tree-shaking
        const { uploadFilesToFileBrowser, copyToClipboard, formatFileSize } = await import(
          '@/lib/util/filebrowser'
        );

        // Upload with progress tracking
        const result = await uploadFilesToFileBrowser(
          config.fileBrowserUrl!,
          config.fileBrowserUsername!,
          config.fileBrowserPassword!,
          files,
          (completed: number, total: number, currentFile: string) => {
            setUploadProgress({ completed, total, currentFile });

            // Update loading toast
            if (options.showToast && uploadToastIdRef.current) {
              toast.loading(`Uploading ${completed}/${total} files...`, {
                id: uploadToastIdRef.current,
                description: currentFile ? `Current: ${currentFile}` : 'Processing...',
              });
            }
          }
        );

        // Dismiss loading toast
        if (options.showToast && uploadToastIdRef.current) {
          toast.dismiss(uploadToastIdRef.current);
          uploadToastIdRef.current = null;
        }

        // Handle results
        if (result.succeeded.length > 0) {
          const totalSize = result.succeeded.reduce((sum, r) => sum + r.size, 0);
          const pathToCopy =
            result.succeeded.length === 1 ? result.succeeded[0].path : result.rootPath;

          // Copy to clipboard
          let clipboardSuccess = false;
          if (options.copyToClipboard) {
            try {
              await copyToClipboard(pathToCopy);
              clipboardSuccess = true;
            } catch (error) {
              console.warn('[useFileUpload] Failed to copy to clipboard:', error);
            }
          }

          // Show success toast with clipboard feedback
          if (options.showToast) {
            if (result.failed.length === 0) {
              // All succeeded
              if (result.succeeded.length === 1) {
                const file = result.succeeded[0];
                const clipboardHint = clipboardSuccess ? ' • Path copied!' : '';
                toast.success('File uploaded', {
                  description: `${file.filename} (${formatFileSize(file.size)}) • ${pathToCopy}${clipboardHint}`,
                  duration: 5000,
                });
              } else {
                const clipboardHint = clipboardSuccess ? ' • Path copied!' : '';
                toast.success(`${result.succeeded.length} files uploaded`, {
                  description: `Total: ${formatFileSize(totalSize)} • ${pathToCopy}${clipboardHint}`,
                  duration: 5000,
                });
              }
            } else {
              // Partial success
              const failedNames = result.failed.map((f) => f.filename).join(', ');
              const clipboardHint = clipboardSuccess ? ' • Path copied!' : '';
              toast.warning(`Uploaded ${result.succeeded.length} of ${result.total} files`, {
                description: `${formatFileSize(totalSize)} uploaded • Failed: ${failedNames}${clipboardHint}`,
                duration: 6000,
              });
            }
          }
        } else {
          // All failed
          if (options.showToast) {
            toast.error('Upload failed', {
              description:
                result.failed.length > 0
                  ? `Error: ${result.failed[0].error}`
                  : 'Unknown error occurred',
              duration: 5000,
            });
          }
        }

        return result;
      } catch (error) {
        console.error('[useFileUpload] Upload error:', error);

        if (options.showToast) {
          if (uploadToastIdRef.current) {
            toast.dismiss(uploadToastIdRef.current);
            uploadToastIdRef.current = null;
          }
          toast.error('Upload failed', {
            description: error instanceof Error ? error.message : 'Unknown error',
            duration: 5000,
          });
        }

        throw error;
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [isConfigured, config.fileBrowserUrl, config.fileBrowserUsername, config.fileBrowserPassword]
  );

  return {
    uploadFiles,
    isUploading,
    uploadProgress,
    isConfigured,
  };
}
