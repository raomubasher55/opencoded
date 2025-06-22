# File Service API Documentation

This service provides API endpoints for file operations like reading, writing, listing, and searching files.

## API Endpoints

The file service exposes the following API endpoints:

- File operations: `http://localhost:4001/api/files`
- File watching: `http://localhost:4001/api/watch`
- Search: `http://localhost:4001/api/search`
- Health check: `http://localhost:4001/health`

## File Operations API

### List Files in a Directory

There are two ways to list files in a directory:

#### Method 1: Using the operation endpoint (POST)

```bash
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:4001/api/files/operation" \
  -d '{"operation":"list","path":"/path/to/directory"}'
```

#### Method 2: Using the list endpoint (GET)

```bash
curl -X GET "http://localhost:4001/api/files/list//path/to/directory"
```

Note: The double slash after `list/` is important for absolute paths.

### Read a File

```bash
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:4001/api/files/operation" \
  -d '{"operation":"read","path":"/path/to/file.txt"}'
```

### Write to a File

```bash
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:4001/api/files/operation" \
  -d '{"operation":"write","path":"/path/to/file.txt","content":"File content here"}'
```

### Delete a File or Directory

```bash
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:4001/api/files/operation" \
  -d '{"operation":"delete","path":"/path/to/file.txt"}'
```

For directories with recursive deletion:

```bash
curl -X POST -H "Content-Type: application/json" \
  "http://localhost:4001/api/files/operation" \
  -d '{"operation":"delete","path":"/path/to/directory","options":{"recursive":true}}'
```

## Standalone Directory Listing Scripts

We've created user-friendly scripts for listing directories through the File Service API:

### Interactive File Listing Script (Node.js)

The `list_files_script.js` provides a colorful, interactive way to browse directories:

```bash
# Linux/WSL
node list_files_script.js [path/to/directory]

# Or make it executable
chmod +x list_files_script.js
./list_files_script.js [path/to/directory]
```

Features:
- Colorized output with file type highlighting
- Interactive mode for browsing multiple directories
- Human-readable file sizes
- Automatic directory/file sorting

### Windows Batch Script

For Windows users, `list_files_script.bat` provides similar functionality:

```
list_files_script.bat [path\to\directory]
```

## API Testing Scripts

Two scripts are provided to test all file service API endpoints:

### Linux/WSL (Bash)

```bash
./list_clientsocket_files.sh
```

### Windows (Batch)

```
list_clientsocket_files.bat
```

These scripts test various API endpoints for listing files in the `/mnt/d/clientsocket` (or `D:\clientsocket` on Windows) directory.

## Path Formatting

- When using Unix-style paths (e.g., `/mnt/d/clientsocket`), make sure to properly URL encode slashes.
- For GET endpoints with absolute paths, use a double slash after the endpoint: `/api/files/list//absolute/path`.
- For Windows paths, you can use forward slashes (e.g., `D:/clientsocket`).

## Authentication

Authentication has been temporarily bypassed for testing purposes. In production, you would need to include a valid JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" [other options]
```

## Allowed Paths

For security reasons, the file service restricts access to certain directories. By default, it allows:

1. The current working directory
2. `/mnt/d` (WSL mount point for Windows D: drive)
3. `D:\` (Windows D: drive)

For testing purposes, the following directories have been explicitly allowed:
- `/mnt/d/clientsocket` (and Windows equivalent)
- `/mnt/d/CreativePro3DExtractor` (and Windows equivalent)

Additional allowed paths can be specified through the `ALLOWED_FILE_PATHS` environment variable as a comma-separated list.

## CLI Integration

The OpenCoded CLI has been enhanced with a new `list` command that uses the File Service API:

```bash
# Build and install the CLI
cd /mnt/d/opencode/cli
npm run build
npm link

# Use the list command
opencoded list [path/to/directory]
```

This command provides a rich, colorful directory listing using the File Service API.