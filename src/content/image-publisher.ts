import { writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ContentRecord } from "./content-history.js";

const INSPIRE_DIR = resolve(process.cwd(), "docs", "inspire");
const IMAGES_DIR = resolve(INSPIRE_DIR, "images");

export function saveImageToSite(imageData: Buffer, filename: string): string {
  mkdirSync(IMAGES_DIR, { recursive: true });
  const filePath = resolve(IMAGES_DIR, filename);
  writeFileSync(filePath, imageData);
  return filePath;
}

export function getPublicImageUrl(
  siteBaseUrl: string,
  filename: string
): string {
  return `${siteBaseUrl}/inspire/images/${filename}`;
}

export function updateGalleryPage(records: ContentRecord[]): void {
  // Also scan the images directory for any images not in records
  const existingImages: string[] = [];
  if (existsSync(IMAGES_DIR)) {
    const files = readdirSync(IMAGES_DIR).filter((f) =>
      f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg")
    );
    existingImages.push(...files);
  }

  // Sort records newest first
  const sorted = [...records]
    .filter((r) => r.imageFilename)
    .sort(
      (a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

  // Find images on disk not covered by any record
  const recordedFiles = new Set(sorted.map((r) => r.imageFilename));
  const untracked = existingImages
    .filter((f) => !recordedFiles.has(f))
    .map((f) => ({
      imageFilename: f,
      caption: "",
      generatedAt: new Date().toISOString(),
    }));

  const allItems = [
    ...sorted.map((r) => ({
      imageFilename: r.imageFilename,
      caption: r.caption,
      generatedAt: r.generatedAt,
    })),
    ...untracked,
  ];

  const imageCards = allItems
    .map((item) => {
      const date = new Date(item.generatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const caption = item.caption ? escapeHtml(item.caption.split("\n")[0]) : "";
      const imgAlt = caption || item.imageFilename;
      const captionHtml = caption
        ? `
                <div class="gallery-caption">
                    <p class="caption-text">${caption}</p>
                    <span class="caption-date">${date}</span>
                </div>`
        : `
                <div class="gallery-caption">
                    <span class="caption-date">${date}</span>
                </div>`;
      return `            <div class="gallery-item">
                <img src="images/${item.imageFilename}" alt="${imgAlt}" loading="lazy">${captionHtml}
            </div>`;
    })
    .join("\n");

  const html = generateGalleryHtml(imageCards, allItems.length);
  writeFileSync(resolve(INSPIRE_DIR, "index.html"), html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateGalleryHtml(imageCards: string, count: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspire — Premium Comfort</title>
    <meta name="description" content="Get inspired by our curated collection of home comfort imagery. Premium Comfort — elevating everyday living.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#127968;</text></svg>">
    <style>
        :root {
            --charcoal: #1E1E1E;
            --charcoal-deep: #141414;
            --charcoal-soft: #2D2D2D;
            --charcoal-mist: #3A3A3A;
            --brass: #B8964E;
            --brass-deep: #9A7B3C;
            --brass-light: #D4B978;
            --ivory: #F5F0E8;
            --ivory-deep: #E8E0D4;
            --ivory-light: #FAF7F2;
            --warm-white: #FEFCF8;
            --taupe: #9C8E82;
            --taupe-deep: #7A6E64;
            --border: rgba(30, 30, 30, 0.08);
            --font-display: 'Cormorant Garamond', Georgia, serif;
            --font-body: 'Jost', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        body {
            font-family: var(--font-body);
            color: var(--charcoal);
            background: var(--warm-white);
            line-height: 1.6;
        }

        .nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
            padding: 1.5rem 3rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(254, 252, 248, 0.95);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
        }

        .nav-logo {
            font-family: var(--font-display);
            font-size: 1.4rem;
            font-weight: 500;
            color: var(--charcoal);
            text-decoration: none;
            letter-spacing: 0.02em;
        }

        .nav-links { display: flex; gap: 2rem; align-items: center; }
        .nav-links a {
            font-family: var(--font-body);
            font-size: 0.85rem;
            font-weight: 400;
            color: var(--taupe);
            text-decoration: none;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            transition: color 0.3s ease;
        }
        .nav-links a:hover { color: var(--brass); }
        .nav-links a.active { color: var(--brass); font-weight: 500; }

        .hero {
            padding: 8rem 3rem 4rem;
            text-align: center;
            max-width: 800px;
            margin: 0 auto;
        }

        .hero h1 {
            font-family: var(--font-display);
            font-size: 3.5rem;
            font-weight: 300;
            color: var(--charcoal);
            margin-bottom: 1rem;
            letter-spacing: -0.01em;
        }

        .hero p {
            font-size: 1.1rem;
            color: var(--taupe);
            font-weight: 300;
            max-width: 500px;
            margin: 0 auto;
        }

        .gallery-count {
            text-align: center;
            padding: 1rem 3rem 2rem;
            font-size: 0.8rem;
            color: var(--taupe);
            text-transform: uppercase;
            letter-spacing: 0.15em;
        }

        .gallery {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 2rem 4rem;
            columns: 3;
            column-gap: 1.5rem;
        }

        .gallery-item {
            break-inside: avoid;
            margin-bottom: 1.5rem;
            border-radius: 12px;
            overflow: hidden;
            background: var(--warm-white);
            box-shadow: 0 2px 20px rgba(45, 40, 48, 0.06);
            transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.4s ease;
        }

        .gallery-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 40px rgba(45, 40, 48, 0.12);
        }

        .gallery-item img {
            width: 100%;
            display: block;
        }

        .gallery-caption {
            padding: 1.2rem 1.5rem;
        }

        .caption-text {
            font-size: 0.95rem;
            color: var(--charcoal);
            line-height: 1.5;
            margin-bottom: 0.5rem;
        }

        .caption-date {
            font-size: 0.75rem;
            color: var(--taupe);
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }

        .empty-state {
            text-align: center;
            padding: 6rem 2rem;
            color: var(--taupe);
        }

        .empty-state p {
            font-family: var(--font-display);
            font-size: 1.5rem;
            font-style: italic;
        }

        .footer {
            text-align: center;
            padding: 3rem;
            border-top: 1px solid var(--border);
            font-size: 0.8rem;
            color: var(--taupe);
        }

        .footer a { color: var(--brass); text-decoration: none; }

        @media (max-width: 1024px) { .gallery { columns: 2; } }
        @media (max-width: 640px) {
            .gallery { columns: 1; padding: 0 1rem 3rem; }
            .hero { padding: 7rem 1.5rem 3rem; }
            .hero h1 { font-size: 2.5rem; }
            .nav { padding: 1rem 1.5rem; }
        }
    </style>
</head>
<body>
    <nav class="nav">
        <a href="/" class="nav-logo">Premium Comfort</a>
        <div class="nav-links">
            <a href="/">Home</a>
            <a href="/inspire" class="active">Inspire</a>
        </div>
    </nav>

    <section class="hero">
        <h1>Inspire</h1>
        <p>A curated gallery of home comfort moments. Each image crafted to inspire your living space.</p>
    </section>

    <div class="gallery-count">${count} image${count !== 1 ? "s" : ""}</div>

    <div class="gallery">
${imageCards || '        <div class="empty-state"><p>New inspirations coming soon...</p></div>'}
    </div>

    <footer class="footer">
        <p>&copy; ${new Date().getFullYear()} <a href="/">Premium Comfort</a>.</p>
    </footer>
</body>
</html>`;
}
