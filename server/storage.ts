import {
    type User,
    type InsertUser,
    type Bus,
    type InsertBus,
    type Reservation,
    type InsertReservation,
    type RouteWaypoint,
    type InsertRouteWaypoint,
    type IssueReport,
    type InsertIssueReport
} from "@shared/schema";
import * as schema from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, desc, inArray, max } from "drizzle-orm";
import sessionContainer from "express-session";
import MemoryStoreFactory from "memorystore";

const MemoryStore = MemoryStoreFactory(sessionContainer);

export interface CitizenLocation {
    lat: number;
    lng: number;
    timestamp: number;
}

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export interface IStorage {
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
    updateUserPassword(id: string, password: string): Promise<void>;
    getBus(id: string): Promise<Bus | undefined>;
    getBusByDriver(driverId: string): Promise<Bus | undefined>;
    getAllBuses(): Promise<Bus[]>;
    getVisibleBuses(): Promise<Bus[]>;
    createBus(bus: InsertBus): Promise<Bus>;
    updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined>;
    getRouteWaypoints(busId: string): Promise<RouteWaypoint[]>;
    getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>>;
    createRouteWaypoint(waypoint: InsertRouteWaypoint): Promise<RouteWaypoint>;
    deleteRouteWaypoints(busId: string): Promise<void>;
    getReservation(id: string): Promise<Reservation | undefined>;
    getReservationsByUser(userId: string): Promise<(Reservation & { bus?: Bus })[]>;
    getActiveReservationByUser(userId: string): Promise<Reservation | undefined>;
    getReservationsByBus(busId: string): Promise<Reservation[]>;
    createReservation(reservation: InsertReservation): Promise<Reservation>;
    updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation | undefined>;
    getNextPriority(busId: string): Promise<number>;
    createIssueReport(report: InsertIssueReport): Promise<IssueReport>;
    getIssueReports(): Promise<IssueReport[]>;

    // الدوال الناقصة لتتبع المواقع وإدارة الجلسات
    setCitizenLocation(userId: string, loc: CitizenLocation): void;
    getCitizenLocation(userId: string): CitizenLocation | undefined;
    getCitizenLocationsForBus(busId: string): Promise<{ userId: string; name: string; lat: number; lng: number }[]>;
    sessionStore: sessionContainer.Store;
}

export class DatabaseStorage implements IStorage {
    public sessionStore: sessionContainer.Store;
    private citizenLocations: Map<string, CitizenLocation>;

    constructor() {
        // تهيئة إدارة الجلسات ومواقع المواطنين في الذاكرة
        this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
        this.citizenLocations = new Map();
    }

    async getUser(id: string): Promise<User | undefined> {
        const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
        return user;
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
        return user;
    }

    async createUser(insertUser: InsertUser): Promise<User> {
        const [user] = await db.insert(schema.users).values(insertUser).returning();
        return user;
    }

    async updateUserPassword(id: string, password: string): Promise<void> {
        await db
            .update(schema.users)
            .set({ password })
            .where(eq(schema.users.id, id));
    }

    async getBus(id: string): Promise<Bus | undefined> {
        const [bus] = await db.select().from(schema.buses).where(eq(schema.buses.id, id));
        return bus;
    }

    async getBusByDriver(driverId: string): Promise<Bus | undefined> {
        const [bus] = await db.select().from(schema.buses).where(eq(schema.buses.driverId, driverId));
        return bus;
    }

    async getAllBuses(): Promise<Bus[]> {
        return await db.select().from(schema.buses);
    }

    async getVisibleBuses(): Promise<Bus[]> {
        return await db.select().from(schema.buses).where(eq(schema.buses.isVisible, true));
    }

    async createBus(insertBus: InsertBus): Promise<Bus> {
        const [bus] = await db.insert(schema.buses).values({
            ...insertBus,
            currentPassengers: insertBus.currentPassengers ?? 0,
            isVisible: insertBus.isVisible ?? true,
            currentLat: insertBus.currentLat ?? 31.9539,
            currentLng: insertBus.currentLng ?? 35.9106,
            speed: insertBus.speed ?? 40
        }).returning();
        return bus;
    }

    async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined> {
        const [updatedBus] = await db
            .update(schema.buses)
            .set(updates)
            .where(eq(schema.buses.id, id))
            .returning();
        return updatedBus;
    }

    async getRouteWaypoints(busId: string): Promise<RouteWaypoint[]> {
        return await db
            .select()
            .from(schema.routeWaypoints)
            .where(eq(schema.routeWaypoints.busId, busId))
            .orderBy(schema.routeWaypoints.orderIndex);
    }

    async getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>> {
        const waypoints = await db
            .select()
            .from(schema.routeWaypoints)
            .orderBy(schema.routeWaypoints.orderIndex);

        const result: Record<string, RouteWaypoint[]> = {};
        for (const wp of waypoints) {
            if (!result[wp.busId]) result[wp.busId] = [];
            result[wp.busId].push(wp);
        }
        return result;
    }

    async createRouteWaypoint(insertWaypoint: InsertRouteWaypoint): Promise<RouteWaypoint> {
        const [waypoint] = await db.insert(schema.routeWaypoints).values(insertWaypoint).returning();
        return waypoint;
    }

    async deleteRouteWaypoints(busId: string): Promise<void> {
        await db.delete(schema.routeWaypoints).where(eq(schema.routeWaypoints.busId, busId));
    }

    async getReservation(id: string): Promise<Reservation | undefined> {
        const [reservation] = await db.select().from(schema.reservations).where(eq(schema.reservations.id, id));
        return reservation;
    }

    async getReservationsByUser(userId: string): Promise<(Reservation & { bus?: Bus })[]> {
        const rows = await db
            .select({
                reservation: schema.reservations,
                bus: schema.buses
            })
            .from(schema.reservations)
            .leftJoin(schema.buses, eq(schema.reservations.busId, schema.buses.id))
            .where(eq(schema.reservations.passengerId, userId))
            .orderBy(desc(schema.reservations.createdAt));

        return rows.map(row => ({
            ...row.reservation,
            bus: row.bus ?? undefined
        }));
    }

    async getActiveReservationByUser(userId: string): Promise<Reservation | undefined> {
        const [reservation] = await db
            .select()
            .from(schema.reservations)
            .where(
                and(
                    eq(schema.reservations.passengerId, userId),
                    inArray(schema.reservations.status, ["pending", "confirmed"])
                )
            );
        return reservation;
    }

    async getReservationsByBus(busId: string): Promise<Reservation[]> {
        return await db
            .select()
            .from(schema.reservations)
            .where(
                and(
                    eq(schema.reservations.busId, busId),
                    inArray(schema.reservations.status, ["pending", "confirmed"])
                )
            )
            .orderBy(schema.reservations.priority);
    }

    async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
        const [reservation] = await db.insert(schema.reservations).values(insertReservation).returning();
        return reservation;
    }

    async updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation | undefined> {
        const [updatedReservation] = await db
            .update(schema.reservations)
            .set(updates)
            .where(eq(schema.reservations.id, id))
            .returning();
        return updatedReservation;
    }

    async getNextPriority(busId: string): Promise<number> {
        const [result] = await db
            .select({ maxPriority: max(schema.reservations.priority) })
            .from(schema.reservations)
            .where(
                and(
                    eq(schema.reservations.busId, busId),
                    inArray(schema.reservations.status, ["pending", "confirmed"])
                )
            );
        return (result.maxPriority ?? 0) + 1;
    }

    async createIssueReport(insertReport: InsertIssueReport): Promise<IssueReport> {
        const [report] = await db.insert(schema.issueReports).values({
            ...insertReport,
            status: insertReport.status ?? "pending"
        }).returning();
        return report;
    }

    async getIssueReports(): Promise<IssueReport[]> {
        return await db
            .select()
            .from(schema.issueReports)
            .orderBy(desc(schema.issueReports.createdAt));
    }

    // --- تنفيذ الدوال الخاصة بتتبع المواقع ---
    setCitizenLocation(userId: string, loc: CitizenLocation) {
        this.citizenLocations.set(userId, loc);
    }

    getCitizenLocation(userId: string) {
        return this.citizenLocations.get(userId);
    }

    async getCitizenLocationsForBus(busId: string) {
        return [];
    }
}

export const storage = new DatabaseStorage();