# Changelog

## 0.2.0

- `daylines key <name>` saves any secret, not only a Plausible key, and `{key:name}`
  in a source is replaced with it. Existing Plausible keys move themselves into the
  new keys folder on first run.

## 0.1.0

First release.

- Sources: any shell command, any JSON endpoint, and a built-in Plausible type.
- One all-day event per line, with stable ids so a refresh replaces yesterday.
- A failing source shows its own error instead of emptying the feed.
- Background service on macOS (launchd) and Linux (systemd user unit).
- `daylines publish` serves the feed on your `*.ts.net` name through Tailscale.
