import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertBusSchema, insertReservationSchema, insertIssueReportSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============ AUTH ROUTES ============
  
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      // Don't send password back
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parseResult = insertUserSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
      }
      
      const existingUser = await storage.getUserByUsername(parseResult.data.username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم مستخدم بالفعل" });
      }
      
      const user = await storage.createUser(parseResult.data);
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // ============ BUS ROUTES ============
  
  // Get all visible buses
  app.get("/api/buses", async (req, res) => {
    try {
      const buses = await storage.getVisibleBuses();
      res.json(buses);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Get bus by driver ID
  app.get("/api/buses/driver/:driverId", async (req, res) => {
    try {
      const bus = await storage.getBusByDriver(req.params.driverId);
      res.json(bus || null);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Get single bus
  app.get("/api/buses/:id", async (req, res) => {
    try {
      const bus = await storage.getBus(req.params.id);
      if (!bus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }
      res.json(bus);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Create bus
  app.post("/api/buses", async (req, res) => {
    try {
      const parseResult = insertBusSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
      }
      
      const bus = await storage.createBus(parseResult.data);
      res.status(201).json(bus);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Update bus
  app.patch("/api/buses/:id", async (req, res) => {
    try {
      const currentBus = await storage.getBus(req.params.id);
      if (!currentBus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }
      
      // Only allow specific fields to be updated
      const allowedFields = ["currentPassengers", "isVisible", "currentLat", "currentLng", "routeName"];
      const updates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      // Validate currentPassengers
      if (updates.currentPassengers !== undefined) {
        const passengers = Number(updates.currentPassengers);
        if (isNaN(passengers) || passengers < 0 || passengers > currentBus.totalCapacity) {
          return res.status(400).json({ message: "عدد الركاب غير صالح" });
        }
        updates.currentPassengers = passengers;
        
        // Auto-hide bus if full
        if (passengers >= currentBus.totalCapacity) {
          updates.isVisible = false;
        }
      }
      
      const bus = await storage.updateBus(req.params.id, updates);
      
      res.json(bus);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // ============ ROUTE WAYPOINTS ============
  
  // Get route waypoints
  app.get("/api/routes/:busId", async (req, res) => {
    try {
      const waypoints = await storage.getRouteWaypoints(req.params.busId);
      res.json(waypoints);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Set route waypoints (replaces existing)
  app.post("/api/routes/:busId", async (req, res) => {
    try {
      const { waypoints } = req.body;
      
      if (!Array.isArray(waypoints)) {
        return res.status(400).json({ message: "بيانات غير صالحة" });
      }
      
      // Delete existing waypoints
      await storage.deleteRouteWaypoints(req.params.busId);
      
      // Create new waypoints
      const createdWaypoints = [];
      for (let i = 0; i < waypoints.length; i++) {
        const wp = await storage.createRouteWaypoint({
          busId: req.params.busId,
          lat: waypoints[i].lat,
          lng: waypoints[i].lng,
          orderIndex: i,
          name: waypoints[i].name || null
        });
        createdWaypoints.push(wp);
      }
      
      res.status(201).json(createdWaypoints);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // ============ RESERVATION ROUTES ============
  
  // Get user's reservations
  app.get("/api/reservations/user/:userId", async (req, res) => {
    try {
      const reservations = await storage.getReservationsByUser(req.params.userId);
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Get bus reservations
  app.get("/api/reservations/bus/:busId", async (req, res) => {
    try {
      const reservations = await storage.getReservationsByBus(req.params.busId);
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Create reservation
  app.post("/api/reservations", async (req, res) => {
    try {
      const { busId, pickupLat, pickupLng, passengerId } = req.body;
      
      if (!busId || pickupLat === undefined || pickupLng === undefined) {
        return res.status(400).json({ message: "بيانات غير صالحة" });
      }
      
      // Check if bus exists and has capacity
      const bus = await storage.getBus(busId);
      if (!bus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }
      
      if (bus.currentPassengers >= bus.totalCapacity) {
        return res.status(400).json({ message: "الباص ممتلئ" });
      }
      
      // Validate pickup location is on the route (ahead of bus)
      // Simplified validation: check if pickup is within reasonable distance of bus
      if (bus.currentLat && bus.currentLng) {
        const busLat = bus.currentLat;
        const busLng = bus.currentLng;
        
        // Calculate simple distance (in degrees, roughly)
        const latDiff = pickupLat - busLat;
        const lngDiff = pickupLng - busLng;
        
        // For Jordan routes (generally north-south or east-west)
        // Passenger should be ahead or nearby, not too far behind
        // We use a simplified check: passenger should be within ~50km radius
        // and ideally ahead in the general direction
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        // ~0.5 degrees is roughly 50km
        if (distance > 0.5) {
          return res.status(400).json({ 
            message: "موقعك بعيد جداً عن مسار الباص. يرجى اختيار باص أقرب إليك" 
          });
        }
        
        // Check if passenger is behind the bus (simplified: if latitude is significantly less)
        // This is a simplified check - in production, you'd use actual route waypoints
        // For demo purposes, we're lenient
      }
      
      // Get next priority number
      const priority = await storage.getNextPriority(busId);
      
      const reservation = await storage.createReservation({
        passengerId: passengerId || "anonymous",
        busId,
        pickupLat,
        pickupLng,
        status: "confirmed",
        priority
      });
      
      // Increment passenger count on the bus
      const newPassengerCount = bus.currentPassengers + 1;
      const isFull = newPassengerCount >= bus.totalCapacity;
      
      // Update bus: increment passengers and hide if full
      await storage.updateBus(busId, {
        currentPassengers: newPassengerCount,
        isVisible: isFull ? false : bus.isVisible
      });
      
      res.status(201).json(reservation);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Update reservation
  app.patch("/api/reservations/:id", async (req, res) => {
    try {
      const { status } = req.body;
      
      // Only allow status updates
      if (!status || !["pending", "confirmed", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "حالة غير صالحة" });
      }
      
      // Get current reservation
      const currentReservation = await storage.getReservation(req.params.id);
      if (!currentReservation) {
        return res.status(404).json({ message: "الحجز غير موجود" });
      }
      
      // If cancelling, decrement passenger count and potentially show bus again
      if (status === "cancelled" && currentReservation.status !== "cancelled") {
        const bus = await storage.getBus(currentReservation.busId);
        if (bus) {
          const newPassengerCount = Math.max(0, bus.currentPassengers - 1);
          // If bus was hidden due to being full, show it again
          await storage.updateBus(bus.id, {
            currentPassengers: newPassengerCount,
            isVisible: true // Make visible again since there's now space
          });
        }
      }
      
      const reservation = await storage.updateReservation(req.params.id, { status });
      
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // ============ ISSUE REPORTS ============
  
  // Create issue report
  app.post("/api/reports", async (req, res) => {
    try {
      const { category, description, userId } = req.body;
      
      if (!category || !description) {
        return res.status(400).json({ message: "النوع والوصف مطلوبان" });
      }
      
      const report = await storage.createIssueReport({
        userId: userId || "anonymous",
        category,
        description,
        status: "pending"
      });
      
      // Generate ticket number
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
      
      res.status(201).json({ ...report, ticketNumber });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  // Get all reports (admin only in real app)
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getIssueReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  return httpServer;
}
