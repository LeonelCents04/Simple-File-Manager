// messages.js - every user-visible sentence (sections 8 and 10). Pure: no Node, no DOM.

const VERB = { create: 'create', read: 'open', append: 'append to', rename: 'rename', delete: 'delete', info: 'show' };

// Plain-words reasons for "Something went wrong" (raw codes go to the log panel only).
const REASON = {
  ENOSPC: 'disk full', EDQUOT: 'disk quota reached', EBUSY: 'the file is in use', EMFILE: 'too many files open',
  EIO: 'a disk error', EROFS: 'the disk is read-only', ETIMEDOUT: 'the drive did not respond',
};

/** op: create | read | append | rename | delete | info; result: FmResult. */
export function formatError(op, name, r) {
  const verb = VERB[op] || op;
  switch (r.code) {
    case 'FM_ERR_EXISTS':
      return op === 'rename' ? 'Cannot rename: "' + name + '" already exists.' : 'Cannot create "' + name + '": it already exists. Nothing was changed.';
    case 'FM_ERR_NOT_FOUND':
      return op === 'create' ? 'Cannot create "' + name + '": that folder does not exist.'
        : 'Cannot ' + verb + ' "' + name + '": it no longer exists. The list has been refreshed.';
    case 'FM_ERR_PERMISSION': return 'Cannot ' + verb + ' "' + name + '": it is read-only.';
    case 'FM_ERR_IS_DIR': return 'Cannot ' + verb + ' "' + name + '": it is a folder.';
    case 'FM_ERR_BINARY': return '"' + name + '" is a binary file, so it cannot be shown as text.';
    case 'FM_ERR_CROSS_DEVICE': return 'Cannot rename across drives.';
    case 'FM_ERR_PATH_TOO_LONG': return 'Cannot ' + verb + ' "' + name + '": the path is 260 characters or longer.';
    case 'FM_ERR_INVALID_NAME': return 'Cannot ' + verb + ' "' + name + '": ' + r.detail;
    default: {
      const why = REASON[r.sysErrno] || (r.code === 'FM_ERR_NO_SPACE' ? 'disk full' : '');
      return 'Something went wrong while trying to ' + verb + ' "' + name + '".' + (why ? ' (' + why + ')' : '');
    }
  }
}

export function successText(op, name, extra) {
  switch (op) {
    case 'create': return 'Created "' + name + '" (' + extra + ' bytes).';
    case 'append': return 'Appended ' + extra + ' bytes to "' + name + '".';
    case 'rename': return 'Renamed "' + name + '" to "' + extra + '".';
    case 'delete': return 'Deleted "' + name + '".';
    case 'refresh': return 'Refreshed.';
    default: return '';
  }
}

/** Live hint lines under the name field (New and Rename sheets). */
export const HINT = {
  idle: 'Enter a file name or a path.',
  available: (where) => 'Available at ' + where,
  noFolder: 'That folder does not exist.',
  tooLong: 'That path is 260 characters or longer.',
  sameName: 'That is the current name.',
  caseOnly: 'Changing only the capital letters is fine.',
  exists: (name, mode) => '"' + name + '" already exists. ' + (mode === 'rename' ? 'Renaming' : 'Creating') + ' never replaces a file.',
  currentSize: (size) => 'Current size is ' + size + '.',
};

export const INFO = {
  selectFirst: 'Select a file first.',
  folderOpenFailed: (name) => 'Cannot open the folder "' + name + '".',
  empty: 'This folder is empty',
  emptyHint: 'Press N to create a file.',
  noSelection: 'Select a file to see its details here.',
  binaryPreview: 'This is a binary file, so there is no text preview.',
  truncated: (n) => 'Showing the first 1 MiB of ' + n + ' bytes.',
  safe: 'Nothing is overwritten without asking',
  driveSpace: (free, total) => free + ' free of ' + total,
  driveFree: (free) => free + ' free',
};
