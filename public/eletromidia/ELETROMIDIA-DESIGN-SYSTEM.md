# Eletromidia Institutional Design System

**Brand:** Eletromidia  
**Version:** 1.1.0 (Cream deprecated)  
**Status:** Stable

This document outlines the complete design system for the Eletromidia brand. It serves as the single source of truth for all visual and communication standards, ensuring consistency, clarity, and impact across all media.

---

## 1. Brand Essence

The brand communicates with high contrast, vibrant colors, and assertive typography, combining human photography with geometric graphics and flat illustrations to convey an urban presence and accessible technology.

### Personality

- **Urban**: Connected to the city rhythm.
- **Bold**: Confident and high-impact.
- **Optimistic**: Bright and energetic.
- **Human**: Accessible and person-centric.
- **Tech-Forward**: Driven by innovation.

### Voice & Tone

- **Headlines**: Direct, confident, energetic.
- **Body Copy**: Clear, informative, conversational.
- **Microcopy**: Short, action-oriented.

---

## 2. Design Tokens

### 2.1. Color Palette

Our palette is high-energy, led by a signature orange and contrasted by deep black and crisp neutrals. Accents create modular, billboard-like compositions.

#### Primary Colors

| Token           | Hex       | Role                                           |
| :-------------- | :-------- | :--------------------------------------------- |
| `color-primary` | `#FF4F00` | Brand Orange - Primary field, CTA backgrounds. |
| `color-black`   | `#000000` | Typography, silhouettes, graphic shapes.       |
| `color-white`   | `#FFFFFF` | Type on dark backgrounds, negative space.      |

#### Accent Colors

| Token                 | Hex       | Role                                        | Contrast Text |
| :-------------------- | :-------- | :------------------------------------------ | :------------ |
| `color-accent-purple` | `#4E18FF` | Headline fields, tags, backgrounds.         | White         |
| `color-accent-yellow` | `#FECC14` | Highlights, rays, positive UI alerts.       | Black         |
| `color-accent-pink`   | `#F577ED` | Secondary highlights, illustration accents. | Black         |
| `color-accent-green`  | `#3D7700` | Confirmation, success state blocks.         | White         |

> **Note:** The "Cream" color (`#F9F2E7`) has been deprecated and should no longer be used.

### 2.2. Typography

The official brand typeface is **Rethink Sans**.

- **Primary Typeface**: Rethink Sans
- **Weights**: 300, 400, 500, 600, 700, 800
- **Styles**: Normal, Italic
- **Fallbacks**: `system-ui`, `Arial`, `Helvetica`, `sans-serif`

#### Typographic Scale

| Role           | Size | Line Height | Weight | Letter Spacing |
| :------------- | :--- | :---------- | :----- | :------------- |
| **Display**    | 64px | 68px        | 700    | -0.5px         |
| **H1**         | 48px | 52px        | 700    | -0.25px        |
| **H2**         | 36px | 40px        | 600    | 0              |
| **H3**         | 28px | 32px        | 600    | 0              |
| **Body Large** | 20px | 28px        | 400    | 0              |
| **Body**       | 16px | 24px        | 400    | 0              |
| **Caption**    | 14px | 20px        | 400    | 0              |
| **Micro**      | 12px | 16px        | 500    | 0              |

### 2.3. Spacing Scale

Based on a **4px base unit**.

- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-6`: 24px
- `space-8`: 32px
- `space-10`: 40px
- `space-14`: 56px
- `space-18`: 72px
- `space-24`: 96px

### 2.4. Border Radius

- `radius-sm`: 4px (Icons)
- `radius-md`: 12px (Buttons)
- `radius-lg`: 20px (Cards)

---

## 3. Logo Usage

### Core Assets

- **Monogram**: White monogram on an orange square (`color-primary`).
- **Wordmark**: `eletromidia` in black (`color-black`), for use on light backgrounds.

### Usage Rules

- **Clear Space**: Minimum space equal to the height of the monogram's horizontal bar.
- **Backgrounds**:
  - **Preferred**: Brand Orange for the monogram; White for the wordmark.
  - **Avoid**: Busy photos or low-contrast pairings.
- **Prohibitions**: No drop shadows, rotations, or distortions.

---

## 4. Visual Language

### Shapes & Patterns

- **Arches**: Semi-capsule pillars rising from the baseline.
- **Blob Ceiling**: Black rounded shapes aligned to the top edge to frame content.
- **Beams**: Yellow rays fanning out from focal objects.

### Illustration Style

- **Style**: Flat, geometric, expressive.
- **Colors**: Uses the brand palette. Skin tones use `#FECC14` (Yellow).
- **Proportions**: Exaggerated features, expressive hands.

### Photography

- **Focus**: Candid, high-energy portraits.
- **Casting**: Diverse and genuine.
- **Avoid**: Corporate stock clichés and low-saturation filters.

---

## 5. UI Components

### Buttons

| Type          | Background            | Text Color    | Radius |
| :------------ | :-------------------- | :------------ | :----- |
| **Primary**   | `color-primary`       | `color-black` | 12px   |
| **Secondary** | `color-accent-purple` | `color-white` | 12px   |

### Cards

- **Background**: `color-white`
- **Radius**: 20px
- **Effect**: Subtle box shadow for depth.

---

## 6. Accessibility

- **WCAG Target**: AA (aiming for AAA).
- **Body Text Contrast**: Minimum 4.5:1.
- **Focus State**: 2px solid `#4E18FF` (Purple) with 2px offset.
- **Alt Text**: Required for all meaningful imagery.

---

## 7. Layout Systems

- **Desktop Web**: 12 columns, 24px gutter, 80px side margins.
- **Print (A4)**: 12 columns, 12pt gutter, 15mm margins.

---

## 8. Governance

For approvals and questions: `institucional@eletromidia.com.br`
