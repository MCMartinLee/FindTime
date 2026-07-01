# FindTime

Free web app to create candidate meeting slots, share a link, and collect multi-select availability from attendees.

## Why I Created This

I started FindTime while trying to schedule my dissertation defense. Most scheduling webpages I found were not fully free or had limitations that got in the way, so I decided to build a simple alternative that lets people create and share availability polls without those restrictions.

## Features

- Create an event with a title, timezone, location, and directions link.
- Search for locations with Google Maps when a Maps API key is configured.
- Choose an event length, such as 30 minutes, 1 hour, or 3 hours.
- Add multiple candidate start times on the same day or across different days.
- Keep candidate start times aligned to every half hour.
- Let attendees select every time option that works for them.
- Show overlapping options in a calendar-style view.
- Emphasize popular time options with stronger color as more people vote for them.
- Keep a ranked list of options with voter names below the visual calendar.

## 1) Install

```bash
npm install
```

## 2) Firebase setup

1. Create a Firebase project.
2. Enable Firestore Database (production or test mode).
3. In Firebase project settings, create a Web app and copy config values.
4. Copy `.env.example` to `.env` and fill all `REACT_APP_FIREBASE_*` values.
5. In Firestore rules, paste `firestore.rules` and publish.

## 3) Google Maps setup

Google Maps search is optional. Without it, users can still type a location manually.

1. Create or open a Google Cloud project.
2. Enable the Maps JavaScript API and Places API.
3. Create an API key and restrict it to your app domains.
4. Add it to `.env`:

```bash
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## 4) Run locally

```bash
npm start
```

Local URL is usually `http://localhost:3000`.

## 5) Deploy to GitHub Pages

1. Update `homepage` in `package.json`:
   - `https://YOUR_GITHUB_USERNAME.github.io/FindTime`
2. Commit and push repo to GitHub.
3. Run:

```bash
npm run deploy
```

4. Your app URL:
   - `https://YOUR_GITHUB_USERNAME.github.io/FindTime`

## Notes

- Slots are stored in UTC and displayed in the event timezone.
- Event duration is stored once per event and used to display each candidate start time as a full time range.
- Optional location and directions fields help direct attendees to the selected event place.
- Firestore rules must be republished when event fields change.
- Share links use hash routing (`#/event/<eventId>`) for GitHub Pages compatibility.
