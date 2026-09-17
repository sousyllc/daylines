# Daylines

Put anything you want to keep an eye on into your calendar, as all-day events for
today. Anything that shows your calendar then shows them: your phone's lock screen,
your watch, your car, a wall display, your glasses.

```
Sousy 51 visits · 2 App Store · 1 Play
Sousy iOS 5★ · 4 ratings
CI passing
New York 78°F high
```

It runs on your own computer. Nothing is sent anywhere except the calendar feed
your phone subscribes to.

## Why a calendar

Almost every screen you own already renders your calendar, and almost none of them
let you add a custom widget. A subscribed calendar is the way in, with no app to
install on the device and nothing to open.

That means the same feed shows up on:

- your phone's lock screen and home screen widgets
- your watch complications
- your car, when it reads out or displays today's schedule
- a TV or wall display running a calendar dashboard
- Google Calendar, Outlook, Fantastical and anything else that takes a URL
- smart glasses. Even Realities G2, for example, has a Calendar widget on its
  dashboard but no way for an app to draw there

## Install

```sh
npm install -g @sousy/daylines
daylines service install     # background service (launchd or systemd)
```

## Add sources

Sources live in `~/.config/daylines/config.json`. Every source produces one or more
lines, and every line becomes an all-day event.

```json
{
  "calendarName": "Daylines",
  "refreshMinutes": 10,
  "sources": [
    { "label": "CI", "command": "gh run list -R you/repo -L1 --json conclusion -q .[0].conclusion" },
    { "label": "Weather", "url": "https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&daily=temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=1", "pick": "daily.temperature_2m_max.0", "format": "{label} {value}°F high" }
  ]
}
```

`daylines` prints the lines so you can see what you'd get before subscribing.

**Command sources** run a shell command and use its output. Each non-empty line
becomes an event, up to `maxLines` (3 by default).

**URL sources** fetch a URL. With `pick`, the response is parsed as JSON and that
dotted path is read, so `results.0.userRatingCount` works. Without `pick`, the whole
response body is used, which suits an endpoint that returns a bare number. Add
`headers` for an API token.

**Both** accept `format`, a template over the source's own fields plus `{value}`,
for example `"{label}: {value} open"`.

A source that fails puts its own error on the calendar instead of emptying the feed,
so you can tell the difference between zero and broken.

## Subscribe

```sh
daylines url
```

On iPhone: Settings, Apps, Calendar, Calendar Accounts, Add Account, Other, Add
Subscribed Calendar, then paste the link. On Android, add it in Google Calendar as
a URL calendar with `https://` instead of `webcal://`.

The link carries a read-only token, because phones store subscribed calendar URLs.
The feed only listens on `127.0.0.1`, so the phone needs a way in. The simple one is
[Tailscale](https://tailscale.com): install it on both, then

```sh
daylines publish     # serves the feed on this machine's *.ts.net name over HTTPS
```

On iPhone, set Settings, Apps, Calendar, Accounts, Fetch New Data to every 15
minutes, otherwise it can be lazy about refreshing.

## Examples

**Site traffic (Plausible).** A built-in source, since it needs a signed request.
Create a Stats API key in Plausible, save it with `daylines key`, then:

```json
{ "label": "Shop", "type": "plausible", "site": "example.com",
  "visitors":  { "goal": ["Homepage visited"] },
  "appStore":  { "goal": ["App Store Badge Clicked", "app_store_clicked"] },
  "playStore": { "goal": ["Google Play Badge Clicked", "play_store_clicked"] } }
```

Every count is unique visitors for today. The Stats API matches goals by their
display name, so list the display name first and the raw event name after it.
Leave `visitors` as `{}` to count everyone.

**App Store rating and review count.** Find your numeric app id in its store URL, or look it up with `curl -s "https://itunes.apple.com/search?term=your+app&entity=software" | jq -r ".results[] | \"\(.trackId) \(.trackName)\""`.

```json
{ "label": "Sousy iOS",
  "command": "curl -s 'https://itunes.apple.com/lookup?id=6746349702&country=us' | jq -r '.results[0] | if .userRatingCount == 0 then \"no ratings yet\" else \"\\((.averageUserRating*10|round)/10)★ · \\(.userRatingCount) ratings\" end'" }
```

**Is the build green.**

```json
{ "label": "CI", "command": "gh run list -R you/repo -L1 --json conclusion -q .[0].conclusion" }
```

**Pull requests waiting on you.**

```json
{ "label": "PRs", "command": "gh search prs --review-requested=@me --state=open --json title -q 'length'", "format": "{label} {value} waiting" }
```

**npm downloads.**

```json
{ "label": "npm", "url": "https://api.npmjs.org/downloads/point/last-week/react", "pick": "downloads", "format": "{label} {value} last week" }
```

**GitHub stars.**

```json
{ "label": "Stars", "command": "gh api repos/you/repo -q .stargazers_count" }
```

**Is the site up.**

```json
{ "label": "example.com", "command": "curl -s -o /dev/null -w '%{http_code} in %{time_total}s' https://example.com" }
```

**Today's cloud spend.**

```json
{ "label": "AWS", "command": "aws ce get-cost-and-usage --time-period Start=$(date -u +%F),End=$(date -u -v+1d +%F) --granularity DAILY --metrics UnblendedCost --query 'ResultsByTime[0].Total.UnblendedCost.Amount' --output text | cut -c1-5", "format": "{label} ${value} today" }
```

**Anything local.** Battery health, disk space, a count out of a database, the
number of words you wrote today. If a command prints it, it can be on your calendar.

```json
{ "label": "Disk", "command": "df -h / | awk 'NR==2 {print $4\" free\"}'" }
```

## Commands

```
daylines                 print today's lines
daylines key             save a Plausible Stats API key
daylines serve           run the feed in the foreground
daylines service         install | uninstall | restart | status
daylines publish         serve the feed on this machine's *.ts.net name
daylines url             print the subscribe link for the phone
```

## Notes

- Events are all-day and marked free, so they never block time or send alerts.
- Event ids are stable per line and day, so a refresh replaces the old numbers
  rather than piling up.
- Commands run with your shell and your environment, and the config file holds the
  feed token, so it is created with mode 600. Only put commands in it that you would
  run yourself.

MIT, Sousy LLC.
