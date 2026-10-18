# Decisions made while building (v2, glass UI)

These are choices that `PROJECT_STRUCTURE.md` left open, and places where the build differs from it or from `UI_MOCKUP_GLASS.html`.

1. **Toolkit (D1): Electron.** The user confirmed this on 2026-10-18. The earlier C + PDCurses build was first kept in `c-tui/` instead of being deleted. On 2026-10-18 it moved, unchanged, to its own project, `D:\Projects\Simple_File_Management_System_TUI_C`, together with copies of its plan (`PROJECT_STRUCTURE_C-TUI_v1.md`) and mockup (`UI_MOCKUP.html`).
2. **ES modules everywhere except the preload.** `package.json` has `"type": "module"`. A sandboxed preload must be CommonJS, so the file is `src/preload/preload.cjs`, not `preload.js`.
3. **Formatters in `src/shared/format.js`.** `formatSize`, `formatModified` and `byteLength` are needed by the renderer, which cannot import `util.js` because that file uses `node:path`. `util.js` re-exports them for the main process.
4. **Validation returns the resolved path.** `fm.validate(input, base)` runs `fm_resolve_input`: it validates the input, resolves it against the folder shown and checks the 260-character limit. The renderer never builds paths itself, except to join a listed name onto the current folder using `fm.sep`.
5. **Extra preload members.** The preload also exposes `startDir()` (the folder from the command line, otherwise Documents), `sep` and `crlf`, which the live byte counter uses. Nothing else from Node or Electron is exposed.
6. **`FmFileInfo.id`.** Info results carry an `id` built from `dev:ino`, so the Rename hint can tell a case-only rename ("Changing only the capital letters is fine.") from a real conflict.
7. **Window frame.** The window uses `titleBarStyle: 'hidden'` with a transparent `titleBarOverlay`. The page draws the glass window, and the real minimize/maximize/close buttons sit in a draggable 40px strip above it. The mockup's decorative window buttons were removed, and so was the native menu (the page has its own).
8. **Sidebar tree.** A real disk is too large to show in full. The tree shows drive → … → current folder, then that folder's subfolders. Long paths are shortened in both the tree and the breadcrumbs (drive, "…", last folders), and the full path shows on hover.
9. **Go menu.** The mockup's "Open demo folder" and "Open backup folder" items were replaced by **Open folder…** (native picker) and **Recent folders** (the last 5, stored in `localStorage`), as section 4.3 asks.
10. **Refresh button in the top row.** Section 4.1 shows one; the mockup had none.
11. **Hidden entries are recognised by name** (see README, known limitations): Node cannot read the Windows hidden attribute. The code marks this with a `shortcut:` comment.
12. **Renaming folders is blocked in the UI** with "it is a folder", following section 10. `fm_rename` itself would allow it, since section 7 does not forbid it.
13. **Where errors appear in sheets.** Inside the Append and Rename sheets, a "no longer exists" error closes the sheet, shows a toast and refreshes the list (the stale-file rule). Other errors stay in the sheet's hint line so the user can fix them and retry.
14. **Small additions:** toasts have a dismiss button (section 4.6 says they can be dismissed), the viewer shows a truncation banner, scrollbars are styled to match the glass, breadcrumbs have a maximum width, and the "Try a failure" panel text now points at File Explorer, since the mockup's simulate/reset buttons were removed.
15. **No inline styles.** The CSP is `style-src 'self'`, so the tree indent is set through CSSOM (`style.setProperty('--d', …)`). The mockup's two inline `style=""` attributes became the classes `dl.keys` and `.warn-ico.accent`.
16. **Dependencies.**
    - `@fontsource/*` are dev dependencies: their `.woff2` files (and licenses) were copied into `src/renderer/fonts/`, so they are not needed at runtime.
    - `@eslint/js` and `globals` were added; ESLint's flat config needs them.
    - `electron-builder` (packaging) was not added.
17. **Theme and recent folders** are stored in `localStorage`. This is a convenience only: if storage fails, the app still works.
18. **No git commits.** The folder is not a git repository.
19. **Spec panel flag.** `SHOW_SPEC_PANEL` in `src/renderer/app.js` removes the checklist and the log when set to `false`.
20. **Append undoes a partial write.** If an append fails part-way, for example with a full disk, the file is truncated back to its old size. This happens *by path* after the handle is closed, because on Windows an `O_APPEND` handle has no right to shorten the file. A fault-injection test covers this; it was found by that test.
21. **Large files in the viewer.** The viewer splits text into 400-line blocks that use `content-visibility: auto`, so Chromium skips painting off-screen blocks. With one large text node, a 1 MiB file took about 5 s to appear; it now takes about 0.45 s. The number column width is set once (`--lnw`), so every block lines up. When a file is truncated, the line-count chip says "N lines shown".
22. **`npm start` launcher.** `scripts/start.js` starts Electron with `ELECTRON_RUN_AS_NODE` removed. It is a dev launcher outside `src/` and the only place that uses `child_process`; the app itself does not.
23. **Recent folders are pruned at startup:** folders that no longer exist are removed from the Go menu.
24. **Drive picker** (requested 2026-10-18). `fs_drives()` in `fs_scan.js` probes `A:\` to `Z:\` in parallel with `fs.promises.statfs`. A drive that answers is listed with its total and free space; an empty card reader or DVD drive fails and is skipped. Each probe gives up after 1.5 s, because a disconnected network drive can hang. On other systems the list is just `/`.
    - This is the only `async` function in the file logic, since a slow drive must not block the main process. It is exposed as `window.fm.drives()`.
    - **Sidebar:** shows every drive at the top level, with the open drive expanded. This replaces part of #8, which showed only the current drive.
    - **Go menu:** a **Drives** section shows each drive's free space.
    - The list is re-read at startup, on Refresh (`F5`) and when the window regains focus, so a USB stick appears without restarting.
    - `formatSize` now goes up to GB and TB. It used to stop at MB, so a 2 GB file showed as "2048.0 MB".
25. **`electron` is a dev dependency.** The packaged app ships its own Electron runtime. With `electron` under `dependencies`, the packager warned and bundled Electron's downloader into `app.asar` (13.9 MB instead of 0.24 MB). No packager was added to `package.json`; the build command is in the README.
27. **Windows installer** (requested 2026-10-18). This replaces the packager command from #25 and the "electron-builder was not added" note in #16.
    - `npm run dist` runs electron-builder 26.17.0. Version 25.1.8 had 12 known vulnerabilities, 1 of them critical.
    - It builds an NSIS installer with the usual wizard (`oneClick: false`). It installs per-user by default, so no administrator rights are needed, and the user can choose the folder.
    - `productName` is "Simple File Manager", so the app's settings folder moved from `%APPDATA%\simple-file-manager` to `%APPDATA%\Simple File Manager`. The theme and recent folders start fresh once.
    - `npm audit` still reports 8 moderate findings: `sprintf-js` through the build tool's proxy helper, with no fix released. They affect only the build machine; the shipped app has 0 (`npm audit --omit=dev`).
26. **App icon** (requested 2026-10-18). It comes from `icon/file manager icon.jpg`. The JPG has a white background, so `scripts/make-icon.ps1` makes the white around the edge transparent with a flood fill from the border; the white paper inside the folder stays opaque. It writes:
    - `icon/app.ico` (16–256 px): the exe icon, set with the packager's `--icon`
    - `src/renderer/icon.png` (256 px): the window and taskbar icon (`main.js`), and the sidebar logo, which replaces the mockup's gradient square
    - The script uses Windows' built-in System.Drawing, so no image dependency was added.
