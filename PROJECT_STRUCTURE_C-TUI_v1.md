# Simple File Management System — Project Structure & Build Prompt

A menu-driven file manager with a DOS-style dual-pane text interface (modeled on the Norton/Total Commander-style screenshot: blue panes, cyan borders, F-key bar). It supports **create, read, append, rename, delete** with file information, existence checks, error checks, and protection against accidental overwriting.

> **How to use this file**
> 1. Read sections 1–12 (the design).
> 2. Check the **Assumptions** table in section 2. Change anything you disagree with *before* starting.
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

## 2. Assumptions (edit these first)

These were not answered yet, so sensible defaults were chosen. Change them here and in the prompt if needed.

| # | Decision | Default | Why | Alternative |
|---|---|---|---|---|
| A1 | Language | **C (C11)** | The spec's "open and close files correctly" maps directly onto `open`/`fopen`/`fclose`. Best for showing file-handling skill. | Python + `curses` (much faster to build; use `windows-curses` on Windows) |
| A2 | Platform | **Windows 10/11** (the project folder is on `D:\`) | Matches your machine. Code stays portable to Linux/macOS through one small `platform` layer. | Linux/macOS (plain `ncurses`) |
| A3 | UI library | **PDCurses** (curses API for the Windows console) | Gives colors, box drawing, and F-keys like the screenshot. | `ncurses` on Linux/macOS |
| A4 | Toolchain | **MSYS2 (UCRT64) + gcc + make** | Easiest way to get gcc and PDCurses on Windows. | Visual Studio + vcpkg |
| A5 | UI style | **DOS-style dual-pane TUI** | You chose to base the project on the screenshot. | Plain numbered menu |
| A6 | Scope | The 5 required operations + file info. Copy, MkDir, brief view, drive switch are **stretch goals**. | Required items must be finished and polished before extras. | — |
| A7 | Overwrite policy | **Never overwrite** in the core build. Create and Rename refuse existing targets. | Strongest reading of "prevent accidental overwriting". | Add an explicit "Overwrite? [y/N]" flow as a stretch goal |

---

## 3. Requirement traceability

Every line of the spec maps to something concrete. This table is also the grading checklist.

| Spec requirement | Implemented as | Where |
|---|---|---|
| Menu for file operations | F2 pop-up menu **and** F-key bar; both trigger the same actions | `ui_menu`, `ui_keybar`, `app` |
| Accept file name | Prompt dialog with validation | `ui_dialogs`, `fm_validate_path` |
| Accept file content | Multi-line editor dialog (Create, Append) | `ui_dialogs` (editor) |
| Open and close files correctly | Every open is paired with a checked `fclose`; no early returns that skip cleanup | `file_ops` |
| Check errors during file operations | Every `open`/`fopen`/`fread`/`fwrite`/`fflush`/`fclose`/`rename`/`remove` return value is checked; `errno` captured | `file_ops` |
| Prevent accidental overwriting | Exclusive create (`O_EXCL`), append-only-if-exists, rename refuses existing target, delete needs confirmation (default **No**) | `file_ops`, `app` |
| Input: names and paths | Prompts accept a name or a relative/absolute path | `fm_validate_path` |
| Input: file content | Editor dialog | `ui_dialogs` |
| Input: commands | F-keys, Enter, Tab, arrows, F2 menu | `app` |
| Output: file content on screen | Scrollable viewer dialog | `ui_dialogs` (viewer) |
| Output: status and errors | Colored status line + message boxes | `ui_panels`, `messages` |
| Output: name, size, etc. | Per-pane info line + F5 details dialog | `ui_panels`, `ui_dialogs` (info) |
| Existence checks | `fm_exists` / `fm_get_info` before every operation | `file_ops` |

---

## 4. Screen layout (80x25 minimum)

```
┌──────────────────────────[ D:\Projects ]─────────────────────────────────────┐   row 0   top border, active path in the border
│ Name            Size     Date     Time │ Name            Size     Date   Time │   row 1   column headers
│ ..             ▶UP--DIR◀ 10-18-26 10:19a│ ...                                  │   rows 2..LINES-6  file list
│ docs           ▶SUB-DIR◀ 10-18-26 10:19a│                                      │
│ notes.txt            322 10-18-26 10:21a│                                      │
│ ...                                     │                                      │
├────────────────────────────────────────┼─────────────────────────────────────┤   divider
│ notes.txt       322 10-18-26 10:21a     │ (info for highlighted item)          │   info line, one per pane
└────────────────────────────────────────┴─────────────────────────────────────┘   bottom border
D:\Projects> File created successfully.                                              status/prompt line
 1Help 2Menu 3View 4Append 5Info 6Rename 7New 8Delete 9Refresh 10Quit               key bar
```

**Row budget** (`LINES` = terminal rows): top border 1 + header 1 + divider 1 + info 1 + bottom border 1 + status 1 + key bar 1 = **7 fixed rows**. File list height = `LINES - 7` (18 rows at 25 lines).

**Look (match the screenshot)**
- Background: blue. Borders and headers: cyan. Normal text: white. Directories: bold white.
- Highlight bar: black text on cyan background (the active pane's bar is brighter than the inactive pane's).
- Directories show a `SUB-DIR` marker in the size column (`ACS_RARROW`/`ACS_LARROW` arrows around it). Parent entry shows `UP--DIR`.
- Date format `MM-DD-YY`, time format `h:mma`/`h:mmp` (12-hour with `a`/`p`), like the screenshot.
- Key bar: key number in white on black, label in black on cyan.
- Status line: green text for success, red for errors, white for the plain `path>` prompt.
- Use `ACS_*` line-drawing characters, not Unicode, so it works in the Windows console.
- If the terminal is smaller than 80x25, show a single "Terminal too small (need 80x25)" message and redraw on resize.

---

## 5. Architecture

### 5.1 The one rule that matters

> **`file_ops` never prints, never touches curses, and never asks the user anything.**
> It takes plain arguments and returns a status. The UI turns statuses into messages.

Why: it makes the file logic testable on its own (a test program links `file_ops` but not curses), and it makes the error handling easy to point at when the work is graded.

### 5.2 Layers

```
┌──────────────────────────────────────────────┐
│ main        init curses, event loop          │
├──────────────────────────────────────────────┤
│ app         state + key → action dispatch    │  decides WHAT happens
├──────────────────────────────────────────────┤
│ ui_*        draw panes, menu, dialogs, bar   │  decides HOW it looks
├──────────────────────────────────────────────┤
│ messages    FmStatus → human text            │
├──────────────────────────────────────────────┤
│ file_ops · fs_scan · util · platform         │  NO curses below this line
└──────────────────────────────────────────────┘
```

### 5.3 Folder layout

```
Simple File Management System/
├── PROJECT_STRUCTURE.md        this file
├── README.md                   how to build, run, use (written at the end)
├── Makefile
├── src/
│   ├── main.c                  curses init/teardown, main loop
│   ├── app.c / app.h           AppState, pane state, key dispatch, operation flows
│   ├── file_ops.c / file_ops.h create, read, append, rename, delete, exists, info  (NO curses)
│   ├── fs_scan.c / fs_scan.h   list a directory into sorted entries              (NO curses)
│   ├── platform.c / platform.h Windows vs POSIX shims                            (NO curses)
│   ├── util.c / util.h         path join, safe string copy, size/date/time formatting
│   ├── messages.c / messages.h FmStatus → message text
│   ├── ui_theme.c / ui_theme.h color pairs and attributes
│   ├── ui_panels.c / ui_panels.h panes, highlight bar, info line, status line
│   ├── ui_menu.c / ui_menu.h   F2 pop-up menu
│   ├── ui_keybar.c / ui_keybar.h bottom F-key bar
│   └── ui_dialogs.c / ui_dialogs.h message box, confirm, text prompt, viewer, editor, info, help
├── tests/
│   ├── test_main.c / test_util.h  tiny assertion helpers + runner
│   ├── test_file_ops.c
│   ├── test_fs_scan.c
│   └── test_util.c
└── docs/
    ├── DECISIONS.md            any assumption the builder had to make
    └── TEST_PLAN.md            manual test script for the TUI
```

---

## 6. Module specifications

### 6.1 `file_ops` (the core)

```c
typedef enum {
    FM_OK = 0,
    FM_ERR_INVALID_ARG,     /* NULL / empty argument                        */
    FM_ERR_INVALID_NAME,    /* illegal characters, reserved name, bad form  */
    FM_ERR_PATH_TOO_LONG,
    FM_ERR_NOT_FOUND,       /* file or parent directory missing             */
    FM_ERR_EXISTS,          /* target already exists                        */
    FM_ERR_PERMISSION,      /* EACCES / EPERM / read-only                   */
    FM_ERR_IS_DIR,          /* operation needs a file, got a directory      */
    FM_ERR_NOT_REGULAR,     /* device, pipe, etc.                           */
    FM_ERR_TOO_LARGE,       /* over the viewer/editor limit                 */
    FM_ERR_BINARY,          /* looks like binary data                       */
    FM_ERR_NO_SPACE,        /* ENOSPC                                       */
    FM_ERR_CROSS_DEVICE,    /* rename across drives (EXDEV)                 */
    FM_ERR_IO,              /* any other read/write/close failure           */
    FM_ERR_CANCELLED        /* user cancelled (set by the UI layer only)    */
} FmStatus;

typedef struct {
    FmStatus code;
    int      sys_errno;     /* errno captured at the failure point, 0 if none */
} FmResult;

typedef struct {
    char        name[256];
    char        path[1024];
    long long   size;       /* bytes */
    time_t      mtime;
    int         is_dir;
    int         is_readonly;
} FmFileInfo;

typedef struct {
    char   *data;           /* NUL-terminated copy of what was read       */
    size_t  len;
    int     truncated;      /* file was larger than max_bytes             */
    int     looks_binary;   /* NUL byte found in the first 512 bytes      */
} FmBuffer;

FmResult fm_validate_path(const char *path);                       /* syntax checks only          */
FmResult fm_get_info     (const char *path, FmFileInfo *out);      /* FM_ERR_NOT_FOUND if absent  */
int      fm_exists       (const char *path);                       /* 1 / 0                       */
FmResult fm_create       (const char *path, const char *content, size_t len);
FmResult fm_read         (const char *path, size_t max_bytes, FmBuffer *out);
FmResult fm_append       (const char *path, const char *content, size_t len);
FmResult fm_rename       (const char *old_path, const char *new_path);
FmResult fm_delete       (const char *path);
void     fm_buffer_free  (FmBuffer *b);
```

**Rules for every function**
- Validate arguments first. Never dereference a NULL.
- Open a file only after the checks that can be done cheaply without opening.
- Every exit path closes what it opened. Use one `cleanup:` label per function, or an equivalent pattern.
- Check the return of `fclose` (and `fflush` before it for writes). A failed close on a write means data may be lost, so report it as `FM_ERR_IO`.
- Capture `errno` immediately after the failing call, before any other call can overwrite it.
- Translate `errno` into `FmStatus` in **one** helper (`status_from_errno`), not scattered `switch`es.
- Use `size_t`/`long long` for sizes. Never `int`.

### 6.2 `fs_scan`

```c
typedef struct { char name[256]; long long size; time_t mtime; int is_dir; int is_up; } FsEntry;
typedef struct { FsEntry *items; size_t count; } FsList;

FmResult fs_list(const char *dir_path, FsList *out);   /* sorted: ".." first, then dirs A–Z, then files A–Z (case-insensitive) */
void     fs_list_free(FsList *l);
```
Skip `.`; include `..` unless at a drive/filesystem root. Entries that `stat` cannot read are still listed (size 0), not dropped.

### 6.3 `platform`

The only place allowed to contain `#ifdef _WIN32`. Provide:
- `PATH_SEP` and `is_path_sep(c)` (accept both `\` and `/` on Windows)
- `plat_stat(path, struct stat-like out)` using a 64-bit stat on Windows
- `plat_open_excl(path)` → `open(path, O_WRONLY|O_CREAT|O_EXCL, 0666)`, plus `O_BINARY`/`O_TEXT` handling decided in one place
- `plat_open_existing_append(path)` → `open(path, O_WRONLY|O_APPEND)` (**no** `O_CREAT`)
- `plat_is_reserved_name(name)` (Windows device names; always 0 on POSIX)
- `plat_getcwd`, `plat_drive_root(path)`

### 6.4 `util`
`path_join`, `path_parent`, `path_resolve_against(base, user_input)`, `str_copy` (always NUL-terminates, reports truncation), `fmt_size`, `fmt_date` (`MM-DD-YY`), `fmt_time` (`h:mma`/`h:mmp`).

### 6.5 `messages`
`const char *fm_status_text(FmStatus)` and `void fm_format_error(const char *op, const char *target, FmResult r, char *buf, size_t n)`.
Message style: `Cannot create "notes.txt": file already exists.` or `Cannot delete "a.txt": permission denied (file is read-only).` Always name the operation, the target, and the reason.

### 6.6 `app` (state and flows)

```c
typedef struct { char cwd[1024]; FsList list; int sel; int top; } Pane;
typedef struct { Pane pane[2]; int active; char status[256]; int status_ok; int running; } AppState;
```
Each operation is a small function that follows the same pattern:
**prompt → validate → pre-checks → (confirm if destructive) → call `file_ops` → show result → refresh both panes → move highlight to the affected file.**

### 6.7 `ui_*`
Pure drawing and input. No `file_ops` calls from `ui_*`, except reading `FsEntry`/`FmFileInfo` structs that `app` hands over for display.

`ui_dialogs` provides: `dlg_message(title, text, is_error)`, `dlg_confirm(title, text, default_no)`, `dlg_prompt(title, label, initial, out, n)`, `dlg_viewer(title, text, len)`, `dlg_editor(title, out_buf, out_len, max)`, `dlg_info(FmFileInfo*)`, `dlg_help()`.
- **Editor:** array of lines; arrows, Home/End, Enter, Backspace, Delete, PgUp/PgDn; **F2 / Ctrl+S = save**, **Esc = cancel** (asks to confirm if text was typed); hard limit 64 KB with a visible counter.
- **Viewer:** scroll with arrows/PgUp/PgDn/Home/End; shows `NN%` and line number; Esc/F3/q closes. Shows "[truncated]" if `fm_read` truncated. Tabs expanded, `\r` stripped.
- **Prompt:** single-line, editable, cursor visible, Esc cancels, Enter accepts, **prefilled value** supported (used by Rename).
- **Confirm:** `[ Yes ] [ No ]`, **No is selected by default**, Esc = No.

---

## 7. Safety rules per operation

All rules are enforced in `file_ops`, not just in the UI.

| Operation | Pre-checks | Behavior | Never |
|---|---|---|---|
| **Create** | name valid; parent dir exists; target does **not** exist | Open with `O_CREAT\|O_EXCL` (create-or-fail in one atomic step). Write content, flush, close. If the write fails, **delete the partial file this call just created** and report. | Overwrite. Use a separate "exists?" check followed by a plain create (race condition). |
| **Read** | exists; is a regular file; readable | Open `rb`, read up to **1 MiB**, flag `truncated`. If a NUL byte appears in the first 512 bytes, return `FM_ERR_BINARY` (UI says "binary file, not displayed"). Close. | Load unbounded files into memory. |
| **Append** | exists; is a regular file; writable | Open with `O_WRONLY\|O_APPEND` and **no** `O_CREAT`, so a missing file can't be silently created. If the file is non-empty and doesn't end with a newline, write one first so new text starts on its own line. Flush, close. | Create a missing file via `"a"` mode. |
| **Rename** | old exists; new name valid; new parent exists; new target does **not** exist | `rename()`. Map `EXDEV` to `FM_ERR_CROSS_DEVICE`. | Replace an existing file (POSIX `rename` does this silently). |
| **Delete** | exists; is a regular file | UI shows a confirm dialog with **name and size**, default **No**. Then `remove()`. Read-only files report permission denied; do not auto-clear the attribute. | Delete directories (core build), delete without confirmation. |
| **Info** | exists | `stat`; show name, full path, size in bytes and human-readable, modified date/time, type, read-only flag. | — |

**Windows details that matter**
- `rename()` fails when the target exists on Windows but silently replaces on POSIX. The explicit exists-check keeps behavior identical on both.
- **Case-only rename** (`notes.txt` → `Notes.txt`) must be allowed. On Windows the exists-check will find the *source itself*; compare the two paths case-insensitively and skip the conflict check when they are the same file.
- Reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, with or without an extension) are rejected.
- Illegal in a name: `< > : " | ? *` and control characters 0–31. A single `:` is allowed only as a drive letter at index 1 (`D:\...`). Names may not end with a space or a dot. `.` and `..` are rejected as file names.
- Path limit: reject paths of 260 characters or more with `FM_ERR_PATH_TOO_LONG`.
- Reading uses binary mode and strips `\r` for display, so CRLF and the text-mode `0x1A` end-of-file quirk can't corrupt the viewer. Files created on Windows should open correctly in Notepad (CRLF). The builder chooses text vs binary at the write call and **must verify with a test** that a 3-line file created by the app has the expected byte size.
- Known limitation (document it in the README): a tiny time gap still exists between the rename exists-check and `rename()`. That is acceptable for this scope.

---

## 8. Input validation (`fm_validate_path`)

Reject, with a specific message each time:
1. NULL, empty, or whitespace-only
2. Longer than 259 characters (whole path) or any component longer than 255
3. Illegal characters (section 7)
4. Reserved device names
5. Component ending in space or dot
6. Embedded `\0` (impossible via the editor, but check)

Accepted forms: `notes.txt`, `sub\notes.txt`, `..\notes.txt`, `D:\Projects\notes.txt`. Relative input is resolved against the **active pane's directory**, not the process working directory.

---

## 9. Key bindings

| Key | Action |
|---|---|
| ↑ ↓ PgUp PgDn Home End | Move highlight |
| Enter | Directory → enter it. File → View |
| Backspace | Go to parent directory |
| Tab | Switch active pane |
| F1 | Help |
| F2 | Pop-up menu: Create, Read, Append, Rename, Delete, Info, Refresh, Quit |
| F3 | View (Read) highlighted file |
| F4 | Append to highlighted file |
| F5 | Info for highlighted file |
| F6 | Rename highlighted file |
| F7 | New file (Create) |
| F8 | Delete highlighted file |
| F9 | Refresh both panes |
| F10 | Quit (asks "Quit? Yes / No", default No) |
| Esc | Cancel / close the current dialog |

*Stretch:* Shift+F5 Copy, Shift+F7 MkDir, Alt+F1 / Alt+F2 change drive for the left / right pane.

---

## 10. Error messages and status

| Situation | Message |
|---|---|
| Create, file exists | `Cannot create "x.txt": file already exists. Nothing was changed.` |
| Create, parent missing | `Cannot create "x.txt": folder does not exist.` |
| Append, file missing | `Cannot append to "x.txt": file does not exist.` |
| Read, binary | `"x.bin" looks like a binary file and is not displayed.` |
| Read, truncated | Viewer shows `[Showing first 1 MiB of N bytes]` |
| Rename, target exists | `Cannot rename: "y.txt" already exists.` |
| Rename, cross drive | `Cannot rename across drives.` |
| Delete, read-only | `Cannot delete "x.txt": permission denied (file is read-only).` |
| Any I/O failure | `Error while writing "x.txt": <strerror text>` |
| Success | `Created "x.txt" (322 bytes).` / `Appended 41 bytes to "x.txt".` / `Renamed "a.txt" to "b.txt".` / `Deleted "x.txt".` |

Errors that need attention open a message box. Routine success goes on the status line.

---

## 11. Build order (milestones with acceptance checks)

Do these in order. Finish and verify each before the next. Steps **M1–M7 satisfy every requirement in the spec**.

| # | Milestone | Done when |
|---|---|---|
| **M0** | **Toolchain check.** Install/verify gcc, make, PDCurses. Minimal program draws a blue window and echoes key codes. Makefile builds `fm.exe` and the tests. | `make` and `make test` run; a curses window opens and F-keys are detected. |
| **M1** | `platform`, `util`, `messages`, `file_ops` + unit tests. No UI yet. | Every case in section 12.1 passes. |
| **M2** | `fs_scan` + formatting helpers + tests. | Sorted listing is correct for a temp folder with mixed names. |
| **M3** | `ui_theme`, single pane renders with scrolling, highlight bar, header, borders. | Navigating a folder with 100+ entries scrolls correctly. |
| **M4** | Dual panes, Tab, per-pane info line, status line, key bar. | Looks like the screenshot at 80x25. |
| **M5** | `ui_dialogs`: message, confirm, prompt, viewer, editor, info. | Each dialog works in isolation (a hidden `--demo-dialogs` flag is fine). |
| **M6** | Wire Create, Read, Append, Rename, Delete, Info to F-keys through `app`. | Section 12.2 manual script passes. |
| **M7** | F2 pop-up menu, F1 help, resize handling, "too small" screen, polish. | Resize and menu behave; no flicker; cursor hidden outside dialogs. |
| **M8** | README, `docs/TEST_PLAN.md`, final review against section 3. | Every row of the traceability table is demonstrably true. |
| Stretch | Copy, MkDir, brief view mode for the right pane (3 name columns as in the screenshot), drive switch, overwrite-with-confirm, hex viewer. | Only after M8. |

---

## 12. Testing

### 12.1 Automated (no curses)

`make test` builds `tests/*` against `file_ops`, `fs_scan`, `util`, `platform`, `messages` only. Each test works in a fresh temp directory and cleans up.

**Create:** new file succeeds and size matches · existing file → `FM_ERR_EXISTS` and content **unchanged** · missing parent → `FM_ERR_NOT_FOUND` · empty content creates a 0-byte file · illegal name → `FM_ERR_INVALID_NAME` · reserved name (`CON`) rejected · path ≥ 260 rejected · 3-line file has expected byte size on Windows (CRLF check).
**Read:** content round-trips · missing → `FM_ERR_NOT_FOUND` · directory → `FM_ERR_IS_DIR` · NUL bytes → `FM_ERR_BINARY` · file over limit → `truncated = 1` and `len == max_bytes`.
**Append:** adds to the end · missing file → `FM_ERR_NOT_FOUND` **and no file was created** · appends on a new line when the file lacks a trailing newline · read-only file → `FM_ERR_PERMISSION`.
**Rename:** simple rename · target exists → `FM_ERR_EXISTS` and both files intact · source missing → `FM_ERR_NOT_FOUND` · case-only rename succeeds on Windows · rename into missing folder → `FM_ERR_NOT_FOUND`.
**Delete:** removes file · missing → `FM_ERR_NOT_FOUND` · directory → `FM_ERR_IS_DIR` · read-only → `FM_ERR_PERMISSION`.
**Info / scan:** size and mtime correct · listing order is `..`, dirs, files · unreadable entries still listed.
**Hygiene:** build with `-Wall -Wextra -Wpedantic -Werror`; run once under AddressSanitizer or Valgrind if available; confirm no handle leaks by creating/deleting the same file 1000 times in a loop.

### 12.2 Manual script (`docs/TEST_PLAN.md`)
1. Start in an empty folder. F7 → `a.txt`, type two lines, F2 to save. The status line says created; file appears in the list with the right size.
2. F7 → `a.txt` again. Error box says it already exists; the file is unchanged.
3. F3 on `a.txt`. Viewer shows the two lines.
4. F4 on `a.txt`, type one line, save. F3 now shows three lines; size grew.
5. F6 → `b.txt`. List updates and highlight follows.
6. F7 → `a.txt` again, then F6 on `b.txt` → `a.txt`. Error box says it already exists; neither file is changed.
7. F8 on `b.txt`. Confirm shows name and size; press Enter on the default (No). Nothing is deleted. Repeat and choose Yes. Deleted.
8. Highlight `a.txt`, then delete it from File Explorer without refreshing the app. Press F3, then F4, then F8. Each gives a "does not exist" error, **no file is re-created**, and the pane refreshes.
9. Try illegal names: `a?b.txt`, `CON`, a 300-char name, empty. Each gives a specific message.
10. Resize the console smaller than 80x25, then back. Screen recovers.
11. Tab between panes, enter a subfolder in one, confirm the other is unaffected.

---

## 13. Prompt to paste into Claude Code

Open Claude Code in this folder, then paste everything inside the block below.

````markdown
# Task: Build the "Simple File Management System" (C, Windows console, DOS-style dual-pane TUI)

You are building a school project. Quality of file handling and error checking is what gets graded, so correctness and clarity matter more than feature count.

## 1. Read first
Read `PROJECT_STRUCTURE.md` in this folder completely before writing any code. It is the design source of truth: layout, module APIs, safety rules, key bindings, error messages, milestones, and tests. Follow it. If you must deviate, write the reason in `docs/DECISIONS.md` first.

## 2. The assignment (verbatim)
Simple File Management System. Develop a menu-driven application that allows users to create, read, append, rename, and delete files.
Coding requirements: create a menu for file operations; accept a file name and, when appropriate, file content; open and close files correctly; check errors during file operations; prevent accidental overwriting where possible.
Inputs: file names and paths; file content; commands for create, read, append, rename, and delete.
Outputs: file content displayed on screen; operation status and error messages; file information such as name and size when available.
Key features: create, read, append, rename, delete; file existence and error checks; menu-based navigation.

## 3. Technical decisions (already made)
- Language: **C11**, compiled with gcc using `-std=c11 -Wall -Wextra -Wpedantic -Werror`.
- Platform: **Windows 10/11**, built in an **MSYS2 UCRT64** shell with gcc and make. Keep the code portable to Linux/macOS: every `#ifdef _WIN32` lives in `src/platform.c` / `src/platform.h` only.
- UI: **PDCurses** (curses API) with the look described in section 4 of `PROJECT_STRUCTURE.md`: blue background, cyan borders, F-key bar, dual panes, minimum 80x25.
- Layout: exactly the files and folders listed in section 5.3 of `PROJECT_STRUCTURE.md`.
- No third-party libraries other than PDCurses. No dynamic-language helpers. Standard C plus the small platform layer.

## 4. Hard rules (do not break these)
1. `file_ops`, `fs_scan`, `util`, `platform`, `messages` must **never** include curses, print to stdout/stderr, or prompt the user. They return `FmResult` values only. The tests must build without curses.
2. Every `open`/`fopen`/`fread`/`fwrite`/`fflush`/`fclose`/`rename`/`remove` return value is checked. `errno` is captured immediately after the failing call. Every code path closes what it opened (single cleanup label).
3. **Create** uses an atomic exclusive create (`open` with `O_CREAT|O_EXCL`, then `fdopen`). Never "check exists, then create". If writing fails after the file was created, remove the partial file that this call created.
4. **Append** uses `open` with `O_WRONLY|O_APPEND` and **no** `O_CREAT`. It must never create a missing file.
5. **Rename** checks that the target does not exist (allow case-only renames of the same file on Windows) and never replaces an existing file.
6. **Delete** only deletes regular files, and the UI always asks for confirmation showing the name and size, with **No** as the default.
7. **Read** opens in binary mode, caps at 1 MiB, detects binary files (NUL in the first 512 bytes), strips `\r` for display.
8. Names and paths pass `fm_validate_path` (illegal characters, reserved Windows device names, trailing space/dot, length limits) before any file call. Relative input resolves against the active pane's directory.
9. Use `size_t` / `long long` for sizes. Bound every buffer. No `gets`, no unbounded `scanf("%s")`, no `strcpy`/`sprintf` (use the `util` helpers or `snprintf`).
10. Every user-visible failure message names the operation, the target, and the reason (see section 10 of `PROJECT_STRUCTURE.md`).

## 5. How to work
- Create and keep a task list. Work through milestones **M0 → M8** from section 11 of `PROJECT_STRUCTURE.md`, in order. Do not start a milestone until the previous one's "Done when" is true.
- **M0 first:** verify the toolchain on this machine. Find the correct PDCurses package for the MSYS2 UCRT64 environment (for example with `pacman -Ss pdcurses`), install it, work out the right include path and link flags, and put them in the `Makefile`. Record exactly what you used in `README.md`. Do not guess package names or flags: run the command and check.
- Write the unit tests for a module **together with** the module (M1, M2), and run `make test` after every milestone. Fix failures before moving on.
- Build and run `fm.exe` yourself at M3, M4, M6, and M7 and check the screen against section 4 of `PROJECT_STRUCTURE.md`. If you cannot view the screen, say so and rely on the manual script in section 12.2, listing which steps you could not verify.
- Commit after each milestone with a short message (`M3: single pane rendering`). Do not rewrite history.
- If something is ambiguous, pick the default stated in `PROJECT_STRUCTURE.md`, note it in `docs/DECISIONS.md`, and continue. Ask me only if a choice cannot be undone cheaply.
- Keep code readable: small functions, comments for *why* (especially in `file_ops` and `platform`), consistent naming (`fm_` for file ops, `fs_` for scan, `ui_`/`dlg_` for UI, `plat_` for platform).
- Do **not** build stretch goals (Copy, MkDir, brief view, drive switch, overwrite flow, hex viewer) until M8 is complete and I say so.

## 6. Definition of done
- `make` produces `fm.exe` with zero warnings; `make test` passes every case listed in section 12.1.
- The manual script in section 12.2 passes, and `docs/TEST_PLAN.md` records the result of each step.
- Every row of the traceability table (section 3) is demonstrably true. Add a short "Requirements checklist" section to `README.md` that points to the file and function for each row.
- `README.md` covers: what it is, how to install the toolchain, how to build, how to run, key bindings, safety behavior, known limitations (including the rename check-then-act time gap).
- No file in `src/` other than `ui_*`, `app`, and `main` includes `<curses.h>`.

## 7. Report format after each milestone
Reply with: the milestone name, what changed (files), test results (pass/fail counts), anything you decided that wasn't in the doc, and the next milestone. Keep it under 15 lines, then continue unless something is blocked.

Start now with M0.
````

---

## 14. Quick reference for the builder

- **MSYS2 shell:** use the *UCRT64* shortcut, not the plain MSYS shell, so gcc produces native Windows executables.
- **Run `fm.exe`** in Windows Terminal or a `cmd` window sized at least 80x25. The PDCurses build used must be the Windows-console (wincon) one.
- **PDCurses notes:** call `keypad(stdscr, TRUE)`, `noecho()`, `cbreak()`, `curs_set(0)`; handle `KEY_RESIZE` by calling `resize_term(0, 0)` and redrawing; check `has_colors()` and, if the terminal has no color support, fall back to reverse-video for the highlight bar.
- **Do not** use `system("del ...")`, `system("ren ...")`, or any shell command for file operations. Use the C library calls so error checking is real and visible.
