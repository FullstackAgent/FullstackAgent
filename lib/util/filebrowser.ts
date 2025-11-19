/**
 * FileBrowser API Utilities
 *
 * FileBrowser integration for file uploads via TUS protocol (Tus Resumable Upload).
 * Authentication uses JWT tokens with X-Auth header (not Basic Auth).
 *
 * Flow:
 * 1. Login: POST /api/login → Get JWT token
 * 2. Upload: TUS protocol via /api/tus/{filename}?override=false
 * 3. Files are uploaded to FileBrowser root directory (/)
 */

export { copyToClipboard } from './common-web'

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  /** Full path of uploaded file (e.g., /image.png) */
  path: string
  /** Original filename */
  filename: string
  /** File size in bytes */
  size: number
  /** Whether file is an image */
  isImage: boolean
}

export interface UploadBatchResult {
  /** Successfully uploaded files */
  succeeded: UploadResult[]
  /** Failed uploads with error messages */
  failed: Array<{ filename: string; error: string }>
  /** Total number of files attempted */
  total: number
  /** Whether all successful uploads are images */
  allImages: boolean
  /** Root path containing all uploaded files (always "/" for FileBrowser) */
  rootPath: string
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Login to FileBrowser and get JWT token
 *
 * @param fileBrowserUrl - Base URL of FileBrowser (e.g., https://example.com)
 * @param username - FileBrowser username
 * @param password - FileBrowser password
 * @returns JWT token for subsequent API calls
 * @throws Error if login fails
 */
export async function loginToFileBrowser(
  fileBrowserUrl: string,
  username: string,
  password: string
): Promise<string> {
  const response = await fetch(`${fileBrowserUrl}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      recaptcha: '',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Login failed (${response.status}): ${errorText}`)
  }

  // FileBrowser returns JWT token as plain text
  const token = await response.text()
  return token
}

// ============================================================================
// File Upload (TUS Protocol)
// ============================================================================

/**
 * Upload a single file to FileBrowser using TUS protocol
 *
 * TUS (Tus Resumable Upload) protocol:
 * - POST /api/tus/{filename}?override=false - Create upload session
 * - PATCH /api/tus/{filename} - Upload file content in chunks
 *
 * @param fileBrowserUrl - Base URL of FileBrowser
 * @param token - JWT token from loginToFileBrowser()
 * @param file - File to upload
 * @returns Upload result with file path and metadata
 * @throws Error if upload fails
 */
export async function uploadFileToFileBrowser(
  fileBrowserUrl: string,
  token: string,
  file: File
): Promise<UploadResult> {
  // Dynamic import for client-side only (tus-js-client uses browser APIs)
  const tus = await import('tus-js-client')

  // FileBrowser TUS endpoint format: /api/tus/{filename}?override=false
  // Filename must be in URL, not in metadata
  const encodedFilename = encodeURIComponent(file.name)
  const tusEndpoint = `${fileBrowserUrl}/api/tus/${encodedFilename}?override=false`

  return new Promise<UploadResult>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      headers: {
        'X-Auth': token,
      },
      chunkSize: 5 * 1024 * 1024, // 5MB chunks for large files
      retryDelays: [0, 1000, 3000, 5000], // Retry on failure
      onError: (error) => {
        reject(new Error(`Upload failed: ${error.message}`))
      },
      onSuccess: () => {
        // FileBrowser uploads to root directory
        const uploadedPath = `/${file.name}`
        resolve({
          path: uploadedPath,
          filename: file.name,
          size: file.size,
          isImage: isImageFile(file),
        })
      },
    })

    upload.start()
  })
}

/**
 * Upload multiple files with automatic login and progress tracking
 *
 * @param fileBrowserUrl - Base URL of FileBrowser
 * @param username - FileBrowser username
 * @param password - FileBrowser password
 * @param files - Array of files to upload
 * @param onProgress - Optional callback for upload progress
 * @returns Batch upload result with succeeded/failed files
 */
export async function uploadFilesToFileBrowser(
  fileBrowserUrl: string,
  username: string,
  password: string,
  files: File[],
  onProgress?: (completed: number, total: number, currentFile: string) => void
): Promise<UploadBatchResult> {
  // Login once and reuse token for all uploads
  const token = await loginToFileBrowser(fileBrowserUrl, username, password)

  const succeeded: UploadResult[] = []
  const failed: Array<{ filename: string; error: string }> = []
  const total = files.length

  // Upload files sequentially to avoid overwhelming the server
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress?.(i, total, file.name)

    try {
      const result = await uploadFileToFileBrowser(fileBrowserUrl, token, file)
      succeeded.push(result)
    } catch (error) {
      failed.push({
        filename: file.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Final progress update
  onProgress?.(total, total, '')

  const allImages = succeeded.length > 0 && succeeded.every((r) => r.isImage)

  return {
    succeeded,
    failed,
    total,
    allImages,
    rootPath: '/', // FileBrowser uploads to root directory
  }
}

// ============================================================================
// File Type Detection
// ============================================================================

/**
 * Check if file is an image based on MIME type
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

// ============================================================================
// File Size Formatting
// ============================================================================

/**
 * Format file size in human-readable format (Bytes, KB, MB, GB)
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536) // "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// ============================================================================
// Drag & Drop / Clipboard Support
// ============================================================================

/**
 * Extract files from DataTransfer (drag & drop or paste events)
 *
 * Handles:
 * - Single files
 * - Multiple files
 * - Directories (recursively)
 *
 * @param dataTransfer - DataTransfer from drag/drop or paste event
 * @returns Array of File objects
 */
export async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []

  // Process file system entries (supports directories)
  async function processEntry(entry: FileSystemEntry, basePath: string = ''): Promise<void> {
    if (entry.isFile) {
      // Extract file from FileSystemFileEntry
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })

      // Preserve directory structure in filename if in subdirectory
      if (basePath) {
        const path = `${basePath}/${file.name}`
        const newFile = new File([file], path, { type: file.type })
        files.push(newFile)
      } else {
        files.push(file)
      }
    } else if (entry.isDirectory) {
      // Recursively process directory entries
      const dirEntry = entry as FileSystemDirectoryEntry
      const reader = dirEntry.createReader()

      let allEntries: FileSystemEntry[] = []
      let entries: FileSystemEntry[]

      // Read all entries (may require multiple calls)
      do {
        entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject)
        })
        allEntries = allEntries.concat(entries)
      } while (entries.length > 0)

      // Process subdirectories recursively
      const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name
      for (const childEntry of allEntries) {
        await processEntry(childEntry, newBasePath)
      }
    }
  }

  // Try to use FileSystem API (supports directories)
  if (dataTransfer.items) {
    const items = Array.from(dataTransfer.items)
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.()
      if (entry) {
        await processEntry(entry)
      }
    }
  }

  // Fallback to simple file list (no directory support)
  if (files.length === 0 && dataTransfer.files) {
    files.push(...Array.from(dataTransfer.files))
  }

  return files
}
