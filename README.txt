MEASURE v1.1.0 - on-screen ruler (Windows app only)
====================================================

Put these 5 files in your project folder (the one with node_modules),
replacing the old index.html, main.js and package.json:

    index.html   main.js   preload.js   edid.js   package.json

Keep icon.ico where it is. In GitHub Desktop, preload.js and edid.js show
up as NEW files - commit them with the rest.

If you'd rather not replace package.json: the only change in it is that
"files" must list the two new files, or the built .exe will fail to start:

    "files": ["main.js", "preload.js", "edid.js", "index.html", "icon.ico"]

Then:
    npm start        (try it)
    npm run dist     (build)

USING THE RULER
- It sits along the bottom of the window. Bottom-right of the strip shows
  what it believes your screen is, e.g.  ~27.0 in . auto
  If that diagonal matches your monitor, you're calibrated.
- Check it once by holding a real ruler against the screen.
- If it's off or says "uncalibrated": click "cal", then either type your
  screen's diagonal in inches, or hold a credit card to the screen and drag
  the slider until the outline matches. Saved per monitor.
- "mm" button switches between millimetres and inches.
- Hide it with the x, or switch it back on from the Tools menu.

If auto-detect gets blocked on a colleague's PC (some antivirus dislikes apps
that run PowerShell), change this line at the top of main.js:
    const AUTO_DETECT_MONITOR_SIZE = true;   ->   false
The ruler then works from manual calibration only.
