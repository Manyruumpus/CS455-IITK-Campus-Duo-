# Campus Duo — Design System Specification

**Document Version**: 1.1.0-stage01-revised  
**Status**: Stage 01 Approved Token Foundations

---

## 1. Reference Inspection & Visual Provenance (`kibori`)

### 1.1 Source Distinction & Boundaries
To preserve integrity, visual details are strictly divided into three distinct categories:

1. **Observed ThreeUI Shell Tokens (from retrieved HTML/CSS)**:
   - Initial loader background: `#131416` (dark scheme) / `#fbfbfa` (light scheme).
   - Initial ink / text: `#edeef0` (dark scheme) / `#242424` (light scheme).
   - Initial muted text: `#8a8f98` (dark scheme) / `#5c5c5a` (light scheme).
   - Border tinting: `color-mix(in srgb, var(--initial-ink) 14%, transparent)`.
   - Focus outline style: `2px solid var(--initial-ink); outline-offset: 3px`.
   - Monospace font: `JetBrains Mono` (Google Fonts preconnect).
   - Theme switching: `data-theme="dark"` / `data-theme="light"`, with palette variants (`mono`, `sepia`, `azure`, `moss`, `mauve`).

2. **Observed Kibori Template Details (from metadata)**:
   - Lede & Title: *"Kibori: A cinematic Kyoto woodshop with eight interactive 3D crafts, glowing fire transitions, Japanese typography, a workshop index, and a commission finale."*
   - Runtime: Full HTML + DOM/CSS + Three.js scene and authored JavaScript.
   - **Crucial Limitation**: The embedded 3D canvas / WebGL interactive crafts scene was **not visually rendered or inspected** because the automated browser driver could not be provisioned in this environment (Playwright driver CDN download returned 404). No 3D shaders, geometry assets, or canvas pixels were inspected or copied.

3. **Proposed Campus Duo Tokens (Implementation Adaptation)**:
   - Adapted the Kyoto woodshop craft atmosphere into an **academic craft & study focus** aesthetic for IIT Kanpur.
   - Preserved warm embers, brass highlights, and deep charcoal slate, but removed mandatory 3D engine requirements for standard functional operations.

---

## 2. Dual Atmosphere Architecture

Campus Duo implements two synchronized visual treatments:

1. **Marketing & Landing Experience (`treatment-craft`)**:
   - **Atmosphere**: Academic craft & Kyoto woodshop aesthetic tailored to IIT Kanpur's scholarly heritage.
   - **Palette**: Deep charcoal base (`#121316`), warm terracotta/ember accents (`#d97736` / `#e06b3a`), antique brass/gold (`#d4af37`), and subtle craft grid textures.
   - **Atmospheric Elements**: Radial ember glows, tactile grain borders, Japanese-inspired typographic rhythm with `JetBrains Mono` for badges and metadata.

2. **Functional Productivity Experience (`treatment-functional`)**:
   - **Atmosphere**: High-clarity, high-density, distraction-free student portal.
   - **Palette**: Neutral slate dark or crisp daylight with stark, measured WCAG contrast.
   - **Data-Dense Elements**: Tabular numerals, razor-sharp grid borders, immediate status indicators (Green/Amber/Red for table availability), and prominent focus outlines.

---

## 3. Design Tokens & Measured Color Contrast

### 3.1 Color Tokens & Measured Contrast Ratios

| Surface / Text Pair | Hex Values | Measured Contrast Ratio | WCAG 2.1 Target | Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **Dark Primary Text** | `#edeef0` on `#121316` | **16.19 : 1** | $\ge 7.0 : 1$ (AAA) | **Passes AAA** |
| **Dark Muted Text** | `#8a8f98` on `#121316` | **5.75 : 1** | $\ge 4.5 : 1$ (AA) | **Passes AA** |
| **Ember Accent Text** | `#e06b3a` on `#121316` | **5.61 : 1** | $\ge 4.5 : 1$ (AA) / $\ge 3:1$ (UI) | **Passes AA** |
| **Ember Button (White)** | `#ffffff` on `#b85d26` (ember-600) | **4.88 : 1** | $\ge 4.5 : 1$ (AA) | **Passes AA** |
| **Light Primary Text** | `#202124` on `#fbfbfa` | **15.58 : 1** | $\ge 7.0 : 1$ (AAA) | **Passes AAA** |
| **Light Muted Text** | `#5c5c5a` on `#fbfbfa` | **6.02 : 1** | $\ge 4.5 : 1$ (AA) | **Passes AA** |

*Note: All contrast figures above are computed via standard relative luminance formula $L = 0.2126R + 0.7152G + 0.0722B$ under sRGB color space.*

---

## 4. Accessibility & Motion Standards

### 4.1 Focus Rings & Keyboard Navigation
- Every interactive element has an explicit `:focus-visible` state:
  ```css
  *:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 3px;
  }
  ```
- Focus rings are never suppressed without replacement. Logical tab-order is strictly preserved.

### 4.2 Strict OS-Compliant Reduced Motion
- **Core Principle**: The application motion toggle may reduce motion further, but **must never override an OS request for reduced motion** (`prefers-reduced-motion: reduce`).
- **Implementation**:
  - Global CSS unconditionally enforces reduced motion when requested by the OS:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, ::before, ::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    ```
  - In `App.tsx`, the component subscribes to `window.matchMedia('(prefers-reduced-motion: reduce)')`. When active, the application motion button reflects `OS Reduced Motion (Enforced)` and disables override.
