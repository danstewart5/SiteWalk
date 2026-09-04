# SiteWalk

Job site documentation made simple.

Walk the site, take photos, record voice notes, and get instant AI-generated reports.

## Getting Started
Open index.html in your browser to try the prototype. Best over HTTPS on a phone.

## What works now
- **Photos**: Open Camera streams the rear camera with a live preview and Capture button. Falls back to file upload if the camera is blocked.
- **Voice notes**: Records audio and transcribes live with the Web Speech API (best in Chrome on Android). Transcripts are tagged with the selected trade and included in the printed report. Audio is kept as a backup when captions miss words.
- **Punch list**: Add issues manually; they appear in the report.
- **Persistence**: Photos, notes, and punch items save to the browser so a refresh does not wipe them.
- **Report**: Groups everything by trade and prints cleanly.

## Limits
- Live captions need network on Chrome. Safari is patchier.
- No cell signal: audio recording still works; transcription may not.
- Data lives in the browser only — no cloud sync yet.

Built with the user for real construction workflows.
