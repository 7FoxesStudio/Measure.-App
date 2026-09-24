![Measure app screenshot](Measure.png)

MEASURE — building a portable Windows .exe
============================================

You need Node.js installed on the Windows PC you're building from
(download from nodejs.org — the LTS version is fine).

1. Unzip this folder anywhere, e.g. Desktop\measure-electron

2. Open PowerShell (or Command Prompt) in that folder.
   Easiest way: in File Explorer, open the measure-electron folder,
   click the address bar, type "powershell", hit Enter.

3. Install dependencies:
     npm install

4. (Optional) Try it first without building:
     npm start
   This opens the app in a window right away, no build needed —
   good for checking everything looks right first.

5. Build the portable .exe:
     npm run dist

6. When it finishes, look in the new "dist" folder for:
     Measure-Portable.exe

   That single file is the whole app. Copy it anywhere — a USB
   drive, a shared folder, Slack, email — and your colleagues can
   just double-click it to run Measure. No installer, no admin
   rights, nothing else to unzip.

Notes:
- The first "npm install" downloads Electron itself (~100+ MB),
  so it needs a real internet connection and a couple of minutes.
  After that, the app runs completely offline.
- If Windows SmartScreen warns about an "unrecognized app" the
  first time someone runs it, that's normal for an unsigned .exe —
  click "More info" -> "Run anyway". Getting rid of that warning
  requires a paid code-signing certificate, which is a separate
  step if you ever want to skip it.
- To change the app icon, drop a 256x256 icon.ico file in this
  folder and add "icon": "icon.ico" under "win" in package.json,
  then rebuild.
