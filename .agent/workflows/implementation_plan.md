---
description: Implementation plan for the PDF Stamp & Signature Extractor App
---

# Project: PDF Stamp & Signature Extractor

## 1. Setup & Dependencies
- [x] Initialize Vite React App
- [ ] Install dependencies:
    - `pdfjs-dist`: PDF parsing
    - `@imgly/background-removal`: Intelligent background removal
    - `framer-motion`: Animations
    - `lucide-react`: Icons
    - `react-dropzone`: File upload
    - `jszip`, `file-saver`: Downloading
    - `clsx`, `tailwind-merge` (optional, but standard for classes without tailwind? strict css requested so maybe just standard CSS modules or global css) -> Instructions say "Vanilla CSS... Avoid TailwindCSS". I will stick to vanilla CSS.

## 2. Design System (Vanilla CSS)
- Define CSS variables for colors (Dark/Light mode support, but default to a premium dark/glass theme).
- Create `index.css` with reset and typography (Inter/Outfit).
- Glassmorphism utility classes.

## 3. Core Logic (The "Expert" part)
- **PDF Loading**: Use pdf.js to render pages.
- **Extraction Strategy**:
    1.  **Embedded Images**: Scan PDF objects for XObject Images. (Best for digital stamps).
    2.  **Visual Extraction**:
        - Render page to hidden canvas.
        - Analyze pixel data to find "islands" of non-white pixels (Flood fill or connected components labeling).
        - Crop these islands. This handles scanned documents where the stamp is just ink on the page.
- **Processing**:
    - Pass candidates to `@imgly/background-removal` to clean them up.
    - Filter by resolution/quality.

## 4. UI Components
- **Home**: Hero section, upload area.
- **Dashboard**:
    - Sidebar/Top bar: Stats.
    - Main Grid: Extracted assets.
    - Asset Card: Before/After toggle, Download button.
- **Preview Modal**: high-res view.

## 5. Build & Polish
- Add micro-interactions.
- Verify SEO tags (Title, Meta).
