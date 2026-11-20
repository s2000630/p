# Full-Stack Web Portal (Front-End + Back-End)

This project includes both the front-end interface (`public/`) and the Node.js back-end (`server.js`) so you can run your own complete website.

## Project Files
- `server.js` — Back-end server that fetches webpages, rewrites links/styles/forms, and adds a top navigation bar.
- `package.json` — Node.js dependencies (`express`).
- `public/index.html` — Front-end search and URL entry page.
- `public/style.css` — Front-end styling.
- `public/app.js` — Front-end form and optional remote backend connector.

## How to Run Locally
1. Make sure **Node.js 18+** is installed.
2. Open a terminal in this folder and run:
   ```bash
   npm install
   npm start
   ```
3. Open `http://localhost:3000` in your browser.

## How to Host Online
Because this includes a live back-end server, deploy the folder to a Node.js host rather than GitHub Pages alone:
1. Upload these files to a new GitHub repository.
2. Create a free web service on **Render**, **Railway**, or **Glitch** and connect your repository.
3. Set the Build Command to `npm install` and the Start Command to `npm start`.
4. *(Optional)* If you also want to use your `github.io` domain, upload the contents of `public/` to GitHub Pages and put your Render/Railway URL into `BACKEND_URL` at line 4 of `public/app.js`.
