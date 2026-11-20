// Optional: Set BACKEND_URL if you host the front-end on GitHub Pages
// and your Node.js server separately (e.g. "https://your-app.onrender.com").
// Leave blank ("") when running front-end and back-end together.
const BACKEND_URL = "";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("portalForm");
  const input = document.getElementById("urlInput");

  if (BACKEND_URL) {
    form.action = BACKEND_URL.replace(/\/$/, "") + "/go";
    document.querySelectorAll(".quick-links a").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("/go")) {
        link.href = BACKEND_URL.replace(/\/$/, "") + href;
      }
    });
  }

  form.addEventListener("submit", (e) => {
    const val = input.value.trim();
    if (!val) {
      e.preventDefault();
    }
  });
});
