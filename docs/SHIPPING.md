# Shipping Lantern Drift on Mipmap (about 10 minutes)

Target: ship by **Fri 13 Nov 2026** (end of day UTC) to be reviewed by 20 Nov.
That also counts toward the "Steve's in trouble!" challenge, which needs projects shipped before it ends.

Mipmap's "Edit project" form asks for a **Repo** (public code on GitHub) and a **Demo** (a public link to play it).
The Ship button also needs a screenshot that only reviewers see.

## 1. Tell git who you are (once)
Use your GitHub username and GitHub's private "noreply" email, so your real email isn't public.
Find it at github.com → Settings → Emails ("Keep my email addresses private"). It looks like `12345678+yourname@users.noreply.github.com`.
```
git config --global user.name "your-github-username"
git config --global user.email "12345678+your-github-username@users.noreply.github.com"
```

## 2. Save the work as a commit
In your project folder (the one with `index.html` in it):
```
git add -A
git commit -m "Lantern Drift: 5 levels, currents, bloom, particles, music, settings"
```

## 3. Put it on GitHub
1. github.com → New repository → name `lantern-drift` → **Public** → no README (we already have one) → Create.
2. Copy the two lines GitHub shows under "push an existing repository", e.g.
```
git remote add origin https://github.com/your-github-username/lantern-drift.git
git push -u origin main
```

## 4. Turn on the playable demo (GitHub Pages)
Repo → Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, folder `/ (root)` → Save.
After a minute the game is live at `https://your-github-username.github.io/lantern-drift/`.
Open it and check it plays (no server needed: it's all static files).

## 5. Fill in Mipmap and ship
1. Mipmap dashboard → Lantern Drift → Edit:
   - Repo: `https://github.com/your-github-username/lantern-drift`
   - Demo: `https://your-github-username.github.io/lantern-drift/`
   - Hackatime projects: make sure `mipmap-game` is ticked. Save.
2. "Upload screenshot": use `docs/snapshot-effects.png` (or take your own with F9 while playing).
3. Press **Ship**.

## Before you ship: honesty checklist
- Mipmap allows AI, but AI time counts about a third less, and "vibecoding" a whole project is discouraged.
  Be upfront with reviewers that Claude Code helped build it (the Snapshot captions already say so).
- The more of it you understand and change yourself, the better. Good things to try by hand:
  tweak a level map in `src/levels.js`, change colours in `src/meshes.js`, or tune `drain` and `creatureSpeed`.
- Play all 5 levels yourself once, so you can talk about the game confidently.
