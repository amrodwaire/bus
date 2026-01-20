# Coster (كوستر) - Jordan Public Transport App

## Overview
Coster is a bilingual (Arabic/English) government transport application for Jordan's public transport sector. It allows bus drivers to manage their routes and passenger capacity, while citizens can track buses in real-time on an interactive map and reserve seats.

## Current State
MVP complete with:
- User authentication (citizen and driver registration)
- Real interactive map with React-Leaflet and OpenStreetMap
- Reservation system with priority-based booking
- Driver dashboard for capacity management
- Issue reporting system
- **Bilingual support (Arabic/English)** with language toggle

## Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/UI + Tailwind CSS
- **Mapping**: React-Leaflet 4.2.1 with OpenStreetMap tiles
- **Internationalization**: Custom i18n context with Arabic (RTL) and English (LTR) support
- **Font**: Cairo (Arabic-optimized Google Font)

### Backend (Express)
- **Framework**: Express.js
- **Storage**: In-memory storage (MemStorage)
- **API**: RESTful JSON API

### Data Models
- **Users**: Citizens and drivers with role-based access
- **Buses**: Driver-linked with capacity, visibility, and location
- **Reservations**: Priority-based booking system
- **Issue Reports**: Technical issue reporting

## Key Features
1. **Bilingual UI**: Toggle between Arabic (RTL) and English (LTR) with localStorage persistence
2. **Dual Registration**: Separate flows for citizens and drivers
3. **Real-time Bus Tracking**: Interactive map with custom markers showing seat availability
4. **Smart Reservations**: Priority system based on booking order
5. **Driver Controls**: Passenger count, visibility toggle, route management
6. **Issue Reporting**: Category-based technical issue submission

## i18n System
- Language context at `client/src/lib/language-context.tsx`
- Language toggle component at `client/src/components/language-toggle.tsx`
- Translation dictionary with 80+ keys covering all UI strings
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
- `POST /api/reservations` - Create reservation
- `PATCH /api/reservations/:id` - Update reservation
- `POST /api/reports` - Submit issue report

## Demo Credentials
- **Citizen**: username: `user1`, password: `123456`
- **Driver**: username: `driver1`, password: `123456`

## Development
- Run `npm run dev` to start both frontend and backend
- Server runs on port 5000
- Frontend is served from the same port via Vite middleware
