# SoundFox Store Compliance & Publishing Justifications

## Build Matrix Requirements
When finalizing your active compilation, manually executing `npm run build` will actively generate **BOTH** the `dist/firefox` and `dist/chrome` bundles mechanically via NPM logic triggers. Because you are primarily debugging and targeting the Mozilla Add-ons marketplace locally, **you must prioritize loading explicitly from your unpacked `/dist/firefox/` directory!** VITE natively generates Mozilla-compliant `browser_specific_settings` and `gecko` validation IDs explicitly inside that bundle wrapper.

## Overarching Permissions Justification
When submitting SoundFox to the Chrome Web Store or Firefox Add-ons marketplace, the automated review systems will flag the explicit `<all_urls>` host requirement in the `manifest.json`.

Please copy and paste the following statement verbatim into your Privacy Policy or the "Permissions Justification" dialogue field during the store submission pipeline:

> "SoundFox requires standard `<all_urls>` host permissions to legally bypass CORS (Cross-Origin Resource Sharing) audio restrictions across dynamic streaming platforms such as YouTube and Netflix. This strict security override is exclusively utilized to bind a raw DOM MediaElementAudioSourceNode to our local, offline WebAudio graph, ensuring volume multipliers render identically regardless of the host's server delivery policies. SoundFox does not collect, access, read, read cookies from, nor transmit any user data whatsoever over the network."
