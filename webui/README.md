# Expected Web UI asset inputs

This directory is the expected location for a local copy of the AMICO Web UI
static assets (HTML/JS served from `http://192.168.2.156/en_US/html/index.html`),
used for the JavaScript analysis in `docs/amico-protocol-map.md`.

No files are present yet. To populate it, mirror the read-only pages/scripts, e.g.:

```
wget --mirror --no-parent -e robots=off http://192.168.2.156/en_US/html/ -P webui/
```

or save the JS/HTML files manually from the browser (View Source / DevTools →
Sources) for the pages you are allowed to browse. Do not use write-triggering
actions (form submits, user creation, config changes) to obtain files.
