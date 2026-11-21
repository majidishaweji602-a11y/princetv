# STARR FLIX
**Entertainment without limits.** An Entertainment Platform by **SANCHO TECH**.

React + TypeScript + Tailwind + HLS.js frontend, with a small Node/Express backend for the secure admin dashboard.

## Quick start
```bash
npm install
cp .env.example .env          # then edit (see below)
npm run dev                   # site on http://localhost:5173, API on :8787
```
Production: `npm run build && npm start` (Express serves `dist/` and the admin API on `PORT`, default 8787).

## Admin setup (required for /admin)
```bash
npm run hash-password -- "your-strong-password"     # paste output into ADMIN_PASSWORD_HASH
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste into JWT_SECRET
```
Set `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET` in `.env`. Without them admin login is disabled (the public site still works).
Security: bcrypt password hash, signed JWT in an `httpOnly` + `SameSite=Strict` (+`Secure` in production) cookie, login rate-limiting, a CSRF header check on every state-changing call, and `requireAdmin` on every `/api/admin/*` route. No secrets are ever bundled into the frontend. Serve over HTTPS in production (and set `NODE_ENV=production`).

## ⚠️ Read this: DramaBox API
The DramaBox response could **not be inspected** while this was built (the host was unreachable from the build environment), so nothing about its shape was invented as fact. `src/services/drama.ts` reads the response defensively (finds the list anywhere in the JSON, tries common field names for id/title/cover/description/tags/episodes/video URL, and searches for `.m3u8`/`.mp4` links).
**First thing to do:** open `/admin` → **API status** → **Fetch raw response**, compare it with the `KEYS` table at the top of `drama.ts`, and add/rename keys if something is missing. Search runs client-side over the catalogue; if your API has real search/detail endpoints, set `VITE_DRAMA_SEARCH_URL` / `VITE_DRAMA_DETAIL_URL` (use `{q}` / `{id}`).
Episode numbering follows the order of the API's episode list. "Recently Added" shows the end of the list (no date field is assumed).

## IPTV notes
Uses `/countries /languages /categories /streams /channels /guides /blocklist /regions /timezones` `.json`. Channels are joined with their streams; blocklisted, closed and NSFW channels are excluded; languages come from each channel's country.
- `guides.json` in the iptv-org schema lists EPG *sources* per channel, not programme times. The TV Guide shows real schedules automatically if your proxy returns `title` + `start` fields; otherwise it shows the guide sources.
- Browsers can't send custom `Referer`/`User-Agent` headers, so streams that require them (flagged in the UI) may fail; the player auto-skips to the next stream. `http://` streams are blocked on HTTPS sites (mixed content) and skipped. Some streams also need CORS to be enabled by the provider.
- Respect each provider's licensing; only API-supplied URLs are used.

## Features map
Home (carousel, trending, popular channels, recently added, continue watching, recommended) · Live TV (filters, sidebar, stream info, guide, PiP, fullscreen) · DramaBox (search, tags, detail, episodes, resume) · Movies · Sports · TV Guide · Categories (with icons) · Search (+suggestions) · Watchlist · History · About · Contact · Admin (stats, API status/inspector, featured & hidden content, managed users, settings/maintenance banner, error monitoring) · dark/light mode · mobile bottom nav · 5-minute API cache with skeletons, retries and error boundaries.

User data (favourites, history, progress, theme) lives in the visitor's `localStorage`. Admin data is stored in `server/data.json`.


## Custom live channels and EPG

The 18 custom live channels are configured in `src/data/custom-channels.json`. Their supplied stream URLs are used as-is. Channel artwork in `public/channel-logos/` is a local text-based placeholder logo, not an official broadcaster logo.

The TV Guide endpoint is served by the Node backend at `/api/epg`. It fetches the public Teleonline XMLTV guide server-side, matches display names against each channel's `epgNames`, and caches the result for six hours. Set `EPG_XMLTV_URL` to an alternate uncompressed XMLTV URL if needed. Programme artwork is displayed only when the guide includes a programme icon. EPG coverage varies by channel and is not guaranteed.

Some supplied streams use plain HTTP. Browsers block HTTP video streams when STARRFLIX is served over HTTPS (mixed-content security); those streams need HTTPS URLs from the stream provider to play on an HTTPS deployment.
