# SoundFox Publishing Notes

This file tracks practical release steps for Firefox Add-ons and Chrome Web Store submissions.

## Build Targets
Run:
```bash
npm run build
```

This creates both bundles:
- `dist/firefox` (Firefox package/load target)
- `dist/chrome` (Chrome package/load target)

For Mozilla review testing, load the unpacked extension from `dist/firefox`.

## Release Checklist
1. Confirm version is aligned in:
- `manifest.json`
- `package.json`
- `package-lock.json`
- Popup version label in `src/main.ts`
- `README.md`

2. Run local validation:
```bash
npm run typecheck
npm run build
```

3. Confirm CI is green for the release branch/PR:
- `.github/workflows/ci.yml`

4. Submit the correct bundle per store:
- Firefox Add-ons: package from `dist/firefox`
- Chrome Web Store: package from `dist/chrome`

## Permissions Justification (`<all_urls>`)
Use this in store submission fields when reviewers ask why host permissions are required:

> SoundFox requires `<all_urls>` host permissions to attach a local WebAudio processing graph to media elements across streaming sites. The permission is used only to apply user-requested audio controls (volume, EQ, dialog, and leveling) consistently on supported pages. SoundFox does not collect, sell, or transmit personal browsing data.

## Notes
- Keep release notes focused on user-visible changes and risk level.
- If permission scope changes, update this document before submission.
