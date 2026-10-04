# QR Scanner UI

Light responsive interface: white cards, a mint/lavender background, clear camera status, scan results and session-only history. The onboarding illustration was created with the available image-generation tool and converted to local WebP. It is decorative, not a QR code intended for scanning.

No external image requests, new libraries or camera uploads are added. The existing local `assets/js/jsQR.js` decoder and Content Security Policy remain in place. Only explicit camera-button actions request access. Pending camera requests can be cancelled; tracks stop on errors, stop, page hide and navigation. Opening scanned links still requires a user click.