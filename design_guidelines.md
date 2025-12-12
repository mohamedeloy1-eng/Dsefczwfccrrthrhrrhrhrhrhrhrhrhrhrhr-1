# Design Guidelines - GX-MODY WhatsApp AI Bot Dashboard

## Design Approach
**Hybrid Approach:** Custom Cyberpunk/Glassmorphism aesthetic built on Material Design principles for dashboard functionality. Drawing inspiration from Vercel's dark dashboard aesthetics combined with modern gaming UI patterns (Valorant, Cyberpunk 2077 interfaces).

## Core Design Principles
- Futuristic luxury through dark gradients and neon accents
- RTL-first Arabic interface with premium typography
- Glassmorphism for depth and sophistication
- Performance-optimized glow effects

## Typography System

**Arabic Primary Font:** 'IBM Plex Sans Arabic' (Google Fonts)
- Heading 1: 2.5rem, font-weight 700
- Heading 2: 2rem, font-weight 600
- Heading 3: 1.5rem, font-weight 600
- Body: 1rem, font-weight 400
- Small/Meta: 0.875rem, font-weight 400

**English Secondary:** 'Inter' for technical labels and codes

**RTL Specifications:**
- All layouts use `dir="rtl"` 
- Text alignment: right-aligned by default
- Icon positioning: reversed (icons on right for leading position)
- Padding/margin reversal applied consistently

## Layout System

**Spacing Scale:** Tailwind units 2, 4, 6, 8, 12, 16 (p-2, p-4, gap-6, etc.)

**Dashboard Structure:**
- Fixed sidebar: w-64 on desktop, collapsible on mobile
- Main content area: ml-64 (RTL: mr-64) with max-w-7xl container
- Top bar: h-16 fixed with glassmorphic effect
- Content padding: p-6 on desktop, p-4 on mobile

**Grid System:**
- Stats cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Main content: grid-cols-1 lg:grid-cols-3 (conversation list + chat view)
- Settings panels: Single column max-w-4xl

## Component Library

### Navigation
**Sidebar:** Dark gradient background (purple-900 to blue-900), glassmorphic overlay with backdrop-blur, glowing border-l with purple-to-blue gradient. Menu items with hover glow effect, active state with neon accent.

**Top Bar:** Glassmorphic header with search, notifications, user profile. All with subtle glow on hover.

### Dashboard Cards
**Stats Cards:** Glass effect (bg-opacity-10), glowing borders (gradient purple-blue), hover lift with intensified glow shadow. Include: Active Conversations, Messages Today, Response Time, AI Accuracy.

**Conversation Card:** Glass container with user avatar (glowing border), message preview, timestamp, status indicator (online/typing with pulsing glow).

### Data Displays
**Analytics Charts:** Dark-themed charts with neon line graphs (purple/blue gradients), glassmorphic container backgrounds.

**Message History:** Chat-style interface with sender/receiver bubbles, glassmorphic treatment, timestamps, AI confidence indicators with gradient fills.

### Forms & Inputs
**Input Fields:** Dark glass backgrounds with glowing focus borders (purple to blue gradient), floating labels in Arabic, RTL text alignment.

**Buttons:** 
- Primary: Gradient background (purple-to-blue), white text, glow shadow, hover intensifies glow
- Secondary: Glass with border glow, hover fills with subtle gradient
- Danger: Red gradient with matching glow

### Interactive Elements
**Toggles/Switches:** Neon-style with glowing track when active (purple glow).

**Tabs:** Underline style with gradient active indicator, glass background for tab container.

**Modals:** Full glassmorphic overlay, centered card with heavy blur, gradient borders, neon close button.

## Visual Effects

**Glassmorphism Recipe:**
- Background: bg-white/5 or bg-black/20
- Backdrop blur: backdrop-blur-xl
- Border: 1px gradient (purple-500 to blue-500)
- Subtle inner shadow

**Glow Effects:**
- Box shadows with colored blur: shadow-[0_0_20px_rgba(139,92,246,0.3)]
- Hover intensification: shadow-[0_0_30px_rgba(139,92,246,0.5)]
- Applied to: buttons, cards, icons, borders

**Animations:**
- Fade in on load: 300ms ease
- Hover transitions: 200ms ease-in-out
- Pulse effect for status indicators: 2s infinite
- Page transitions: slide with 300ms duration

## Color Strategy (Descriptive Only)
- Base: Deep dark backgrounds with subtle purple-blue gradients
- Accents: Vibrant purple and electric blue for interactive elements
- Text: High contrast whites and light grays
- Status: Green (success/online), Red (error/offline), Amber (warning)

## Images & Visual Assets

**No Hero Image Required** - This is a dashboard application.

**Icons:** Font Awesome (CDN) - use solid style for primary actions, regular for secondary. All icons receive subtle glow on hover.

**Avatars:** User profile images with circular glowing borders (gradient), fallback initials with gradient backgrounds.

**Empty States:** Minimalist illustrations with neon outlines for empty conversation lists, no data states.

## Page Layouts

**Dashboard Home:** 4-column stats grid, activity timeline (glass cards), quick actions panel, recent conversations list.

**Conversations View:** Split layout - conversation list (glass cards) on right, active chat on left, message composer at bottom with glassmorphic styling.

**Analytics:** Full-width charts with glass containers, metric cards, date range selector with neon accents.

**Settings:** Single column form layout, categorized sections with glass containers, toggle switches for features, API key management with copy button (glowing on hover).

**Bot Configuration:** AI model selector, prompt templates editor (dark code editor style), response settings with sliders (neon tracks).

This dashboard balances futuristic aesthetics with professional functionality, creating a premium Arabic-first admin experience.