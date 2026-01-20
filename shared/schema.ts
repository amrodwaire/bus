import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - supports both drivers and citizens
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("citizen"), // "citizen" or "driver"
  nationalId: text("national_id"), // Jordanian national ID
  licenseNumber: text("license_number"), // For drivers only
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  phone: true,
  role: true,
  nationalId: true,
  licenseNumber: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Buses table
export const buses = pgTable("buses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull(),
  plateNumber: text("plate_number").notNull(),
  routeName: text("route_name").notNull(),
  totalCapacity: integer("total_capacity").notNull().default(15),
  currentPassengers: integer("current_passengers").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  currentLat: real("current_lat"),
  currentLng: real("current_lng"),
});

export const insertBusSchema = createInsertSchema(buses).pick({
  driverId: true,
  plateNumber: true,
  routeName: true,
  totalCapacity: true,
  currentPassengers: true,
  isVisible: true,
  currentLat: true,
  currentLng: true,
});

export type InsertBus = z.infer<typeof insertBusSchema>;
export type Bus = typeof buses.$inferSelect;

// Route waypoints for buses
export const routeWaypoints = pgTable("route_waypoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  busId: varchar("bus_id").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  orderIndex: integer("order_index").notNull(),
  name: text("name"), // Optional name for the stop
});

export const insertRouteWaypointSchema = createInsertSchema(routeWaypoints).pick({
  busId: true,
  lat: true,
  lng: true,
  orderIndex: true,
  name: true,
});

export type InsertRouteWaypoint = z.infer<typeof insertRouteWaypointSchema>;
export type RouteWaypoint = typeof routeWaypoints.$inferSelect;

// Reservations
export const reservations = pgTable("reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  passengerId: varchar("passenger_id").notNull(),
  busId: varchar("bus_id").notNull(),
  pickupLat: real("pickup_lat").notNull(),
  pickupLng: real("pickup_lng").notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, completed, cancelled
  priority: integer("priority").notNull(), // Lower number = higher priority (based on booking order)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReservationSchema = createInsertSchema(reservations).pick({
  passengerId: true,
  busId: true,
  pickupLat: true,
  pickupLng: true,
  status: true,
  priority: true,
});

export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

// Issue reports
export const issueReports = pgTable("issue_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull(), // "technical", "route", "feedback"
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"), // pending, reviewed, resolved
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIssueReportSchema = createInsertSchema(issueReports).pick({
  userId: true,
  category: true,
  description: true,
  status: true,
});

export type InsertIssueReport = z.infer<typeof insertIssueReportSchema>;
export type IssueReport = typeof issueReports.$inferSelect;

// Extended types for frontend use
export type BusWithDriver = Bus & { driver?: User };
export type ReservationWithDetails = Reservation & { bus?: Bus; passenger?: User };
