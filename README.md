# Family Finance Tracker

---

## First-time deploy to GitHub Pages (~15 mins)

### Step 1 — Install tools (one-time)
- **Node.js**: https://nodejs.org (download LTS)
- **Git**: https://git-scm.com/download/win (Windows) — Mac has it already

### Step 2 — Create GitHub repo
1. Go to https://github.com and create a free account if needed
2. Click **New repository** → name it exactly: `family-finance`
3. Set to **Public** (required for free GitHub Pages)
4. Click **Create repository** — leave it empty

### Step 3 — Enable GitHub Pages
Repo → **Settings** → **Pages** → Source: **GitHub Actions** → Save

### Step 4 — Push the code
Open Command Prompt / PowerShell in the unzipped folder:

```
npm install
git init
git add .
git commit -m "first deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-finance.git
git push -u origin main
```

Replace YOUR_USERNAME with your GitHub username.

### Step 5 — Wait ~2 minutes
Repo → Actions tab → green tick = deployed.
Your app is live at: https://YOUR_USERNAME.github.io/family-finance

### Step 6 — Install on Android
1. Open Chrome on Android
2. Go to https://YOUR_USERNAME.github.io/family-finance
3. Chrome menu (three dots) → Add to Home Screen
4. Installed as standalone app, works offline

---

## Making updates later
Edit any file, then:
```
git add .
git commit -m "what you changed"
git push
```
GitHub rebuilds in ~2 mins. App on phone updates automatically.



---

## If you rename the repo
Change this line in vite.config.js:
```
const BASE_PATH = "/family-finance/";
```
to match your repo name.
