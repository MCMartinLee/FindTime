# FindTime

Web app to create candidate meeting slots, share a link, and collect multi-select availability from attendees.

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

## 3) Run locally

```bash
npm start
```

Local URL is usually `http://localhost:3000`.

## 4) Deploy to GitHub Pages

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
- Share links use hash routing (`#/event/<eventId>`) for GitHub Pages compatibility.
