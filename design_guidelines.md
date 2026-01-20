# Coster - Jordan Public Transport App Design Guidelines

## Design Approach
**Design System: Material Design 3** - Selected for government utility applications requiring clarity, accessibility, and proven patterns for map-based interfaces and real-time data display.

**Key Principles:**
- Functional clarity over visual flair
- Information hierarchy prioritizing real-time transport data
- Trust through professional, government-appropriate aesthetics
- Arabic-first design with RTL layout support

## Typography System
**Primary Font:** Cairo (Arabic-optimized) or Noto Sans Arabic
- **Headings:** Bold 600-700 weight
- **Body Text:** Regular 400 weight, 16px base size
- **Data/Numbers:** Medium 500 weight for stats and seat counts
- **Minimum Size:** 14px for accessibility

**Hierarchy:**
- H1: 32px (App sections)
- H2: 24px (Card headers)
- H3: 20px (Subheadings)
- Body: 16px (Primary content)
- Caption: 14px (Timestamps, metadata)

## Layout System
**Spacing Units:** Tailwind units of 1, 2, 4, 6, 8, 12, 16
- Tight spacing (p-1, p-2) for data-dense components
- Standard spacing (p-4, m-6) for cards and containers
- Generous spacing (p-8, py-12) for main sections

**Grid Structure:**
- Mobile-first single column
- Tablet: max-w-4xl centered
- Desktop: max-w-6xl with optional sidebar for filters

## Core Components

### Navigation
- **Bottom Tab Bar (Mobile):** 4 tabs - Map View, My Reservations, Profile, Report Issue
- **Top App Bar:** Logo, location indicator, notification bell
- **Driver Mode Toggle:** Prominent switch for bus operators

### Map Interface (Primary Screen)
- **Full-screen map:** Occupies 70% of viewport height
- **Bus Markers:** Custom icons showing available seats badge
- **Route Lines:** Colored paths based on bus routes
- **User Location:** Pulsing dot indicator
- **Floating Action Button:** Quick reservation button (bottom-right)

### Bus Information Cards
- **Compact Card:** Bus number, route name, seats available (3/15), ETA
- **Expanded Card:** Full route details, driver info, reservation button
- **Status Indicators:** Green (Available), Yellow (Almost Full), Hidden (Full)
- **Live Updates:** Animated counter for seat availability

### Registration/Login Screens
- **Dual Mode Selection:** Large cards for "Citizen" vs "Bus Driver" registration
- **Form Layout:** Single column, clear labels, validation states
- **Identity Verification:** Fields for government ID integration
- **Role-Based Fields:** Additional route/vehicle info for drivers

### Reservation Flow
- **Step Indicators:** Progress bar (Select Bus → Confirm Location → Reserve)
- **Location Confirmation:** Mini-map showing user position relative to route
- **Priority Badge:** Visual indicator for reserved passengers
- **Confirmation Screen:** QR code or booking reference

### Driver Dashboard
- **Route Management:** Set/edit route with drag-and-drop waypoints
- **Capacity Control:** Stepper component to adjust available seats (0-50)
- **Passenger List:** Scrollable list with reservation priorities highlighted
- **Toggle Visibility:** Large switch to show/hide bus on map when full

### Issue Reporting
- **Category Selection:** Chips for Technical Bug, Route Issue, App Feedback
- **Description Field:** Multi-line textarea with 500 character limit
- **Screenshot Attachment:** Optional image upload
- **Submit Confirmation:** Success toast with ticket number

## Data Display Patterns
- **Real-time Counters:** Large numbers with subtle pulse animation
- **Status Chips:** Rounded badges (Available, Reserved, Full)
- **Time Displays:** Relative ("2 دقائق") and absolute (14:30)
- **Lists:** Card-based with dividers, not plain text rows

## Accessibility
- **Arabic RTL Support:** Consistent mirroring of all layouts
- **Color Independence:** Icons and text labels, not color alone
- **Touch Targets:** Minimum 48px for all interactive elements
- **High Contrast:** WCAG AA compliant for government standards

## Images
No hero images or marketing visuals. This is a functional utility app. All imagery is map-based and icon-driven.

**Icon Library:** Material Icons (via CDN)
- Bus icons with seat number overlays
- Navigation arrows
- Status indicators
- Profile and setting icons

## Critical Notes
- Minimize animations - focus on data clarity
- Prioritize load speed for real-time updates
- Ensure offline mode consideration for map caching
- Government branding placement in footer only