# Simple File Management System — Project Structure & Build Prompt (v2, glass UI)

A **menu-driven file manager** with a modern, minimalist **glassmorphism** interface. It supports **create, read, append, rename, delete** with file information, existence checks, error checks, and protection against accidental overwriting.

The visual and behavioral source of truth is **`UI_MOCKUP_GLASS.html`** in this folder (open it in a browser and try it). This document turns that mockup into a buildable plan.

> **What changed from v1**
> v1 described a DOS-style dual-pane text interface (C + PDCurses). It is kept as `PROJECT_STRUCTURE_C-TUI_v1.md` and `UI_MOCKUP.html`. Real blur and transparency cannot be drawn in a text console, so v2 moves to a windowed app. The **file-handling rules, error codes, validation, safety table and tests are unchanged**. Only the interface, toolkit, folder layout, key bindings and prompt changed.

> **How to use this file**
> 1. Read sections 1–12 (the design) and open `UI_MOCKUP_GLASS.html` next to it.
> 2. Check the **Decisions** table in section 2. **D1 (toolkit) is the one open decision.** Change it *before* starting if you disagree.
> 3. Open Claude Code in this folder and paste the prompt from **section 13**.

---

## 1. Spec (verbatim from the assignment)

**Description:** Develop a menu-driven application that allows users to create, read, append, rename, and delete files.

**Coding requirements**
- Create a menu for file operations.
- Accept a file name and, when appropriate, file content.
- Open and close files correctly.
- Check errors during file operations.
- Prevent accidental overwriting where possible.

**Inputs:** file names and paths; file content; commands for create, read, append, rename, and delete.

**Outputs:** file content displayed on screen; operation status and error messages; file information such as name and size when available.

**Key features:** create, read, append, rename, delete; file existence and error checks; menu-based navigation.

---

## 2. Decisions (edit these first)

These were not answered yet, so sensible defaults were chosen. Change them here **and** in the section 13 prompt if needed.

| # | Decision | Default | Why | Alternative |
|---|---|---|---|---|
| **D1** | **Toolkit** ⚠ **OPEN: please confirm** | **Electron + plain JavaScript (Node 20+)** | The mockup is already HTML/CSS/JS, so the glass look (`backdrop-filter`, themes, animations) is reused almost as written. Real blur, no workarounds. Node's `fs` exposes the exact flags the safety rules need (`O_EXCL`, `O_APPEND`). | **B:** Python 3 + PySide6 or CustomTkinter (simpler language, but real blur is hard and the look is an approximation). **C:** keep the C + PDCurses text UI from v1 (the glass look would be only an approximation with colors). **D:** C with a native GUI library (Win32/GTK), most work, no blur. |
| D2 | UI style | **Modern minimalist glassmorphism, menu-driven** | Your latest direction. | Plain numbered console menu as an extra mode (stretch, see section 11) |
| D3 | Platform | **Windows 10/11** (project folder is on `D:\`) | Matches your machine. Code avoids Windows-only calls except where noted. | Linux/macOS |
| D4 | Menu model | **Menu bar (File / Go / Help) + toolbar + right-click menu + keyboard shortcuts**, all calling the same actions | Satisfies "menu-driven" in three ways; one code path. | — |
| D5 | Scope | The 5 required operations + file info. Copy, New Folder, multi-select, drag-and-drop are **stretch goals**. | Required items must be finished and polished first. | — |
| D6 | Overwrite policy | **Never overwrite** in the core build. Create and Rename refuse existing targets. | Strongest reading of "prevent accidental overwriting". | Explicit "Replace?" flow as a stretch goal |
| D7 | Delete | **Files only, with a confirmation sheet; Cancel is the default.** | Matches the mockup and the safety rule. | Send to Recycle Bin (stretch) |
| D8 | Fonts | **Manrope** (UI) and **JetBrains Mono** (file text), **bundled locally** via `@fontsource` packages | The mockup loads Google Fonts, but the real app must work offline. System-font fallback stays. | System fonts only |
| D9 | Sizes and line endings | Files written on Windows use **CRLF**; the app strips `\r` for display. Sizes shown are real bytes on disk. | Files open correctly in Notepad. | — |

> If D1 changes, everything in sections 1, 3, 4 (behavior), 7, 8, 10, 12.1 (cases) stays valid. Only sections 5, 6 (syntax), 11 (M0), 14 and the prompt in 13 need edits. Appendix A lists what to swap.

---

## 3. Requirement traceability

Every line of the spec maps to something concrete. This table is also the grading checklist.

| Spec requirement | Implemented as | Where |
|---|---|---|
| Menu for file operations | **File** menu (New, Open, Append, Rename, Delete, File information, Refresh, Exit), **Go** menu, **Help** menu; toolbar buttons; right-click menu; shortcuts. All run the same actions. | `ui/menubar`, `ui/toolbar`, `ui/contextmenu`, `app` |
| Accept file name | **New** and **Rename** sheets with a name/path field and **live validation** (hint line under the field, action button disabled until valid) | `ui/sheets`, `fm_validate_path` |
| Accept file content | Text area in **New** and **Append** sheets, with a live byte counter | `ui/sheets` |
| Open and close files correctly | Every descriptor opened is closed in a `finally` block; close errors are checked | `file_ops` |
| Check errors during file operations | Every `open`/`read`/`write`/`fsync`/`close`/`rename`/`unlink` outcome is checked; the system error code is captured and mapped in one place | `file_ops` |
| Prevent accidental overwriting | Exclusive create (`O_EXCL`), append only to an existing file (no `O_CREAT`), rename refuses an existing target, delete needs confirmation (Cancel is default), live "already exists" hint before submit | `file_ops`, `ui/sheets` |
| Input: names and paths | Name field accepts a name or a relative/absolute path | `fm_validate_path` |
| Input: file content | New and Append text areas | `ui/sheets` |
| Input: commands | Menus, toolbar, shortcuts, double-click/Enter to open | `app` |
| Output: file content on screen | **Viewer sheet** with line numbers, size and line count chips; plus a 10-line **preview** in the details panel | `ui/sheets`, `ui/details` |
| Output: status and errors | **Toasts** for success/info/error; the sheet's own hint line for errors raised inside a dialog; status bar with item count | `ui/toasts`, `shared/messages` |
| Output: name, size, etc. | **Details panel** (name, kind, size in B/KB/MB and exact bytes, modified, location, read-only), plus Size and Modified columns | `ui/details`, `ui/list` |
| Existence checks | `fm_exists` / `fm_get_info` before every operation; stale-file handling (see 4.6) | `file_ops`, `app` |
| Menu-based navigation | Go menu (Up, Open demo folder, Open backup folder), folder tree, breadcrumbs, Up button | `ui/sidebar`, `ui/breadcrumbs` |

---

## 4. User interface

### 4.1 Layout (target window about 1240 x 780; minimum 900 x 580)

```
┌─ glass window, rounded 26px, drifting colour blobs behind ───────────────────────────────────────┐
│ SIDEBAR (216px)  │ MAIN (flexible)                                              │ DETAILS (296px) │
│                  │ File   Go   Help                           ← menu bar        │                 │
│ ◼ Files          │ D: › Projects › demo      [↑] [⟳]   [◐ theme] [log]   ─ □ ✕  │  ┌───┐          │
│                  │ [+ New file] [Open] [Append] [Rename] [Delete]  ← toolbar    │  │ ▢ │ notes.txt│
│ ▸ D:             │ ──────────────────────────────────────────────────────────── │  └───┘          │
│   ▸ Projects     │ Name                                  Size     Modified      │  [Text file]    │
│     ▾ demo  ◀cur │ 📁 archive                                     Jun 3, 2026…  │  Size   322 B   │
│       docs       │ 📁 docs                                        Oct 14, 2026… │  Modified …     │
│       archive    │ 📄 notes.txt  ◀ selected              322 B    Oct 17, 2026… │  Location …     │
│     ▸ backup     │ 📄 todo.txt                            81 B    Oct 16, 2026… │  Read-only  No  │
│                  │ …                                                            │  ┌ preview ───┐ │
│ (footer hint)    │                                                              │  │ first 10   │ │
│                  │                                                              │  │ lines      │ │
│                  │ ──────────────────────────────────────────────────────────── │  └────────────┘ │
│                  │ 9 items, 1 selected            🛡 Nothing is overwritten      │                 │
│                  │                                 without asking               │                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
 Overlays: sheets (dialogs, centered on a blurred scrim) · toasts (bottom) · menu / right-click popups
          · slide-over "Spec checklist & log" panel (right edge)
```

- **Sidebar:** brand mark and name, then a folder tree (drives and folders, indented 14px per level, current folder highlighted). Clicking a node navigates there. Footer shows a one-line hint.
- **Menu bar:** `File`, `Go`, `Help` (see 4.3). Opens on click, `Alt+F`/`Alt+G`/`Alt+H`, or `F10`.
- **Top row:** breadcrumbs (every segment clickable except the last), Up button (disabled at a root), Refresh, theme toggle, and the checklist/log button.
- **Toolbar:** New file (primary button), Open, Append, Rename, Delete. All except New are **disabled when nothing is selected**. Shortcut hints appear in tooltips, not on the buttons.
- **File list:** columns Name, Size, Modified. Folders sort first, then files, each A–Z case-insensitive. Folders show no size. Empty folder shows "This folder is empty — Press N to create a file." Single click selects; double-click or `Enter` opens; right-click opens the context menu on that row.
- **Details panel:** icon tile, name, chips (`Text file` / `Binary file` / `Folder`, plus `Read-only` when set), then Size, Modified, Location, Read-only, then a preview. Folders show "N items inside"; binary files show "This is a binary file, so there is no text preview."; nothing selected shows "Select a file to see its details here."
- **Status bar:** `N items` (+ `, 1 selected`) on the left; shield icon with "Nothing is overwritten without asking" on the right.

### 4.2 Visual language (minimalist glass)

- **Material:** translucent panels with `backdrop-filter: blur(26px) saturate(165%)`, a 1px light border, and an inner top highlight. Sheets use a more opaque tint for legibility. The scrim behind a sheet blurs by 8px.
- **Background:** a soft two-color gradient with three large blurred "blobs" that drift slowly (30–45 s loops). The blobs give the blur something to work with.
- **Restraint:** one accent color, no gradients on controls (except the small brand mark), no heavy shadows on rows, generous spacing, 10–14px corner radii on controls, 26px on the window.
- **Type:** Manrope for UI (400/500/600/700), JetBrains Mono for file text (viewer, preview, editors).
- **Themes:** light and dark, following the OS by default, with a manual toggle that overrides. Tokens below.
- **Status colors:** green = success, red = error, amber = warning/read-only. Always paired with an icon and words, never color alone.

**Design tokens** (copy from the `:root` block of `UI_MOCKUP_GLASS.html`; do not invent new values)

| Token | Light | Dark |
|---|---|---|
| `--bg1` / `--bg2` | `#eaf0ff` / `#fdeee3` | `#080c1c` / `#1a1240` |
| `--blob1/2/3` | `#8ea6ff` / `#79e0d0` / `#ffc49a` | `#4a66ff` / `#14c9a8` / `#e8795a` |
| `--glass` / `--glass-2` | `rgba(255,255,255,.50)` / `.30` | `rgba(255,255,255,.075)` / `.045` |
| `--sheet` | `rgba(255,255,255,.78)` | `rgba(26,30,56,.70)` |
| `--text` / `--muted` / `--faint` | `#161b36` / 66% / 44% | `#eef0fa` / 68% / 42% |
| `--accent` / `--accent-ink` | `#4357d8` / `#fff` | `#9bacff` / `#080c1c` |
| `--ok` / `--err` / `--warn` / `--danger` | `#0f7a45` / `#c3303f` / `#8f6200` / `#d03a49` | `#6be8a8` / `#ff8793` / `#ffd079` / `#ff6b7a` |

**Fallbacks that must exist**
- `@supports not (backdrop-filter: blur(1px))`: use the solid `--glass-solid` color instead.
- `prefers-reduced-transparency: reduce`: solid panels, no blur.
- `prefers-reduced-motion: reduce`: stop the blob drift and sheet animations.
- Text contrast of at least 4.5:1 against the *worst-case* background in both themes (check muted text over the brightest and darkest blob area).
- Visible `:focus-visible` outline (2px accent) on every control. Full keyboard operation. Dialogs trap Tab; Esc closes; focus returns to what opened them.

### 4.3 Menus

| Menu | Items (shortcut) |
|---|---|
| **File** | New file `N` · Open `Enter` · Append `A` · Rename `F2` · Delete `Del` (danger style) · — · File information `I` · Refresh `F5` · — · Exit |
| **Go** | Up one folder `Backspace` · — · Open demo folder · Open backup folder |
| **Help** | Keyboard shortcuts · Spec checklist |

- Items that need a selected file (**Open, Append, Rename, Delete, File information**) are **disabled** when nothing is selected.
- Menu keys: `Alt+F` / `Alt+G` / `Alt+H` or `F10` opens; `←`/`→` moves between menus; `↑`/`↓` moves in a menu; `Enter` runs; `Esc` closes and returns focus to the menu button; `Tab` closes it.
- **Right-click menu** on a file row: Open `Enter`, Append `A`, Rename `F2`, —, Delete `Del`.
- **"Open demo folder / Open backup folder"** are mockup conveniences. In the real app, replace them with **Open folder…** (native folder picker) and a short **Recent folders** list. Keep the Go menu's Up item.

### 4.4 Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New file |
| `Enter` | Folder: enter it. File: Open (viewer) |
| `A` | Append to the selected file |
| `F2` | Rename the selected file |
| `Delete` | Delete the selected file (confirmation sheet) |
| `Backspace` | Up one folder |
| `I` | File information |
| `F5` | Refresh |
| `↑` `↓` `Home` `End` | Move the selection in the list (`PgUp`/`PgDn` are an addition for the real app) |
| `Alt+F` / `Alt+G` / `Alt+H`, `F10` | Open a menu |
| `Esc` | Close the menu, sheet or panel |
| `Ctrl+Enter` | Submit in a multi-line text area (New, Append) |

Single-letter shortcuts are ignored while a text field or sheet has focus.

### 4.5 Sheets (dialogs)

All sheets are centered glass cards on a blurred scrim, with a title (`aria-labelledby`), `role="dialog"`, `aria-modal`, focus trap, and Esc to cancel.

| Sheet | Contents | Rules |
|---|---|---|
| **New file** | Name/path field, optional content text area with live byte count, hint line, Cancel + **Create** | Create is **disabled until the name passes live validation**. Hint states: idle ("Enter a file name or a path."), ok ("Available at D:\\…"), error (reason). Ctrl+Enter submits. Empty content creates a 0-byte file. |
| **Open (viewer)** | Title = file name; chips: size, line count, `Read-only` if set; scrollable code area with line numbers (mono, no wrapping of the number column) | Read-only view. `\r` stripped, tabs shown as 4 spaces. If truncated: banner "Showing the first 1 MiB of N bytes." Close is the focused default. |
| **Append** | "Append to *name*"; text area with live byte count; hint ("Current size is …"); Cancel + **Append** | Append is disabled while the text is empty. Opening the sheet already checks: file exists, is not a folder, is not read-only. The existing content is never shown as editable. |
| **Rename** | Field prefilled with the current name (stem selected); hint; Cancel + **Rename** | Same live validation as New. "That is the current name." keeps the button disabled. Changing only capitals is allowed ("Changing only the capital letters is fine."). |
| **Delete** | Warning icon; "Delete "*name*"?"; "*size*, last changed *date*. This cannot be undone."; **Cancel (focused)** + **Delete file** (danger) | **Cancel is the default.** Esc cancels. Checks happen *before* the sheet: a folder or read-only file shows an error toast instead of the confirmation. |
| **File information** | Same facts as the details panel, in a sheet | Reachable from File → File information or `I`. |
| **Keyboard shortcuts** | Table from 4.4 | — |
| **Exit** | "Close Files?" "Every change is already saved. Nothing is waiting to be written." Stay (focused) + Close app | Nothing is buffered, so exit is always safe. |

### 4.6 Behavior details

- **Toasts:** appear at the bottom, auto-dismiss after about 3.4 s (errors about 6.5 s), can be dismissed, stack up to 3, and use `role="status"` (errors: `role="alert"`).
- **Where errors go:** an error raised while a sheet is open is shown **inside the sheet's hint line** (the user can fix it and retry). An error raised from a menu/shortcut with no sheet open becomes an **error toast**.
- **After every successful operation:** the list refreshes and the selection moves to the affected file (after delete: the next row at the same position, or the last row).
- **Stale files:** if a file was deleted or renamed outside the app, any operation on it fails with `FM_ERR_NOT_FOUND`, shows `Cannot open "x": it no longer exists. The list has been refreshed.`, refreshes the list, and **never re-creates** the file.
- **Spec checklist and log (slide-over panel, Help → Spec checklist or the log button):** a 10-item checklist that ticks itself as the user performs each requirement (create, read, append, rename, delete with confirmation, file information, overwrite blocked, bad name rejected, missing-file check, menu navigation) with a progress bar, plus a live log of `file_ops` calls (name, arguments, result code, newest first, last 40). This is a grading aid; it must be removable with one flag (`SHOW_SPEC_PANEL`). *Mockup only:* the "Simulate outside delete" and "Reset demo" buttons. In the real app, step 8 of the test script does the outside delete in File Explorer.

### 4.7 Mockup-to-app notes

`UI_MOCKUP_GLASS.html` simulates a disk in memory. The real app replaces only the `fm_*` simulated functions with calls into `file_ops` (through IPC). Everything else (markup, tokens, sheets, validation hints, menus, shortcuts, toasts, messages) should be ported as is. Copy the message strings from section 10 and the validation messages from section 8.

---

## 5. Architecture

### 5.1 The one rule that matters

> **`file_ops` never prints, never touches the UI, and never asks the user anything.**
> It takes plain arguments and returns a result object. The UI turns result codes into messages.

Why: the file logic can be tested on its own, and the error handling is easy to point at when the work is graded.

### 5.2 Layers (default toolkit D1: Electron)

```
┌─────────────────────────────────────────────────────────────┐
│ RENDERER (sandboxed web page, no Node access)               │
│   ui/*     draw menubar, list, details, sheets, toasts      │  decides HOW it looks
│   app.js   state + shortcut/menu → action flows             │  decides WHAT happens
│   shared/messages.js   result code → human text             │
├──────────────── contextBridge (preload.js) ─────────────────┤
│   window.fm.{info, exists, list, create, read, append,      │  narrow, typed API
│              rename, delete, pickFolder}                    │
├──────────────── IPC (ipcMain.handle) ───────────────────────┤
│ MAIN (Node)                                                  │
│   main.js     window, theme, single instance                │
│   ipc.js      argument-type checks, calls file_ops          │
│   file_ops.js · fs_scan.js · validate.js · status.js · util │  NO UI below this line
└─────────────────────────────────────────────────────────────┘
```

Security (Electron): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a strict Content-Security-Policy (`default-src 'self'`; no remote scripts, fonts or images), `webSecurity` left on, no `remote` module, navigation and `window.open` blocked. The renderer never touches `fs`. Every IPC handler validates the *types* of its arguments before use.

### 5.3 Folder layout

```
Simple File Management System/
├── PROJECT_STRUCTURE.md           this file (v2, glass UI)
├── PROJECT_STRUCTURE_C-TUI_v1.md  the earlier text-window plan (kept for reference)
├── UI_MOCKUP_GLASS.html           visual + behavior spec (open in a browser)
├── UI_MOCKUP.html                 v1 text-window mockup (reference only)
├── README.md                      how to install, run, use (written at the end)
├── package.json                   scripts: start, test, lint
├── src/
│   ├── main/
│   │   ├── main.js                create window, apply theme, app lifecycle
│   │   ├── ipc.js                 ipcMain handlers → file_ops (checks argument types)
│   │   ├── file_ops.js            create, read, append, rename, delete, exists, info   (NO UI)
│   │   ├── fs_scan.js             list a directory into sorted entries                 (NO UI)
│   │   ├── validate.js            fm_validate_path and reserved-name logic             (NO UI)
│   │   ├── status.js              FmStatus codes + errno → FmStatus (one helper)       (NO UI)
│   │   └── util.js                path helpers, byte formatting, safe string helpers
│   ├── preload/
│   │   └── preload.js             contextBridge: window.fm.* (only what the UI needs)
│   ├── shared/
│   │   └── messages.js            code → message text, used by the renderer (and tests)
│   └── renderer/
│       ├── index.html             markup shell + CSP
│       ├── styles/tokens.css      the design tokens from 4.2
│       ├── styles/app.css         layout, glass, components, fallbacks
│       ├── fonts/                 bundled Manrope + JetBrains Mono (from @fontsource)
│       ├── app.js                 state, selection, action flows, shortcuts
│       └── ui/
│           ├── sidebar.js         folder tree
│           ├── breadcrumbs.js     breadcrumbs, Up, Refresh, theme toggle
│           ├── menubar.js         File/Go/Help menus + keyboard handling
│           ├── toolbar.js         toolbar buttons (enabled/disabled state)
│           ├── list.js            file list rows
│           ├── details.js         details panel + preview
│           ├── sheets.js          New, Open, Append, Rename, Delete, Info, Keys, Exit
│           ├── toasts.js          toasts + status bar
│           ├── contextmenu.js     right-click menu
│           └── specpanel.js       checklist + log slide-over (flag-gated)
├── tests/
│   ├── file_ops.test.js           uses node:test, real temp folders
│   ├── validate.test.js
│   ├── fs_scan.test.js
│   ├── messages.test.js
│   └── e2e.test.js                (stretch) Playwright-for-Electron flows
└── docs/
    ├── DECISIONS.md               every assumption the builder had to make
    └── TEST_PLAN.md               manual test script + results
```

---

## 6. Module specifications

Types are shown as JSDoc. The status codes are the same ones the v1 plan used, so the test list carries over.

### 6.1 `status.js` and `file_ops.js` (the core)

```js
/** @typedef {'FM_OK'|'FM_ERR_INVALID_ARG'|'FM_ERR_INVALID_NAME'|'FM_ERR_PATH_TOO_LONG'|
 *  'FM_ERR_NOT_FOUND'|'FM_ERR_EXISTS'|'FM_ERR_PERMISSION'|'FM_ERR_IS_DIR'|'FM_ERR_NOT_REGULAR'|
 *  'FM_ERR_TOO_LARGE'|'FM_ERR_BINARY'|'FM_ERR_NO_SPACE'|'FM_ERR_CROSS_DEVICE'|'FM_ERR_IO'|
 *  'FM_ERR_CANCELLED'} FmStatus */

/** @typedef {{ code: FmStatus, sysErrno: string|null, detail?: string, data?: any }} FmResult
 *  sysErrno holds the Node error code ('EEXIST', 'ENOENT', 'EPERM', …) captured at the failure point. */

/** @typedef {{ name:string, path:string, size:number, mtimeMs:number,
 *             isDir:boolean, isReadOnly:boolean }} FmFileInfo */

/** @typedef {{ text:string, bytes:number, truncated:boolean, looksBinary:boolean }} FmContent */

fm_validate_path(path)                    // -> FmResult   syntax checks only, no disk access
fm_get_info(path)                         // -> FmResult<FmFileInfo>   FM_ERR_NOT_FOUND if absent
fm_exists(path)                           // -> boolean
fm_create(path, content)                  // -> FmResult   content is a string, may be ''
fm_read(path, maxBytes = 1_048_576)       // -> FmResult<FmContent>
fm_append(path, content)                  // -> FmResult
fm_rename(oldPath, newPath)               // -> FmResult
fm_delete(path)                           // -> FmResult
```

The functions are **synchronous and run in the main process** (`fs.*Sync`). That keeps the cleanup logic simple and obvious (`try / finally`). Files are small (1 MiB cap). Do not use callbacks or unawaited promises for the core.

**Rules for every function**
- Validate argument *types* first (`typeof path === 'string'`, non-empty). Never assume.
- Do the cheap checks that need no open first (name syntax, length).
- Every descriptor opened (`fs.openSync`) is closed in a `finally` block, **and the close is checked**: a failed close after a write means data may be lost, so report it as `FM_ERR_IO`. `fs.fsyncSync` before close for writes.
- Handle **partial writes**: loop on `fs.writeSync` until all bytes are written.
- Capture the error code at the catch site (`err.code`) and translate it in **one** helper, `statusFromErrno(code)`: `ENOENT`→NOT_FOUND, `EEXIST`→EXISTS, `EACCES`/`EPERM`/`EROFS`→PERMISSION, `EISDIR`→IS_DIR, `ENOSPC`/`EDQUOT`→NO_SPACE, `EXDEV`→CROSS_DEVICE, `ENAMETOOLONG`→PATH_TOO_LONG, `ENOTDIR`→NOT_FOUND, anything else→IO.
- Use `fs.constants` flags explicitly rather than string modes such as `'a'` or `'w'` (those create or truncate).
- Never swallow an exception. Never throw out of `file_ops`; always return an `FmResult`.

### 6.2 `fs_scan.js`

```js
fs_list(dirPath)   // -> FmResult<FmEntry[]>   FmEntry = { name, size, mtimeMs, isDir, isReadOnly }
```
Sorted: folders first, then files, each A–Z case-insensitive (`localeCompare` with `sensitivity: 'base'`). Entries that cannot be `stat`-ed are still listed (size 0), not dropped. Hidden/system entries are skipped in the core build (a "show hidden" toggle is stretch).

### 6.3 `validate.js`

`fm_validate_path` plus `isReservedName`. Pure functions, no `fs`. See section 8 for the exact rules and messages. The renderer needs the same rules for live hints, so **expose validation through IPC** (`window.fm.validate(path)`) rather than duplicating it. Keep one implementation.

### 6.4 `util.js`

`pathJoin`, `pathParent`, `resolveAgainst(base, userInput)`, `formatSize` (B / KB / MB with one decimal, as in the mockup), `formatModified` (`Oct 17, 2026, 3:42 PM`), `byteLength`.

### 6.5 `shared/messages.js`

`formatError(op, target, result) -> string` and `successText(op, target, extra)`. See section 10. One place for all wording, no message strings anywhere else.

### 6.6 `ipc.js` and `preload.js`

- One `ipcMain.handle('fm:<name>', ...)` per function. Each handler checks argument types, calls `file_ops`, and returns the `FmResult` as plain JSON. Handlers never throw to the renderer.
- `preload.js` exposes only `window.fm = { validate, info, exists, list, create, read, append, rename, delete, pickFolder }`, each a thin `ipcRenderer.invoke`. Nothing else from Electron or Node is exposed.
- `pickFolder` uses `dialog.showOpenDialog({ properties: ['openDirectory'] })`.

### 6.7 `app.js` (state and flows)

```js
state = { cwd: string[] | string, entries: FmEntry[], selName: string|null,
          sheet: null|object, menuOpen: number, theme: 'auto'|'light'|'dark' }
```
Each operation is a small function that follows the same pattern:
**check selection → pre-check with `fm_get_info` (exists, not a folder, not read-only) → open sheet → live validate → call `window.fm.*` → on error: show it in the sheet hint (or toast if no sheet) → on success: close sheet, toast, refresh list, move the selection to the affected file.**

### 6.8 `ui/*`
Pure drawing and input. They get data from `app.js`; they never call `window.fm` themselves.

---

## 7. Safety rules per operation

All rules are enforced in `file_ops`, not just in the UI. (The "How" column is the Node equivalent of the v1 C calls.)

| Operation | Pre-checks | Behavior | Never |
|---|---|---|---|
| **Create** | name valid; parent folder exists; target does **not** exist | `fs.openSync(path, O_WRONLY \| O_CREAT \| O_EXCL, 0o666)` (create-or-fail in one atomic step). Write content (loop for partial writes), `fsync`, close. If the write fails, **delete the partial file this call just created** and report. | Overwrite. Use a separate "exists?" check followed by a plain create (race condition). |
| **Read** | exists; is a regular file; readable | Open `O_RDONLY`, `fstat` to confirm a regular file, read up to **1 MiB** (`truncated` if more). If a `0x00` byte appears in the first 512 bytes, return `FM_ERR_BINARY`. Decode as UTF-8, strip `\r` for display. Close. | Load unbounded files into memory. |
| **Append** | exists; is a regular file; writable | Open `O_RDWR \| O_APPEND` and **no** `O_CREAT`, so a missing file can't be silently created (`O_RDWR` lets us look at the last byte; writes still go to the end). If the file is non-empty and does not end with a newline, write one first so new text starts on its own line. `fsync`, close. | Create a missing file via `'a'` mode. |
| **Rename** | old exists; new name valid; new parent exists; new target does **not** exist | `fs.renameSync`. Map `EXDEV` to `FM_ERR_CROSS_DEVICE`. | Replace an existing file. **Node's `rename` replaces an existing target on both Windows and POSIX**, so the explicit exists-check is mandatory. |
| **Delete** | exists; is a regular file (`lstat`); not read-only | UI shows the confirmation sheet with **name and size**, default **Cancel**. Then `fs.unlinkSync`. Read-only files report permission denied; do not auto-clear the attribute. | Delete folders (core build), delete without confirmation, follow a symlink into its target. |
| **Info** | exists | `stat`; show name, full path, size in bytes and human-readable, modified date/time, kind, read-only flag. | — |

**Windows details that matter**
- **Read-only detection:** on Windows, Node reports a read-only file as having no write bit in `stats.mode` (`(mode & 0o200) === 0`). Check this *explicitly* before append and delete. Do not rely on `unlink` failing: the underlying library may clear the read-only attribute itself and delete anyway. The test must prove a read-only file **survives** a delete attempt.
- **Case-only rename** (`notes.txt` → `Notes.txt`) must be allowed. The exists-check will find the source itself; compare `dev` and `ino` from `fs.statSync(path, { bigint: true })` for the two paths and skip the conflict when they are the same file *and* the names differ. If the names are identical, report "That is the current name." (not an error toast; a hint).
- Reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, with or without an extension) are rejected.
- Illegal in a name: `< > : " | ? *` and control characters 0–31. A single `:` is allowed only as a drive letter at index 1 (`D:\...`). Names may not end with a space or a dot. `.` and `..` are rejected as file names.
- Path limit: reject paths of 260 characters or more with `FM_ERR_PATH_TOO_LONG`.
- **Line endings (D9):** on Windows, convert `\n` to `\r\n` when writing New/Append content; strip `\r` when reading for display. Because append may add a newline first, that newline is also `\r\n`. The test must verify that a 3-line file created by the app has the expected byte size.
- **Symlinks and junctions:** use `lstat` for the delete check. A symlink to a folder is treated as a folder, not deleted.
- Known limitation (document it in the README): a tiny time gap still exists between the rename exists-check and `rename`. Acceptable for this scope.

---

## 8. Input validation (`fm_validate_path`)

Reject, with a specific message each time (these are the exact messages the mockup shows; copy them):

| # | Rule | Message |
|---|---|---|
| 1 | empty or whitespace-only | `The name is empty.` |
| 2 | path is only a drive (`D:`) | `A drive is not a file name.` |
| 3 | path ends with `\` or `/` | `The path ends with "\", so there is no file name.` |
| 4 | last part is `.` or `..` | `"." is not a valid file name.` (or `".."`) |
| 5 | any part longer than 255 characters | `A name part is longer than 255 characters.` |
| 6 | illegal character `< > : " \| ? *` or control code | `The character "?" is not allowed in file names.` (control codes: `"control code"`) |
| 7 | part ends in a space or a dot | `Names cannot end with a space or a dot.` |
| 8 | reserved device name | `"CON" is a reserved Windows device name.` |
| 9 | whole path 260 characters or more | `That path is 260 characters or longer.` (code `FM_ERR_PATH_TOO_LONG`) |
| 10 | parent folder does not exist (checked by the UI via `fm_get_info`) | `That folder does not exist.` |
| 11 | NULL byte (cannot be typed, but check) | same as rule 6 (control code) |

Accepted forms: `notes.txt`, `sub\notes.txt`, `..\notes.txt`, `D:\Projects\notes.txt`; forward slashes are accepted and normalized. Relative input resolves against the **folder currently shown**, not the process working directory.

---

## 9. Navigation and menu map

See 4.3 and 4.4 for menus and shortcuts. Behavior summary:

| Source | Triggers |
|---|---|
| Menu bar, toolbar, right-click menu, shortcuts | the **same** `app.js` action functions (`actNew`, `actOpen`, `actAppend`, `actRename`, `actDelete`, `actProps`, `actRefresh`, `actUp`, `actExit`). No operation logic lives in a UI file. |
| Sidebar node / breadcrumb click | navigate to that folder |
| Double-click row / `Enter` | folder: navigate. File: open the viewer |
| `Backspace` / Up button / Go → Up | parent folder (disabled at a root) |

*Stretch:* New Folder, Copy, multi-select, drag-and-drop, "show hidden", a plain numbered console menu (`node src/console_menu.js`) that uses the same `file_ops` for people who prefer a terminal.

---

## 10. Error messages and status

These are the strings used in the mockup. `{x}` is the file name as the user sees it.

| Situation | Message |
|---|---|
| Create, file exists | `Cannot create "{x}": it already exists. Nothing was changed.` |
| Create, parent missing | `Cannot create "{x}": that folder does not exist.` |
| Open / Append / Rename / Delete, file gone | `Cannot {open\|append to\|rename\|delete} "{x}": it no longer exists. The list has been refreshed.` |
| Append / Delete, read-only | `Cannot {append to\|delete} "{x}": it is read-only.` |
| Append / Delete / Rename, is a folder | `Cannot {append to\|delete\|rename} "{x}": it is a folder.` |
| Open, binary | `"{x}" is a binary file, so it cannot be shown as text.` |
| Open, truncated | Viewer banner: `Showing the first 1 MiB of N bytes.` |
| Rename, target exists | `Cannot rename: "{y}" already exists.` |
| Rename, cross drive | `Cannot rename across drives.` |
| Path too long | `Cannot {verb} "{x}": the path is 260 characters or longer.` |
| Invalid name | `Cannot {verb} "{x}": {validation message from section 8}` |
| Any other failure | `Something went wrong while trying to {verb} "{x}".` In the real app append the system reason, e.g. `(disk full)` for `ENOSPC`, and log the raw code in the log panel. |
| Success | `Created "{x}" (322 bytes).` · `Appended 41 bytes to "{x}".` · `Renamed "{a}" to "{b}".` · `Deleted "{x}".` · `Refreshed.` |
| Outside change noticed | `"{x}" was deleted outside the app. The list is out of date until you act on it.` (mockup demo only) |

Rules: always name the operation, the target and the reason. Plain words, no jargon, no error codes in user-facing text (they go to the log panel). Write messages in the sheet's hint line when a sheet is open, otherwise as a toast.

---

## 11. Build order (milestones with acceptance checks)

Do these in order. Finish and verify each before the next. Steps **M1–M6 satisfy every requirement in the spec**.

| # | Milestone | Done when |
|---|---|---|
| **M0** | **Toolchain check.** Verify Node (≥ 20) and npm. `npm init`, install `electron`, `@fontsource/manrope`, `@fontsource/jetbrains-mono`. A bare window opens with the glass background (blobs + blur visible) and an `ipcMain.handle('fm:ping')` round trip works through the preload. Record exact versions. | `npm start` opens the window; `npm test` runs an empty suite. |
| **M1** | `status`, `validate`, `util`, `file_ops` + unit tests. No UI yet. | Every case in section 12.1 passes. |
| **M2** | `fs_scan` + formatting helpers + tests. | Sorted listing is correct for a temp folder with mixed names. |
| **M3** | Port the static UI from `UI_MOCKUP_GLASS.html`: tokens, background, window, sidebar, breadcrumbs, list, details panel, status bar, themes and fallbacks. Wire to `fm_list` / `fm_get_info` through IPC. Navigation works. | Browse a real folder with 100+ entries; sorted; selection and details update; light/dark switch works. |
| **M4** | Menu bar, toolbar, right-click menu, shortcuts (sections 4.3, 4.4), enabled/disabled state. | Every menu item and shortcut triggers the right action stub; keyboard-only use works. |
| **M5** | Sheets: New, Open (viewer), Append, Rename, Delete, Info, Shortcuts, Exit; toasts; live validation hints. Each works against **stub** `file_ops`. | Each sheet opens, traps focus, closes on Esc, and shows each hint state. |
| **M6** | Wire all actions to the real `file_ops` through IPC, including stale-file handling and selection-after-action. | Section 12.2 manual script passes. |
| **M7** | Spec checklist + log panel (flag-gated), Open folder… picker, Recent folders, responsive and reduced-motion/transparency polish, accessibility pass (focus order, labels, contrast). | Resize to 900 x 580 works; keyboard-only run passes; both themes checked. |
| **M8** | README, `docs/TEST_PLAN.md`, final review against section 3, optional packaging (`electron-builder`). | Every row of the traceability table is demonstrably true. |
| Stretch | New Folder, Copy, console menu mode, "show hidden", Recycle Bin delete, overwrite-with-confirm, Playwright e2e. | Only after M8. |

---

## 12. Testing

### 12.1 Automated (no UI)

`npm test` runs `node --test` on `tests/*.test.js`. These link only `file_ops`, `fs_scan`, `validate`, `status`, `util`, `shared/messages`. Each test works in a fresh temp folder (`fs.mkdtempSync`) and cleans up.

**Create:** new file succeeds and size matches · existing file → `FM_ERR_EXISTS` and content **unchanged** · missing parent → `FM_ERR_NOT_FOUND` · empty content creates a 0-byte file · illegal name → `FM_ERR_INVALID_NAME` · reserved name (`CON`) rejected · path ≥ 260 rejected · 3-line file has the expected byte size on Windows (CRLF check) · two `create` calls racing on the same name: exactly one succeeds.
**Read:** content round-trips · missing → `FM_ERR_NOT_FOUND` · directory → `FM_ERR_IS_DIR` · NUL bytes → `FM_ERR_BINARY` · file over the limit → `truncated` true and `bytes === maxBytes` · `\r` is stripped from the returned text.
**Append:** adds to the end · missing file → `FM_ERR_NOT_FOUND` **and no file was created** · appends on a new line when the file lacks a trailing newline · read-only file → `FM_ERR_PERMISSION` and content unchanged · directory → `FM_ERR_IS_DIR`.
**Rename:** simple rename · target exists → `FM_ERR_EXISTS` and both files intact (**explicit test, because Node would replace it**) · source missing → `FM_ERR_NOT_FOUND` · case-only rename succeeds on Windows · rename into a missing folder → `FM_ERR_NOT_FOUND` · same name → reported as no change.
**Delete:** removes file · missing → `FM_ERR_NOT_FOUND` · directory → `FM_ERR_IS_DIR` · **read-only file → `FM_ERR_PERMISSION` and the file still exists** · symlink to a folder is not followed.
**Info / scan:** size and mtime correct · listing order is folders then files, case-insensitive · unreadable entries still listed.
**Validate:** one test per row of the section 8 table, asserting the exact message.
**Messages:** one test per row of section 10 asserting the exact string.
**Hygiene:** run ESLint with no warnings; create/delete the same file 1000 times in a loop and confirm no descriptor leak (count open handles with `process._getActiveHandles` or check the loop completes without `EMFILE`); no `fs` import anywhere under `src/renderer`.

### 12.2 Manual script (`docs/TEST_PLAN.md`)
Run in a scratch folder on `D:\`. Check each step in **both themes** at least once.
1. Start in an empty folder. Press `N`, type `a.txt` (hint says "Available at …", **Create** enables), type two lines, press Create. A success toast appears; the file shows in the list with the right size; it is selected.
2. Press `N`, type `a.txt` again. The hint turns red ("already exists… never replaces a file"), **Create is disabled**, the file is unchanged.
3. Select `a.txt`, press `Enter`. The viewer shows the two lines with line numbers.
4. Press `A`, type one line, press Append. `a.txt` now shows three lines in the viewer; size grew; no blank line was inserted.
5. Press `F2`, type `b.txt`. The list updates and the selection follows.
6. Create `a.txt` again, then rename `b.txt` to `a.txt`. The rename hint says it already exists; neither file changes.
7. Select `b.txt`, press `Delete`. The sheet shows name and size; **Cancel has focus**; press `Enter`. Nothing is deleted. Repeat and choose **Delete file**. Deleted toast; selection moves to a neighbor.
8. Select `a.txt`, then delete it from File Explorer without refreshing the app. Press `Enter`, then `A`, then `Delete`. Each gives the "no longer exists" message, **no file is re-created**, and the list refreshes.
9. Try illegal names in New: `a?b.txt`, `CON`, `con.txt`, `name.` (trailing dot), a 300-character name, empty. Each shows a specific message and keeps Create disabled.
10. Make a file read-only in Explorer, select it, try Append and Delete. Each gives "it is read-only" and the file is unchanged. Select a folder and try Append and Delete: "it is a folder".
11. Select a binary file (e.g. a small `.png`). Details show "no text preview"; Open gives the binary message.
12. Menus: open File with `Alt+F`, move with arrows, run an item with `Enter`; `Esc` closes and returns focus. With nothing selected, Open/Append/Rename/Delete/File information are disabled. Right-click a row: the context menu appears.
13. Toggle the theme; resize the window to the minimum; turn on the OS "reduce motion" setting and confirm the blobs stop. Check text is readable in both themes.
14. Keyboard only: complete steps 1–7 without the mouse.

---

## 13. Prompt to paste into Claude Code

Open Claude Code in this folder, then paste everything inside the block below.

````markdown
# Task: Build the "Simple File Management System" (menu-driven file manager, modern minimalist glassmorphism UI)

You are building a school project. Quality of file handling and error checking is what gets graded, so correctness and clarity matter more than feature count. The interface must also look as designed.

## 1. Read first
Read these two files in this folder completely before writing any code:
1. `PROJECT_STRUCTURE.md` — the design source of truth: decisions, UI spec, module APIs, safety rules, validation, messages, milestones, tests.
2. `UI_MOCKUP_GLASS.html` — the visual and behavioral spec. Open it in a browser (or read its source). Port its markup, tokens, menus, sheets, validation hints and messages; replace only its simulated `fm_*` functions with real calls.

If you must deviate from either, write the reason in `docs/DECISIONS.md` first. `PROJECT_STRUCTURE_C-TUI_v1.md` and `UI_MOCKUP.html` are the superseded text-window design; do not build from them.

## 2. The assignment (verbatim)
Simple File Management System. Develop a menu-driven application that allows users to create, read, append, rename, and delete files.
Coding requirements: create a menu for file operations; accept a file name and, when appropriate, file content; open and close files correctly; check errors during file operations; prevent accidental overwriting where possible.
Inputs: file names and paths; file content; commands for create, read, append, rename, and delete.
Outputs: file content displayed on screen; operation status and error messages; file information such as name and size when available.
Key features: create, read, append, rename, delete; file existence and error checks; menu-based navigation.

## 3. Technical decisions (already made)
<!-- TOOLKIT BLOCK: if decision D1 in PROJECT_STRUCTURE.md changes, edit only this block (see Appendix A). -->
- Toolkit: **Electron (current stable) + plain JavaScript (ES modules where practical), Node 20+**. No TypeScript, no UI framework (no React/Vue), no CSS framework. Vanilla HTML/CSS/JS, as in the mockup.
- Platform: **Windows 10/11**. Do not use shell commands for file operations (no `child_process`, no `del`/`ren`); use Node `fs` only.
- Architecture: exactly the layers and folders in sections 5.2 and 5.3 of `PROJECT_STRUCTURE.md`. The renderer is sandboxed and has **no Node access**; it talks to `file_ops` only through the preload `window.fm` API over IPC.
- Electron security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP (no remote content), block navigation and new windows, validate IPC argument types in `ipc.js`.
- Fonts: bundle Manrope and JetBrains Mono via the `@fontsource/*` packages. No network access at runtime.
- Dependencies: `electron` and the two `@fontsource` packages at runtime; `eslint` as a dev dependency; optionally `electron-builder` at M8. Anything else needs a reason in `docs/DECISIONS.md`.
- Tests: Node's built-in `node:test` and `assert`. No test framework dependency.

## 4. Hard rules (do not break these)
1. `file_ops`, `fs_scan`, `validate`, `status`, `util` and `shared/messages` must **never** import Electron or touch the DOM, print to the console, or ask the user anything. They return `FmResult` objects only and never throw. Tests must run with plain `node --test` and no Electron.
2. Every descriptor opened with `fs.openSync` is closed in a `finally` block and the **close is checked**. Writes loop on `fs.writeSync` for partial writes and `fsync` before close. The error code is captured at the catch site and mapped by one helper, `statusFromErrno`.
3. **Create** uses `O_WRONLY | O_CREAT | O_EXCL` (atomic exclusive create). Never "check exists, then create". If writing fails after the file was created, remove the partial file this call created.
4. **Append** uses `O_RDWR | O_APPEND` with **no** `O_CREAT`. It must never create a missing file. If the file does not end in a newline, add one first.
5. **Rename** checks that the target does not exist (allow a case-only rename of the same file, detected via `dev`/`ino`). **Node's rename replaces existing files**, so this check is mandatory and needs its own test.
6. **Delete** only deletes regular files. Check read-only explicitly before unlinking; a read-only file must survive. The UI always asks for confirmation showing the name and size, with **Cancel** as the default.
7. **Read** caps at 1 MiB, detects binary files (NUL in the first 512 bytes), strips `\r` for display.
8. Names and paths pass `fm_validate_path` (section 8 of `PROJECT_STRUCTURE.md`, with the exact messages) before any file call. There is **one** implementation; the renderer uses it through IPC for live hints. Relative input resolves against the folder currently shown.
9. Every user-visible message comes from `shared/messages.js` and matches section 10. Messages name the operation, the target and the reason. No raw error codes in the UI (they go to the log panel only).
10. The renderer never imports `fs`, `path` or `electron`. No inline event handlers, no `eval`, no remote scripts.
11. UI requirements from sections 4.1–4.6: glass material with blur, light and dark themes, **all three fallbacks** (no `backdrop-filter`, reduced transparency, reduced motion), full keyboard operation, focus trapping in sheets, visible focus rings, toasts with the right ARIA roles, disabled states for toolbar and menu items when nothing is selected, live validation hints in New and Rename.

## 5. How to work
- Create and keep a task list. Work through milestones **M0 → M8** from section 11, in order. Do not start a milestone until the previous one's "Done when" is true.
- **M0 first:** verify Node and npm on this machine, scaffold the project, install dependencies, and open a window showing the glass background with a working IPC round trip. Record the exact versions in `README.md`. Do not guess package names or versions: run the command and check.
- Write the unit tests for a module **together with** the module (M1, M2) and run `npm test` after every milestone. Fix failures before moving on.
- Start the app yourself at M3, M4, M5, M6 and M7 and check it against `UI_MOCKUP_GLASS.html`. If you can take screenshots (for example with Playwright's Electron support), compare them with the mockup in both themes. If you cannot view the screen, say so and rely on the manual script in section 12.2, listing which steps you could not verify.
- Commit after each milestone with a short message (`M3: static glass UI and navigation`). Do not rewrite history.
- If something is ambiguous, pick the default stated in `PROJECT_STRUCTURE.md`, note it in `docs/DECISIONS.md`, and continue. Ask me only if a choice cannot be undone cheaply.
- Keep code readable: small functions, comments for *why* (especially in `file_ops`), consistent naming (`fm_` for file ops, `fs_` for scanning). One action function per operation, shared by the menu, toolbar, context menu and shortcuts.
- Do **not** build stretch goals (New Folder, Copy, console menu mode, show hidden, Recycle Bin, overwrite flow, e2e tests) until M8 is complete and I say so.

## 6. Definition of done
- `npm start` opens the app; `npm test` passes every case listed in section 12.1; ESLint reports no warnings.
- The manual script in section 12.2 passes, and `docs/TEST_PLAN.md` records the result of each step.
- Every row of the traceability table (section 3) is demonstrably true. Add a short "Requirements checklist" to `README.md` that points to the file and function for each row.
- The app looks like `UI_MOCKUP_GLASS.html` in both themes, at 1240 x 780 and at the 900 x 580 minimum.
- `README.md` covers: what it is, how to install, how to run, shortcuts, safety behavior, known limitations (including the rename check-then-act time gap), and which parts came from the mockup.
- Nothing under `src/renderer` imports Node or Electron modules.

## 7. Report format after each milestone
Reply with: the milestone name, what changed (files), test results (pass/fail counts), anything you decided that wasn't in the doc, and the next milestone. Keep it under 15 lines, then continue unless something is blocked.

Start now with M0.
````

---

## 14. Quick reference for the builder

- **Run:** `npm start`. **Test:** `npm test`. **Lint:** `npm run lint`.
- **Open flags:** use `fs.constants.O_WRONLY | O_CREAT | O_EXCL` for create and `O_RDWR | O_APPEND` for append. Avoid string modes (`'w'`, `'a'`, `'wx'`) in `file_ops`, so the intent is explicit and greppable.
- **Windows paths:** Node accepts both `/` and `\`. Normalize with `path.win32` helpers when building display paths, so the breadcrumbs show `D: › Projects › demo`.
- **Glass in Electron:** `backdrop-filter` works in Chromium without flags. Keep the window background opaque (do not enable native transparency); the blobs inside the page provide the color the blur needs. Native acrylic (`backgroundMaterial`) is optional and not part of the design.
- **Do not** use `child_process`, `shell.openPath` for file operations, or any shell command. Use `fs` so error checking is real and visible.
- **Do not** put business logic in `ui/*`. A menu item, a button and a shortcut must all call the same action function.

---

## Appendix A. If you pick a different toolkit (D1)

| If D1 becomes | Keep | Replace |
|---|---|---|
| **B: Python 3 + PySide6 / CustomTkinter** | Sections 1, 3, 4 (behavior, menus, shortcuts, sheets), 7, 8, 10, 12.2 | Section 5 layers (no IPC; UI calls `file_ops` directly, still in separate modules with no UI imports), 6 syntax (use `os.open(..., os.O_CREAT\|os.O_EXCL\|os.O_WRONLY)`, `os.O_APPEND`), 11 M0, 12.1 (use `pytest`), 14, and the TOOLKIT BLOCK in 13. Blur will be an approximation (translucent window + gradient + rounded cards); say so in `docs/DECISIONS.md`. |
| **C: C11 + PDCurses text UI** | Section 7, 8, 10 and 12.1 are unchanged from v1 | Use `PROJECT_STRUCTURE_C-TUI_v1.md` as the plan and its prompt. The menu bar (File / Go / Help) can be added to that design by turning the F2 pop-up into a top bar. The glass look is not possible. |
| **D: C + native GUI** | Same as B for behavior | Much more UI code; no blur. Only if the course requires C and a GUI. |

Whatever the toolkit, the rule from 5.1 stays: **the file logic lives in a module that never touches the UI and returns status codes**, and the unit tests in 12.1 are written against that module alone.

## Appendix B. Optional libraries and tools

| Name | Use | Note |
|---|---|---|
| `electron` | Window, IPC, folder picker | Required for D1 |
| `@fontsource/manrope`, `@fontsource/jetbrains-mono` | Offline fonts | Required for D1 (D8) |
| `eslint` | Static checks | Dev only |
| `electron-builder` | Windows installer / portable exe | Optional, M8 |
| `playwright` (with Electron support) | Screenshots and e2e flows | Optional, helps compare with the mockup |
| For the C fallback (Appendix A, C): PDCursesMod, Unity, tinydir, cppcheck | Terminal UI, unit tests, directory listing, static analysis | See v1 plan, milestone M0 |
