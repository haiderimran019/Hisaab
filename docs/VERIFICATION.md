# Verification — 21 October 2026

## Completed

- `npm test`: 27 passing tests covering precise settlement, decimal rounding, fees exceeding proceeds, PKR rate validation, invalid dates and July–June boundaries, every business-slab boundary, surcharge threshold, unsupported years, 154A rates/conditions including the PSEB sales-return exception, separate tax bases, withholding segregation, unsupported profiles, expense allocation, strict schemas, CSV formula injection, HTML escaping, zero confirmed export bases, unsafe aggregate precision, AJK/GB review gate and authenticated encrypted-backup round trips/tampering/wrong passphrases.
- `npm run build`: TypeScript check and Vite production build pass.
- Dependency installation audit: zero vulnerabilities in the installed dependency tree at installation. This is a point-in-time package audit, not a penetration test.
- Browser: income creation, editing and search with a six-decimal FX rate; script-shaped text safely rendered; expense business-use allocation; invoice creation, quantity × price and print preview; encrypted-vault setup with isolated synthetic QA data; no demo copied into vault; persistence across reload; locked reload; wrong-passphrase rejection; successful unlock; encrypted backup download; restore consent rejection and successful authenticated restore.
- Browser: tax gates and tax-year switching, FX calculator, source links and responsive desktop/mobile layouts. Screenshots contain only labelled synthetic demo data.

## Limits

The five-minute lock is implemented and reviewed; a full timed idle soak is not recorded. Receipt upload uses file MIME/signature/size validation, but all file types have not been exercised in the browser. Downloaded backups are verified in Node crypto tests and browser restoration; arbitrary malformed backup fuzzing is not exhaustive. Live FX depends on provider/network availability and is not a price guarantee. No real bank transfer, FBR submission, email, subscription payment or government registry verification was performed.

Independent accountant review, province-specific tax coverage, accessibility audit, penetration testing, live HTTP-header enforcement and production commercial readiness remain outstanding. Do not describe this release as covering every Pakistani tax or as a certified filing system. Browser checks were performed through the provided computer-use interface; the repository does not claim an automated full-browser regression suite.
