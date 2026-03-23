// SYNC TEST: 12345
/** HELPERS: Slugs, Tags, and HTML Cleaning */
function consolidateTags(name) {
  if (!name) return "General";
  let trimmed = name.trim().toLowerCase();
  
  if (trimmed.includes("faq")) return "FAQ";
  if (trimmed.includes("setup")) return "Setup and use";
  if (trimmed.includes("resources")) return "Resources TEST";
  if (trimmed.includes("video")) return "Videos";

  return name.trim();
}

function generateUniqueSlug(platform, category, section, title, usedSlugs) {
  let rawString = `${platform} ${category} ${section} ${title}`;
  let baseSlug = rawString.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
    .replace(/^-+/, '').replace(/-+$/, '');            

  let finalSlug = baseSlug;
  let counter = 1;
  while (usedSlugs[finalSlug]) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  usedSlugs[finalSlug] = true;
  return finalSlug;
}

function perfectedHtmlCleanup(html, originalUrl, updatedAt) {
  if (!html) return { cleaned: "", issues: "" };
  let issues = [];
  let body = html;

  if (body.includes("data:image")) {
    issues.push("Base64 Image Removed");
    body = body.replace(/src="data:image\/[^;]+;base64,[^"]+"/gmi, 'src="image-removed"');
  }

  body = body.replace(/<span\b(?:[^>"']|"[^"]*"|'[^']*')*>|<\/span\s*>/gi, "");
  body = body.replace(/\s*(?:class|id|style|data-list-item-[^=]*)\s*=\s*(["'])(?:(?!\1).)*\1/gi, "");
  body = body.replace(/<p[^>]*>(?:\s|&nbsp;|&#160;)*<\/p>/gi, "");

  const formattedDate = Utilities.formatDate(new Date(updatedAt), "GMT", "MMMM dd, yyyy");
  const sourceHeader = `
    <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin-bottom: 20px; font-family: sans-serif;">
      <p style="margin: 0; font-size: 14px; color: #6c757d;">
        <strong>PocketSuite Archive:</strong> This content was migrated from the 
        <a href="${originalUrl}" target="_blank" style="color: #ff7a59; text-decoration: underline; font-weight: bold;">Suite Center</a>. 
        Last verified on ${formattedDate}.
      </p>
    </div>
    <hr style="border: 0; border-top: 1px solid #eeeeee; margin-bottom: 20px;">
  `;
  
  body = sourceHeader + body;

  if (body.length > LIMITS.BODY) {
    issues.push("Content Truncated (Over 49k)");
    body = body.substring(0, LIMITS.BODY) + "\n\n... [TRUNCATED]";
  }
  
  return { cleaned: body.trim(), issues: [...new Set(issues)].join(" | ") };
}

/** CORE: AI ENGINE */

function callGeminiAI(html, key) {
  if (!html || html.length < 50) return {summary: "Short content.", keywords: ""};
  const cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s\s+/g, ' ').trim();
  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${key}`;
  const prompt = `Summarize in plain text, 500 chars max, and extract 5 relevant keywords. Format: SUMMARY: [text] KEYWORDS: [keyword1, keyword2...]`;
  const payload = { "contents": [{ "parts": [{ "text": prompt + "\n\nTEXT: " + cleanText }] }] };
  const response = UrlFetchApp.fetch(apiUrl, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
  if (response.getResponseCode() === 200) {
    const raw = JSON.parse(response.getContentText()).candidates[0].content.parts[0].text.trim();
    const summary = raw.split("KEYWORDS:")[0].replace("SUMMARY:", "").trim();
    const keywords = (raw.split("KEYWORDS:")[1] || "").trim();
    return { summary: summary, keywords: keywords };
  }
  return { summary: "Summary failed.", keywords: "" };
}