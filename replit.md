# Coster (كوستر) - Jordan Public Transport App

## Overview
Coster is a government transport application for Jordan's public transport sector. It allows bus drivers to manage their routes and passenger capacity, while citizens can track buses in real-time and reserve seats.

## Current State
MVP complete with:
- User authentication (citizen and driver registration)
- Interactive map showing available buses
- Reservation system with priority-based booking
- Driver dashboard for capacity management
- Issue reporting system

## Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/UI + Tailwind CSS
- **Language**: Arabic RTL with Cairo font

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
1. **Dual Registration**: Separate flows for citizens and drivers
2. **Real-time Bus Tracking**: Map view with bus markers showing availability
3. **Smart Reservations**: Priority system based on booking order
4. **Driver Controls**: Passenger count, visibility toggle, route management
5. **Issue Reporting**: Category-based technical issue submission

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
