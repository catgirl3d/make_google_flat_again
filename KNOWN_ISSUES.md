# Known Issues

## Firefox favicon flash on Google Sheets

Status: unresolved for store-safe build.

Symptom:
- In Firefox, the tab favicon for Google Sheets can briefly show the wrong icon at the very end of page load, right when the tab spinner disappears.

What we know:
- This is not only a DOM timing issue.
- Browser-level diagnostics showed Firefox still holding one favicon bitmap at `status: complete`, then switching to another bitmap about 200-400 ms later.
- That means content-script and page-script favicon rewrites can still lose to Firefox's internal favicon/tab UI pipeline.

What we decided:
- Do not ship invasive Firefox-only request blocking for store builds just to suppress this flash.
- Keep this issue documented and prefer rollback over risky permissions/workarounds.

Possible future direction:
- Separate experimental Firefox-only build with request blocking/redirect for Google favicon URLs, if the tradeoff becomes acceptable.
