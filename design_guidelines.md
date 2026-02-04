# Design Guidelines for AgentPro Real Estate SaaS

## Design Approach
**Reference-Based Approach**: Drawing inspiration from the provided dashboard image with modern SaaS platforms like Linear and Notion, creating a professional real estate technology interface that balances visual appeal with utility-focused functionality.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Deep Blue: 220 85% 25% (primary brand, navigation)
- Electric Blue: 215 100% 60% (CTAs, highlights)
- Purple Accent: 250 75% 65% (secondary actions, gradients)

**Supporting Colors:**
- Dark Background: 220 15% 8% (main background)
- Card Background: 220 12% 12% (elevated surfaces)
- Text Primary: 0 0% 95% (headings, important text)
- Text Secondary: 220 10% 70% (body text, labels)

### Typography
- **Primary Font**: Inter via Google Fonts
- **Headings**: Font weights 600-700, sizes from text-2xl to text-6xl
- **Body Text**: Font weight 400-500, sizes text-sm to text-lg
- **Monospace**: Fira Code for data displays and technical content

### Layout System
**Spacing Units**: Consistent use of Tailwind units 2, 4, 8, 12, 16
- Micro spacing: p-2, m-2
- Component spacing: p-4, gap-4
- Section spacing: p-8, py-12
- Major layout: p-16, py-24

### Component Library

**Navigation**:
- Dark sidebar with Electric Blue highlights
- Clean top navigation bar with gradient backdrop blur
- Breadcrumb navigation for deep sections

**Cards & Data Display**:
- Elevated cards with subtle shadows (bg-card-background)
- Property listing cards with image previews
- Dashboard widgets with real-time data
- Lead detection results in structured grids

**Forms & Inputs**:
- Dark-themed form inputs with Electric Blue focus states
- File upload areas for photo improvement module
- Filter panels with toggle switches and range sliders
- Contact forms with validation states

**Buttons & CTAs**:
- Primary: Electric Blue background with hover states
- Secondary: Purple Accent with outline variants
- Ghost buttons for secondary actions
- Gradient CTAs for landing page conversion points

**Overlays**:
- Modal dialogs for photo editing workflows
- Toast notifications for lead detection alerts
- Loading states during AI image processing

### Landing Page Specific Design

**Hero Section**:
- Large hero area (80vh) with gradient overlay (Deep Blue to Purple Accent)
- Integrated DisplayCards component with property showcase
- Split layout: compelling headline left, visual demonstration right
- Primary CTA with Electric Blue gradient button

**Color & Visual Treatment**:
- **Gradients**: Subtle blue-to-purple gradients (220 85% 25% to 250 75% 65%) for hero backgrounds and accent elements
- **Background treatments**: Dark gradient overlays, subtle geometric patterns in header
- **Contrast**: High contrast white text on dark backgrounds for readability
- **Accent usage**: Purple sparingly for highlighting key features and secondary CTAs

**Section Structure** (Maximum 4 sections):
1. **Hero**: Value proposition + DisplayCards integration
2. **Features**: Three-column layout showcasing opportunity detection, AI photo enhancement, dashboard management
3. **Social Proof**: Client testimonials or agency success metrics
4. **CTA/Contact**: Final conversion with form integration

### Images
**Hero Image**: Large property showcase integrated with DisplayCards component - modern residential properties with enhanced lighting
**Feature Images**: Screenshots of the dashboard interface, before/after photo comparisons, property search results
**Background Images**: Subtle real estate imagery with dark overlays for text readability

### Key Design Principles
- **Professional Authority**: Clean, sophisticated interface that builds trust with real estate professionals
- **Data Clarity**: Clear hierarchy for property information and lead data
- **Efficient Workflow**: Streamlined processes for photo uploads and opportunity management
- **Mobile Responsive**: Fully functional on tablets for field use by agents