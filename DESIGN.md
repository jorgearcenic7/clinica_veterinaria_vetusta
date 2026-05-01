---
name: Serene Nature & Care
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#414844'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#3f6653'
  primary: '#012d1d'
  on-primary: '#ffffff'
  primary-container: '#1b4332'
  on-primary-container: '#86af99'
  inverse-primary: '#a5d0b9'
  secondary: '#5f5e5c'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfdc'
  on-secondary-container: '#636260'
  tertiary: '#735c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cba72f'
  on-tertiary-container: '#4e3d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1ecd4'
  primary-fixed-dim: '#a5d0b9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#274e3d'
  secondary-fixed: '#e5e2df'
  secondary-fixed-dim: '#c8c6c3'
  on-secondary-fixed: '#1c1c1a'
  on-secondary-fixed-variant: '#474745'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style

The design system is built upon a foundation of organic warmth and professional reliability. It targets pet owners in Oviedo who value a personalized, community-focused approach to veterinary medicine. The emotional response should be one of immediate relief and trust—evoking the feeling of a calm walk through a forest or a comfortable home.

The chosen style is **Modern Corporate with Tactile Warmth**. It avoids the clinical coldness often found in healthcare by utilizing soft, layered surfaces and generous whitespace. The interface prioritizes accessibility and clarity, ensuring that information regarding pet health is easily digestible and comforting during stressful moments.

## Colors

The palette is anchored by a deep Forest Green, signifying vitality and the natural world. This is balanced by a Secondary Cream and Soft White base that prevents the interface from feeling heavy. 

- **Primary (Forest Green):** Used for navigation, primary actions, and brand identification.
- **Secondary (Cream/Soft White):** The primary background color to provide a warmer, more inviting alternative to pure white.
- **Accents (Gold/Sand):** Used sparingly for quality indicators, certifications, and subtle highlights.
- **Text (Dark Charcoal):** Ensures AAA accessibility ratings for all body copy and critical information.

## Typography

The typography strategy focuses on maximum readability and a friendly tone. 

**Plus Jakarta Sans** is used for headings. Its soft, rounded terminals feel approachable yet professional, perfectly capturing the "small and friendly" clinic vibe.

**Lexend** is utilized for body text and labels. Specifically designed to reduce visual stress and improve reading proficiency, it reinforces the clinic's commitment to accessibility and clear communication of medical information.

## Layout & Spacing

The design system employs a **Fixed Grid** model for desktop to maintain a boutique, curated feel, transitioning to a fluid model for mobile devices. 

A 12-column grid is used for the main website, with generous 24px gutters to allow the content to breathe. Vertical rhythm is strictly maintained using 8px increments. Wide margins are preferred to center the user's focus on essential pet-care information and photography, avoiding cluttered sidebars.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**. Instead of harsh black shadows, this design system uses soft, diffused shadows tinted with the primary Forest Green (at very low opacity) to create a sense of organic depth.

- **Level 0 (Base):** Cream background (`#FEFBF6`).
- **Level 1 (Cards):** Soft White (`#FFFFFF`) with a 1px border of `#E6D5B8`.
- **Level 2 (Active/Hover):** Shallow, wide-spread shadow (Blur: 20px, Y: 10px, Opacity: 4% Green).

This "soft-lift" approach ensures that even complex forms or appointment schedulers feel lightweight and non-intimidating.

## Shapes

The shape language is consistently **Rounded**. Sharp corners are avoided to mirror the friendliness and safety associated with pet care. 

Standard components use a 0.5rem (8px) radius. Larger containers, such as testimonial cards or hero image masks, use the `rounded-xl` (1.5rem / 24px) setting. This creates a "squircle" aesthetic that feels modern and gentle.

## Components

The components within this design system are designed to be tactile and easy to interact with, even on mobile devices.

- **Buttons:** Primary buttons are solid Forest Green with white text and a 0.5rem radius. Secondary buttons use a Golden/Sand outline. Transitions should be smooth (200ms ease-in-out).
- **Cards:** White backgrounds with a subtle Sand-colored border. Photos within cards should always have the top corners rounded to match the card container.
- **Input Fields:** Large tap targets with a 16px internal padding. Focus states use a 2px Forest Green ring.
- **Chips/Badges:** Used for pet categories (e.g., "Canine", "Feline") with low-saturation versions of the primary green and gold.
- **Lists:** Icon-led lists using friendly, simplified animal glyphs or medical icons in the accent gold.
- **Specialty Component - "Quick Action Dial":** A floating action button for "Emergency Contact" or "Book Appointment" that stays accessible at the bottom right of mobile views.