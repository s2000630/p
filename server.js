const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Allow cross-origin requests if you host the front-end separately (e.g., GitHub Pages)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Normalize user input into a valid URL or a DuckDuckGo HTML search URL
function normalizeInput(raw) {
  const input = (raw || "").trim();
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    return input;
  }
  if (!/\s/.test(input) && /^([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(input)) {
    return "https://" + input;
  }
  return "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(input);
}

// Convert a relative URL against a base URL and wrap it in /go?url=...
function wrapUrl(rawUrl, baseUrl) {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return rawUrl;
  }

  try {
    const resolved = new URL(trimmed, baseUrl).href;
    return "/go?url=" + encodeURIComponent(resolved);
  } catch {
    return rawUrl;
  }
}

// Rewrite url(...) inside CSS files or <style> blocks
function rewriteCss(cssText, baseUrl) {
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, assetUrl) => {
    const wrapped = wrapUrl(assetUrl, baseUrl);
    return `url(${quote}${wrapped}${quote})`;
  });
}

// Rewrite HTML links, assets, forms, and inject a top navigation bar
function rewriteHtml(html, baseUrl) {
  // 1. Remove any <base> tags that would break relative /go?url= paths
  let output = html.replace(/<base\b[^>]*>/gi, "");

  // 2. Rewrite <form ... action="..."> so GET/POST forms route through /form-submit
  output = output.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
    const actionMatch = attrs.match(/\baction\s*=\s*(['"])(.*?)\1/i);
    const rawAction = actionMatch ? actionMatch[2] : "";
    let resolvedAction = baseUrl;
    try {
      resolvedAction = rawAction ? new URL(rawAction, baseUrl).href : baseUrl;
    } catch {
      resolvedAction = baseUrl;
    }

    let cleanedAttrs = attrs
      .replace(/\baction\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\bmethod\s*=\s*(['"]).*?\1/gi, "");

    return `<form${cleanedAttrs} method="GET" action="/form-submit"><input type="hidden" name="__target" value="${resolvedAction.replace(/"/g, "&quot;")}">`;
  });

  // 3. Rewrite href, src, and poster attributes
  output = output.replace(
    /\b(href|src|poster)\s*=\s*(['"])(.*?)\2/gi,
    (match, attr, quote, val) => {
      return `${attr}=${quote}${wrapUrl(val, baseUrl)}${quote}`;
    }
  );

  // 4. Rewrite srcset attributes
  output = output.replace(/\bsrcset\s*=\s*(['"])(.*?)\1/gi, (match, quote, val) => {
    const rewrittenSet = val
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        if (!parts[0]) return entry;
        parts[0] = wrapUrl(parts[0], baseUrl);
        return parts.join(" ");
      })
      .join(", ");
    return `srcset=${quote}${rewrittenSet}${quote}`;
  });

  // 5. Rewrite inline CSS url(...)
  output = output.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => {
    return open + rewriteCss(css, baseUrl) + close;
  });

  // 6. Inject a floating mini navigation bar at the top of the page
  const navBar = `
    <div id="__p_navbar" style="position:fixed;top:0;left:0;right:0;height:44px;background:#0f172a;color:#f8fafc;display:flex;align-items:center;gap:8px;padding:0 12px;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.35);">
      <a href="/" style="color:#38bdf8;text-decoration:none;font-weight:600;font-size:14px;padding:4px 8px;border-radius:6px;background:#1e293b;">Home</a>
      <button onclick="history.back()" style="background:#1e293b;color:#e2e8f0;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px;">Back</button>
      <form action="/go" method="GET" style="flex:1;display:flex;gap:6px;margin:0;">
        <input type="text" name="url" value="${baseUrl.replace(/"/g, "&quot;")}" style="flex:1;height:30px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#f8fafc;padding:0 10px;font-size:13px;" />
        <button type="submit" style="height:30px;padding:0 12px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;font-size:13px;">Go</button>
      </form>
    </div>
    <div style="height:44px;"></div>
  `;

  if (/<body\b[^>]*>/i.test(output)) {
    output = output.replace(/<body\b[^>]*>/i, (match) => match + navBar);
  } else {
    output = navBar + output;
  }

  return output;
}

// Handle submitted forms from rewritten pages
app.get("/form-submit", (req, res) => {
  const target = req.query.__target;
  if (!target) return res.redirect("/");

  try {
    const dest = new URL(target);
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "__target") {
        dest.searchParams.set(key, value);
      }
    }
    return res.redirect("/go?url=" + encodeURIComponent(dest.href));
  } catch {
    return res.redirect("/");
  }
});

// Main relay endpoint
app.get("/go", async (req, res) => {
  const targetUrl = normalizeInput(req.query.url);
  if (!targetUrl) {
    return res.redirect("/");
  }

  try {
    const upstream = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const finalUrl = upstream.url || targetUrl;
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    if (contentType.includes("text/html")) {
      const html = await upstream.text();
      const rewritten = rewriteHtml(html, finalUrl);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(rewritten);
    }

    if (contentType.includes("text/css")) {
      const css = await upstream.text();
      const rewritten = rewriteCss(css, finalUrl);
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      return res.send(rewritten);
    }

    // Binary or other assets (images, scripts, fonts, JSON)
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    return res.send(buffer);
  } catch (err) {
    return res.status(502).send(`
      <html>
        <body style="font-family:system-ui;background:#0f172a;color:#f8fafc;padding:40px;">
          <h2>Could not load page</h2>
          <p style="color:#94a3b8;">${err.message}</p>
          <a href="/" style="color:#38bdf8;">Return Home</a>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
