# Test plan (v2, glass UI)

## Automated tests: `npm test`

`npm test` runs `node --test` on `tests/*.test.js`. No Electron is loaded. Each test gets a fresh folder from `fs.mkdtempSync` and removes it afterwards.

**Latest result: 24 tests, 24 passed, 0 failed.** `npm run lint` reports 0 warnings.

| Suite | Cases |
|---|---|
| `file_ops.test.js` | **Create:** a new file has the expected size; an existing file is refused and **left unchanged**; missing folder; empty file; illegal name; `CON`; a 300-character name; wrong argument type; CRLF size (a 3-line file is 9 bytes); a folder with the same name. **Two workers creating the same name at the same moment: exactly one succeeds.** <br>**Read:** content survives a write and read back with `\r` stripped; missing file; folder; binary file; truncation (`bytes === maxBytes`); a file exactly at the limit. <br>**Append:** adds to the end; a missing file is refused **and not created**; inserts a newline when the file lacks one (CRLF on disk); empty file; read-only file left unchanged; folder. <br>**Rename:** simple rename; **target exists: refused and both files intact**; missing source; missing target folder; illegal name; case-only rename; same name reported as "unchanged". <br>**Delete:** removes the file; missing file; folder; **a read-only file survives**; a link (junction) to a folder is not followed. <br>**Info:** size, modification time, read-only flag, folders. <br>**1000 cycles** of create, read, append and delete without running out of file handles. |
| `validate.test.js` | One check per row of section 8, asserting the exact message; the accepted path forms; resolving against the folder shown; the 260-character limit after resolving. |
| `fs_scan.test.js` | Folders come first, then files, A–Z ignoring case; hidden entries are skipped; an entry that cannot be read (a dangling junction) is still listed, with size 0. |
| `messages.test.js` | One check per row of section 10, asserting the exact string; size, date and byte formatting. |
| `faults.test.js` | Errors that can't be produced on demand are injected by replacing one `fs` function: **disk full while creating** (reported as "(disk full)", the partial file is removed); **disk full half-way through an append** (the file goes back to its old content); **short writes** (the write loop finishes them); **a failed close** and **a failed fsync** (reported as an I/O error, nothing left behind). |
| `hygiene.test.js` | The renderer never imports Node or Electron; the file logic never touches the UI or prints; no shell commands anywhere. |

## Manual script (section 12.2)

**How it was run.** The app was started with `--remote-debugging-port`. A script drove it through the Chrome DevTools protocol: it sent real key and mouse events to the page and read back the DOM, toasts and files on disk. It started from an **empty** folder on 2026-10-18. Screenshots of both themes, at 1290×850 and at 900×580, were compared with `UI_MOCKUP_GLASS.html`.

**Result: 28/28 checks passed, and no page exceptions were thrown.**

| # | Step | Result |
|---|---|---|
| 1 | `N`, type `a.txt`, two lines, `Ctrl+Enter` | **PASS**: the hint says "Available at …\a.txt", Create is enabled, the toast says `Created "a.txt" (20 bytes).`, the file is 20 bytes on disk (CRLF), and it is selected |
| 2 | `N`, type `a.txt` again | **PASS**: the hint is red, `"a.txt" already exists. Creating never replaces a file.`, Create is disabled and the file is unchanged |
| 3 | `Enter` on `a.txt` | **PASS**: the viewer shows the two lines, numbered 1–2 |
| 4 | `A`, type one line, `Ctrl+Enter`, then `Enter` | **PASS**: 3 lines with no blank line inserted; the size grew to 32 bytes |
| 5 | `F2`, type `b` (the stem is preselected), `Enter` | **PASS**: `Renamed "a.txt" to "b.txt".`, and the selection follows the file |
| 6 | Create `a.txt` again, then `F2` on `b.txt` → `a.txt` | **PASS**: the hint says `"a.txt" already exists. Renaming never replaces a file.`, Rename is disabled, and both files are unchanged |
| 7 | `Delete` on `b.txt`, `Enter` on the default, then **Delete file** | **PASS**: the sheet shows the size and date and **Cancel has focus**. Enter cancels and the file is kept. Delete file deletes it, the toast says `Deleted "b.txt".`, and the selection moves to the neighbouring row |
| 8 | Delete the selected file outside the app, then `Enter` / `A` / `Delete` | **PASS** for each key: `Cannot open/append to/delete "gone.txt": it no longer exists. The list has been refreshed.`, the file is **not re-created** and the row is gone |
| 9 | New-file names `a?b.txt`, `CON`, `con.txt`, `name.`, 300 characters, empty | **PASS**: each shows its own section 8 message, and Create stays disabled |
| 10 | Read-only file and folder: Append and Delete | **PASS**: `it is read-only` / `it is a folder` messages appear, no sheet opens, and the file is unchanged |
| 11 | Binary file (`logo.png`) | **PASS**: the details panel shows "Binary file" and "no text preview", and Open shows the binary message |
| 12 | Menus | **PASS**: `Alt+F` opens File with focus on New file, `→` moves to Go, `Esc` closes it and returns focus to the menu button. `F10`, `↓`, `Enter` opens the viewer. With nothing selected, Open, Append, Rename, Delete and File information are disabled in the menu and 4 toolbar buttons are disabled. A right-click shows the 4-item context menu and selects that row |
| 13 | Theme toggle, reduced motion, reduced transparency | **PASS**: the theme switches; with `prefers-reduced-motion` the blob animation is `none`; with `prefers-reduced-transparency` the glass loses its `backdrop-filter`. Both themes were checked by eye at full size and at 900×580 (the mockup's single-column layout) |
| 14 | Keyboard only | **PASS for steps 1–6, 8 and 9.** In step 7 the **Delete file** button was clicked by the script (it can also be reached with `Tab` then `Enter`, because the sheet traps focus). Selecting a specific row in steps 6–11 was done by clicking it |

Also checked: File → Exit opens "Close Files?" with **Stay** focused, and **Close app** ends the process.

## Follow-up checks (2026-10-18)

These were open after the first run.

| Check | How | Result |
|---|---|---|
| **Disk full** | Injected `ENOSPC` from `writeSync` (`faults.test.js`). A real full drive was not used, because making a tiny volume needs administrator rights. | **PASS after a fix.** Create reported the error and removed its partial file. Append **left half of the new text in the file**; that is fixed now (see DECISIONS #20). |
| **File over 1 MiB in the viewer** | A 2 MiB, 18,725-line text file opened through the real UI | **PASS after a fix.** The banner reads "Showing the first 1 MiB of 2097152 bytes.", exactly 1,048,576 characters are shown, and the line numbers 1–18725 are continuous and aligned. It **used to take about 5 s to appear**; it now takes **0.45 s**, and jumping to the end takes 0.27 s (see DECISIONS #21). |
| **OS "reduce motion"** | Turned off Windows "Animation effects" through `SystemParametersInfo` for the session only (nothing saved to the profile), then restored the original value (on) | **PASS.** After a restart the app reports `prefers-reduced-motion: reduce` and the background animation is `none`. A running app does not pick up the change until it restarts (README, known limitations). |
| **`npm start` with `ELECTRON_RUN_AS_NODE=1`** | Ran `npm start` from a shell that has the variable set | **PASS after a fix.** It used to start plain Node with no window; `scripts/start.js` now clears the variable. |
| **Recent folders that no longer exist** | Stored a deleted folder in Recent folders, closed the app normally, then restarted it | **PASS after a fix.** The deleted folder is dropped from the Go menu, and real folders are kept. |
| **Regression** | The whole 12.2 script again, in a new empty folder | **28/28 PASS**, no page exceptions |

**Still not checked:** an error from a physically full disk (it was simulated, see above).

## Drive picker (2026-10-18)

This machine has two ready drives, **C:** (474.7 GB) and **D:** (476.3 GB).

| Check | Result |
|---|---|
| Unit test: `fs_drives()` lists the drive the tests run on, with a label like "C:", `0 ≤ free ≤ total`, and that drive can be listed | **PASS** |
| Unit test: `formatSize` for GB and TB | **PASS** |
| The sidebar shows C: and D: at the top level; the tooltip reads "D: — 372.9 GB free of 476.3 GB" | **PASS** |
| Clicking D: opens `D:\` (26 items, Up disabled at the root, D: highlighted) | **PASS** |
| Go menu → Drives lists "C: 31.5 GB free" and "D: 372.9 GB free"; `Alt+G`, `↓`, `Enter` on C: opens `C:\` | **PASS** |
| Regression: the full 12.2 script | **28/28 PASS** in 3 runs back to back. One earlier run failed step 2 once: the script waits a fixed 0.4 s for the live hint, and that time the hint was slower. It did not happen again. |

**Not checked:** plugging in or removing a USB drive while the app is open, because no removable drive was available. The code reloads the list on `F5` and on window focus.

## Deploy readiness (2026-10-18)

| Check | Result |
|---|---|
| `npm test` | **24/24 PASS** |
| `npm run lint` | **0 warnings** |
| `npm audit` (all dependencies) | **0 vulnerabilities** |
| The 12.2 script against `npm start` | **28/28 PASS** (3 runs) |
| Packaged with `@electron/packager` 18.3.6 (README, "Build a standalone app") | **Builds.** `app.asar` is 0.24 MB and contains only `package.json` and `src/`. Before `electron` moved to `devDependencies` it was 13.9 MB, because Electron's download helpers were bundled with it. |
| The 12.2 script against the packaged `Files.exe` | **28/28 PASS**, no page exceptions |
| Drive checks against the packaged `Files.exe` | **5/5 PASS** |
| 2 MiB file in the viewer | **PASS**: truncation and line numbers are correct; it opened in 0.9 s on a busy machine (0.45 s when idle) |

**Test harness notes.** These were not app bugs:

- The test window was being clicked while the script ran; that showed up as real (`isTrusted`) mouse events. During the script, the harness now blocks real mouse clicks and hover events in the test window.
- When `Enter` activates a button, Chromium fires a trusted `click` with `detail === 0`. The guard lets those through.
- An Electron exe started from a shell that has `ELECTRON_RUN_AS_NODE=1` set runs as plain Node. End users don't have this variable.

**Installer** (`npm run dist`, electron-builder 26.17.0):

| Check | Result |
|---|---|
| Build | **PASS**: `Simple-File-Manager-Setup-2.0.0.exe` (115 MB); `app.asar` (0.23 MB) contains only `package.json` and `src/` |
| The 12.2 script against `dist\win-unpacked` | **28/28 PASS**; drives **5/5** |
| Silent per-user install (`/S`) | **PASS**: installed to `%LOCALAPPDATA%\Programs\Simple File Manager`, with a desktop shortcut, a Start menu entry and an uninstall entry ("Simple File Manager 2.0.0") |
| The 12.2 script against the installed app | **28/28 PASS**; the exe and the sidebar show the app icon |

**Not checked:** code signing, the installer wizard clicked through by hand (only the silent install was run), uninstalling, a physically full disk, and USB hot-plug.

## Responsive layout and Snap Layouts (2026-10-20)

**Layout check.** A script emulated each window size and checked that:

- the page never scrolls, and the app stays inside the window
- no button sits under the window buttons
- no controls overlap or stick out of their row, and no fixed label (toolbar, menu, size, date, status bar, chip, breadcrumb) is cut off
- the toolbar and the location row stay on one line
- at least 2 file rows are visible
- the Go menu and the New file and viewer dialogs fit inside the window

The test folder was 8 levels deep, with long names and 18 entries.

| Before | After |
|---|---|
| **0/16 sizes clean.** Every size below 900 px scrolled the whole page; the location row wrapped onto 2–4 lines at every size; the Go menu ran off the bottom of short windows; dialogs slid under the window buttons. | **21/21 clean**: the 16 sizes below plus the 5 real snapped sizes |

Sizes checked (CSS pixels):

- **125% scaling:** full 1536×864, two-thirds 1024×864, half 768×864, third 512×864, quarter 768×432, top half 1536×432
- **100% scaling at 1080p:** full 1920×1080, half 960×1080, quarter 960×540
- **1366×768 screen:** half 683×768, quarter 683×384
- **150% scaling:** quarter 640×360, third 427×720
- **Large screens:** 1440p 2560×1440, ultrawide 3440×1440
- **Minimum:** 400×340
- **Real snapped sizes on this screen:** 754×858, 754×426, 498×858, 1010×858, 1536×863

**Real window** (this PC: 1920×1080 at 125%). The test window was resized with `SetWindowPos` to each snap zone in physical pixels:

| Check | Result |
|---|---|
| Half (960×1080), quarter (960×540), third (640×1080), two-thirds (1280×1080) | **PASS**: the window took exactly that size and the page never scrolls |
| Minimum size | **PASS**: asking for 300×250 gives 400×340 |
| Maximized | **PASS**: 1536×863 |
| Snap Layouts flyout (`WM_NCHITTEST` on the caption buttons) | **PASS**: maximize returns `HTMAXBUTTON` (9), close `HTCLOSE` (20) and minimize `HTMINBUTTON` (8) |
| Window styles | Resizable (`WS_THICKFRAME`) and has a maximize box |
| Regression: the 12.2 script, drive checks, unit tests, lint | **28/28**, **5/5**, **24/24**, **0 warnings** |

**Not checked:** dragging a window into a snap zone by hand (the zones were reproduced with `SetWindowPos` instead), other monitors, and changing the DPI while the app is open.

## Spec checklist Reset (2026-10-20)

**11/11 PASS** in the running app:

- **Reset** is disabled while nothing is ticked.
- Using the app ticks items (3/10). Reset, pressed from the keyboard, brings it back to 0/10, disables the button again and moves focus to the panel's close button.
- The log is kept, "Spec checklist reset." appears, and the panel stays open.
- Items tick again after a reset.
- The panel header fits at 1536 px and at 400 px.
- Regression: the 12.2 script **28/28**, unit tests **24/24**, lint **0 warnings**.
