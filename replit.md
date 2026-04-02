# Coster (كوستر) - Jordan Public Transport App

## Overview
Coster is a bilingual (Arabic/English) government transport application for Jordan's public transport sector. It allows bus drivers to manage their routes and passenger capacity, while citizens can track buses in real-time on an interactive map and reserve seats.

## Current State
MVP complete with:
- User authentication (citizen and driver registration)
- Real interactive map with React-Leaflet and OpenStreetMap
- Reservation system with priority-based booking (one active reservation per user)
- Driver dashboard for capacity management with governorate selection
- **Citizen trip route selector** — click-on-map to pin departure (A) and destination (B) points, filters to matching buses by governorate
- **Driver waypoint management** — click-on-map to add route stops, save/clear, numbered markers
- **Seat pricing** — drivers set price per seat (in JD), shown on bus cards and reservation dialog
- Issue reporting system
- **Bilingual support (Arabic/English)** with language toggle and full RTL/LTR support
- Governorate-based bus filtering (user sees buses in their governorate)
- Demo credentials shown on login page

## Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/UI + Tailwind CSS
- **Mapping**: React-Leaflet 4.2.1 with OpenStreetMap tiles
- **Internationalization**: Custom i18n context with Arabic (RTL) and English (LTR) support, 170+ translation keys
- **Font**: Cairo (Arabic-optimized Google Font)

### Backend (Express)
- **Framework**: Express.js
- **Storage**: In-memory storage (MemStorage)
- **API**: RESTful JSON API

### Data Models
- **Users**: Citizens and drivers with role-based access
- **Buses**: Driver-linked with capacity, visibility, location, bilingual route names, and governorate metadata
- **Reservations**: Priority-based booking system (one active reservation per user enforced)
- **Issue Reports**: Technical issue reporting

## Key Features
1. **Bilingual UI**: Toggle between Arabic (RTL) and English (LTR) with localStorage persistence
2. **Dual Registration**: Separate flows for citizens and drivers
3. **Real-time Bus Tracking**: Interactive map with custom markers showing seat availability
4. **Smart Reservations**: Priority system based on booking order; one active reservation per user
5. **Driver Controls**: Passenger count, visibility toggle, route management with governorate selection
6. **Governorate Filtering**: User's location used to detect governorate, only relevant buses shown
7. **Issue Reporting**: Category-based technical issue submission

## Business Rules
- A citizen can only have ONE active reservation at a time
- Reservations must be cancelled before booking a new bus
- Bus auto-hides when it reaches full capacity
- Cancelling a reservation re-shows the bus if it was full

## i18n System
- Language context at `client/src/lib/language-context.tsx`
- Language toggle component at `client/src/components/language-toggle.tsx`
- Translation dictionary with 170+ keys covering all UI strings
- Document `dir` and `lang` attributes automatically updated
- Preference stored in localStorage under "language" key
- Default language: Arabic ("ar")

## API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/buses` - Get visible buses
- `GET /api/buses/driver/:driverId` - Get driver's bus
- `POST /api/buses` - Create new bus
- `PATCH /api/buses/:id` - Update bus
- `GET /api/reservations/user/:userId` - Get user reservations
- `GET /api/reservations/user/:userId/active` - Get user's active reservation (or null)
- `POST /api/reservations` - Create reservation (validates no existing active reservation)
- `PATCH /api/reservations/:id` - Update reservation (cancellation re-shows bus)
- `POST /api/reports` - Submit issue report

## Demo Credentials
- **Citizen**: username: `user1`, password: `123456`
- **Driver**: username: `driver1`, password: `123456`

## Development
- Run `npm run dev` to start both frontend and backend
- Server runs on port 5000
- Frontend is served from the same port via Vite middleware
