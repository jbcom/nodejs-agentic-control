# jbcom Design System

> **This is the definitive branding guide for ALL jbcom repositories.** All documentation sites MUST follow these specifications to ensure brand consistency across the ecosystem.

## Brand Identity

**jbcom** is a collection of production-grade open source tools for builders. The visual identity communicates:

- **Professionalism** - Enterprise-ready, not experimental
- **Technical depth** - For developers who care about quality
- **Clarity** - Clean, focused, no distractions

---

## Logo & Brand Mark

### Primary Logo

```
┌──────────┐
│   jb     │  ← Gradient background: linear-gradient(135deg, #06b6d4, #3b82f6)
└──────────┘    Text: white (#ffffff), Space Grotesk 700
                Size: 36x36px (standard), 32x32px (mobile)
                Border radius: 8px
```

### Wordmark

- **Text**: "jbcom"
- **Font**: Space Grotesk, weight 700
- **Usage**: Paired with logo mark, never standalone

---

## Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-default` | `#0a0f1a` | Page background (dark mode) |
| `--bg-paper` | `#111827` | Cards, elevated surfaces |
| `--bg-elevated` | `#1e293b` | Hover states, highlighted areas |
| `--primary` | `#06b6d4` | Primary actions, links, accents |
| `--primary-light` | `#22d3ee` | Hover states |
| `--primary-dark` | `#0891b2` | Active/pressed states |
| `--secondary` | `#3b82f6` | Secondary actions |
| `--secondary-light` | `#60a5fa` | Hover states |
| `--secondary-dark` | `#2563eb` | Active states |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#f1f5f9` | Headings, primary text |
| `--text-secondary` | `#94a3b8` | Body text, descriptions |
| `--text-disabled` | `#475569` | Disabled elements |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#10b981` | Success states |
| `--warning` | `#f59e0b` | Warnings |
| `--error` | `#ef4444` | Errors |
| `--info` | `#06b6d4` | Informational |

### Language Colors

| Language | Token | Hex |
|----------|-------|-----|
| TypeScript | `--lang-typescript` | `#3178c6` |
| Python | `--lang-python` | `#3776ab` |
| Go | `--lang-go` | `#00add8` |
| Terraform | `--lang-terraform` | `#7b42bc` |
| Rust | `--lang-rust` | `#dea584` |

### Category Colors

| Category | Token | Hex | Meaning |
|----------|-------|-----|---------|
| AI & Agents | `--cat-ai` | `#8b5cf6` | Purple - intelligence |
| Games | `--cat-games` | `#06b6d4` | Cyan - creativity |
| Infrastructure | `--cat-infra` | `#10b981` | Green - stability |
| Libraries | `--cat-libs` | `#f59e0b` | Amber - utility |

---

## Typography

### Font Stack

```css
:root {
  --font-heading: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

### Font Loading

Include these fonts in all documentation pages:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

### Type Scale

| Element | Font Family | Size | Weight | Line Height |
|---------|-------------|------|--------|-------------|
| H1 | Space Grotesk | 2.5rem (40px) | 700 | 1.2 |
| H2 | Space Grotesk | 2rem (32px) | 700 | 1.2 |
| H3 | Space Grotesk | 1.5rem (24px) | 600 | 1.3 |
| H4 | Space Grotesk | 1.25rem (20px) | 600 | 1.3 |
| H5 | Space Grotesk | 1.125rem (18px) | 600 | 1.4 |
| H6 | Space Grotesk | 1rem (16px) | 600 | 1.4 |
| Body | Inter | 1rem (16px) | 400 | 1.6 |
| Code | JetBrains Mono | 0.875rem (14px) | 400 | 1.5 |

---

## Spacing

8px base grid system:

| Token | Size | Usage |
|-------|------|-------|
| `--space-xs` | 4px | Tight spacing, icon gaps |
| `--space-sm` | 8px | Small gaps, compact lists |
| `--space-md` | 16px | Default spacing |
| `--space-lg` | 24px | Section spacing |
| `--space-xl` | 32px | Large sections |
| `--space-2xl` | 48px | Page sections |
| `--space-3xl` | 64px | Hero spacing |

---

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `--radius-sm` | 4px | Small elements, chips |
| `--radius-md` | 8px | Buttons, inputs, logo |
| `--radius-lg` | 12px | Cards |
| `--radius-full` | 9999px | Pills, avatars |

---

## Responsive Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| xs | 0-599px | Single column, mobile nav |
| sm | 600-899px | Single column, mobile nav |
| md | 900-1199px | Sidebar (240px) + content |
| lg | 1200-1535px | Sidebar + wide content |
| xl | 1536px+ | Sidebar + max-width content (1200px) |

---

## Documentation Site Requirements

Each language ecosystem uses its best-fit documentation tooling with jbcom branding applied.

### Sphinx (Python)

**Scaffold location**: `repository-files/python/docs/`

| File | Purpose |
|------|---------|
| `conf.py` | Sphinx configuration |
| `_static/jbcom-sphinx.css` | jbcom-branded theme CSS |
| `index.rst` | Documentation root |

Usage:
1. Copy scaffold to your `docs/` directory
2. Run `sphinx-build -b html docs docs/_build`

### TypeDoc (TypeScript/Node.js)

**Scaffold location**: `repository-files/nodejs/docs/`

| File | Purpose |
|------|---------|
| `typedoc.json` | TypeDoc configuration |
| `jbcom-typedoc.css` | jbcom-branded theme CSS |

Usage:
1. Copy scaffold to your `docs/` directory
2. Run `npx typedoc`

### doc2go (Go)

**Scaffold location**: `repository-files/go/docs/`

| File | Purpose |
|------|---------|
| `README.md` | Documentation guide |
| `jbcom-doc2go.css` | jbcom-branded theme CSS |

Usage:
1. Install: `go install go.abhg.dev/doc2go@latest`
2. Generate: `doc2go -out docs/api ./...`
3. Apply branding: Copy `jbcom-doc2go.css` and inject into HTML

Note: godoc is deprecated. Use [doc2go](https://go.abhg.dev/doc2go/) for modern, 
module-aware static documentation with pkg.go.dev-like styling.

### terraform-docs (Terraform)

**Scaffold location**: `repository-files/terraform/docs/`

| File | Purpose |
|------|---------|
| `README.md` | Documentation guide |
| `.terraform-docs.yml` | terraform-docs config |

Usage:
1. Add `.terraform-docs.yml` to module root
2. Run `terraform-docs markdown table .`

### rustdoc (Rust)

**Scaffold location**: `repository-files/rust/docs/`

| File | Purpose |
|------|---------|
| `README.md` | Documentation conventions guide |
| `jbcom-rustdoc.css` | jbcom-branded rustdoc CSS |

Usage:
1. Write doc comments in source code (`///` and `//!`)
2. Generate with custom CSS:
```bash
RUSTDOCFLAGS="--extend-css docs/jbcom-rustdoc.css" cargo doc --no-deps
```

### General Requirements

All documentation sites MUST:

- [ ] Use jbcom color palette (dark theme preferred)
- [ ] Use Space Grotesk for headings
- [ ] Use Inter for body text
- [ ] Use JetBrains Mono for code
- [ ] Have consistent sidebar navigation
- [ ] Display jbcom logo in header/footer
- [ ] Meet WCAG AA accessibility standards
- [ ] Support reduced motion preferences

---

## Accessibility

### Contrast Ratios

All text/background combinations meet WCAG AA (4.5:1):

| Foreground | Background | Ratio |
|------------|------------|-------|
| `#f1f5f9` | `#0a0f1a` | 15.2:1 ✓ |
| `#94a3b8` | `#0a0f1a` | 7.1:1 ✓ |
| `#06b6d4` | `#0a0f1a` | 8.4:1 ✓ |
| `#f1f5f9` | `#111827` | 13.8:1 ✓ |

### Focus States

```css
*:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Minimum Sizes

- Touch targets: 44x44px minimum
- Body text: 14px minimum (16px preferred)
- Line height: 1.5 minimum for body text

---

## Code Block Styling

### Syntax Highlighting

Use consistent syntax highlighting across all repos:

```css
/* Code blocks */
pre, code {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

pre {
  background: var(--bg-paper);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  overflow-x: auto;
}

code {
  background: var(--bg-paper);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
```

---

## Component Patterns

### Admonitions/Callouts

Use consistent styling for notes, warnings, etc.:

| Type | Color | Usage |
|------|-------|-------|
| Note | `--info` (cyan) | General information |
| Tip | `--success` (green) | Helpful tips |
| Warning | `--warning` (amber) | Caution needed |
| Danger | `--error` (red) | Critical warnings |

### Tables

- Use `--bg-paper` for table background
- Use `--border` for cell borders
- Ensure proper padding for readability

### Navigation

- Sidebar width: 240px on desktop
- Use `--bg-paper` for sidebar background
- Active item: `--primary` color with subtle background

---

## CSS Variables Reference

Complete set of CSS variables for documentation sites:

```css
:root {
  /* Backgrounds */
  --bg-default: #0a0f1a;
  --bg-paper: #111827;
  --bg-elevated: #1e293b;
  
  /* Primary - Cyan */
  --primary: #06b6d4;
  --primary-light: #22d3ee;
  --primary-dark: #0891b2;
  
  /* Secondary - Blue */
  --secondary: #3b82f6;
  --secondary-light: #60a5fa;
  --secondary-dark: #2563eb;
  
  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-disabled: #475569;
  
  /* Borders */
  --border: #1e293b;
  --divider: #1e293b;
  
  /* Semantic */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #06b6d4;
  
  /* Typography */
  --font-heading: 'Space Grotesk', -apple-system, sans-serif;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Language Colors */
  --lang-typescript: #3178c6;
  --lang-python: #3776ab;
  --lang-go: #00add8;
  --lang-terraform: #7b42bc;
  --lang-rust: #dea584;
  
  /* Category Colors */
  --cat-ai: #8b5cf6;
  --cat-games: #06b6d4;
  --cat-infra: #10b981;
  --cat-libs: #f59e0b;
}
```

---

## Implementation Checklist

When setting up documentation for any jbcom repository:

- [ ] All CSS custom properties defined
- [ ] Fonts loading correctly (Space Grotesk, Inter, JetBrains Mono)
- [ ] Background uses jbcom dark palette
- [ ] Primary accent is cyan `#06b6d4`
- [ ] Code blocks use `--bg-paper` background
- [ ] Typography scale matches specification
- [ ] Sidebar navigation styled consistently
- [ ] Focus states visible for accessibility
- [ ] Contrast ratios meet WCAG AA
- [ ] Reduced motion respected
- [ ] Logo displayed in header/footer
