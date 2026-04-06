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
import { randomUUID } from "crypto";

export interface IStorage {
    // Users
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;

    // Buses
    getBus(id: string): Promise<Bus | undefined>;
    getBusByDriver(driverId: string): Promise<Bus | undefined>;
    getAllBuses(): Promise<Bus[]>;
    getVisibleBuses(): Promise<Bus[]>;
    createBus(bus: InsertBus): Promise<Bus>;
    updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined>;

    // Route Waypoints
    getRouteWaypoints(busId: string): Promise<RouteWaypoint[]>;
    getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>>;
    createRouteWaypoint(waypoint: InsertRouteWaypoint): Promise<RouteWaypoint>;
    deleteRouteWaypoints(busId: string): Promise<void>;

    // Reservations
    getReservation(id: string): Promise<Reservation | undefined>;
    getReservationsByUser(userId: string): Promise<(Reservation & { bus?: Bus })[]>;
    getActiveReservationByUser(userId: string): Promise<Reservation | undefined>;
    getReservationsByBus(busId: string): Promise<Reservation[]>;
    createReservation(reservation: InsertReservation): Promise<Reservation>;
    updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation | undefined>;
    getNextPriority(busId: string): Promise<number>;

    // Issue Reports
    createIssueReport(report: InsertIssueReport): Promise<IssueReport>;
    getIssueReports(): Promise<IssueReport[]>;
}

export class MemStorage implements IStorage {
    private users: Map<string, User>;
    private buses: Map<string, Bus>;
    private routeWaypoints: Map<string, RouteWaypoint>;
    private reservations: Map<string, Reservation>;
    private issueReports: Map<string, IssueReport>;

    constructor() {
        this.users = new Map();
        this.buses = new Map();
        this.routeWaypoints = new Map();
        this.reservations = new Map();
        this.issueReports = new Map();

        // Seed some demo data
        this.seedData();
    }

    private seedData() {
        // Create demo driver
        const driverId = randomUUID();
        const driver: User = {
            id: driverId,
            username: "driver1",
            password: "123456",
            fullName: "أحمد محمد",
            phone: "0791234567",
            role: "driver",
            nationalId: "1234567890",
            licenseNumber: "DL-12345"
        };
        this.users.set(driverId, driver);

        // Create demo citizen
        const citizenId = randomUUID();
        const citizen: User = {
            id: citizenId,
            username: "user1",
            password: "123456",
            fullName: "سارة أحمد",
            phone: "0797654321",
            role: "citizen",
            nationalId: "0987654321",
            licenseNumber: null
        };
        this.users.set(citizenId, citizen);

        // Create demo buses (other drivers, not driver1 — driver1 registers fresh each session)
        const bus2Id = randomUUID();
        const bus2: Bus = {
            id: bus2Id,
            driverId: randomUUID(),
            plateNumber: "23-45678",
            routeName: "عمان - إربد",
            routeNameEn: "Amman - Irbid",
            governorate: "amman",
            destinationGovernorate: "irbid",
            totalCapacity: 20,
            currentPassengers: 5,
            isVisible: true,
            currentLat: 32.0,
            currentLng: 35.85,
            price: 1.25
        };
        this.buses.set(bus2Id, bus2);

        const bus3Id = randomUUID();
        const bus3: Bus = {
            id: bus3Id,
            driverId: randomUUID(),
            plateNumber: "34-56789",
            routeName: "عمان - العقبة",
            routeNameEn: "Amman - Aqaba",
            governorate: "amman",
            destinationGovernorate: "aqaba",
            totalCapacity: 25,
            currentPassengers: 22,
            isVisible: true,
            currentLat: 31.85,
            currentLng: 35.95,
            price: 3.0
        };
        this.buses.set(bus3Id, bus3);

        const bus4Id = randomUUID();
        const bus4: Bus = {
            id: bus4Id,
            driverId: randomUUID(),
            plateNumber: "45-67890",
            routeName: "إربد - عجلون",
            routeNameEn: "Irbid - Ajloun",
            governorate: "irbid",
            destinationGovernorate: "ajloun",
            totalCapacity: 12,
            currentPassengers: 3,
            isVisible: true,
            currentLat: 32.55,
            currentLng: 35.85,
            price: 0.75
        };
        this.buses.set(bus4Id, bus4);

        const bus5Id = randomUUID();
        const bus5: Bus = {
            id: bus5Id,
            driverId: randomUUID(),
            plateNumber: "56-78901",
            routeName: "الزرقاء - المفرق",
            routeNameEn: "Zarqa - Mafraq",
            governorate: "zarqa",
            destinationGovernorate: "mafraq",
            totalCapacity: 18,
            currentPassengers: 10,
            isVisible: true,
            currentLat: 32.07,
            currentLng: 36.1,
            price: 1.0
        };
        this.buses.set(bus5Id, bus5);
    }

    // Users
    async getUser(id: string): Promise<User | undefined> {
        return this.users.get(id);
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        return Array.from(this.users.values()).find(
            (user) => user.username === username,
        );
    }

    async createUser(insertUser: InsertUser): Promise<User> {
        const id = randomUUID();
        const user: User = {
            ...insertUser,
            id,
            role: insertUser.role ?? "citizen",
            nationalId: insertUser.nationalId ?? null,
            licenseNumber: insertUser.licenseNumber ?? null
        };
        this.users.set(id, user);
        return user;
    }

    // Buses
    async getBus(id: string): Promise<Bus | undefined> {
        return this.buses.get(id);
    }

    async getBusByDriver(driverId: string): Promise<Bus | undefined> {
        return Array.from(this.buses.values()).find(
            (bus) => bus.driverId === driverId
        );
    }

    async getAllBuses(): Promise<Bus[]> {
        return Array.from(this.buses.values());
    }

    async getVisibleBuses(): Promise<Bus[]> {
        return Array.from(this.buses.values()).filter((bus) => bus.isVisible);
    }

    async createBus(insertBus: InsertBus): Promise<Bus> {
        const id = randomUUID();
        const bus: Bus = {
            ...insertBus,
            id,
            routeNameEn: insertBus.routeNameEn ?? null,
            governorate: insertBus.governorate ?? null,
            destinationGovernorate: insertBus.destinationGovernorate ?? null,
            totalCapacity: insertBus.totalCapacity ?? 15,
            currentPassengers: insertBus.currentPassengers ?? 0,
            isVisible: insertBus.isVisible ?? true,
            currentLat: insertBus.currentLat ?? 31.9539,
            currentLng: insertBus.currentLng ?? 35.9106,
            price: insertBus.price ?? null
        };
        this.buses.set(id, bus);
        return bus;
    }

    async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined> {
        const bus = this.buses.get(id);
        if (!bus) return undefined;

        const updatedBus = { ...bus, ...updates };
        this.buses.set(id, updatedBus);
        return updatedBus;
    }

    // Route Waypoints
    async getRouteWaypoints(busId: string): Promise<RouteWaypoint[]> {
        return Array.from(this.routeWaypoints.values())
            .filter((wp) => wp.busId === busId)
            .sort((a, b) => a.orderIndex - b.orderIndex);
    }

    async getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>> {
        const result: Record<string, RouteWaypoint[]> = {};
        for (const wp of Array.from(this.routeWaypoints.values())) {
            if (!result[wp.busId]) result[wp.busId] = [];
            result[wp.busId].push(wp);
        }
        for (const busId of Object.keys(result)) {
            result[busId].sort((a, b) => a.orderIndex - b.orderIndex);
        }
        return result;
    }

    async createRouteWaypoint(insertWaypoint: InsertRouteWaypoint): Promise<RouteWaypoint> {
        const id = randomUUID();
        const waypoint: RouteWaypoint = {
            ...insertWaypoint,
            id,
            name: insertWaypoint.name || null
        };
        this.routeWaypoints.set(id, waypoint);
        return waypoint;
    }

    async deleteRouteWaypoints(busId: string): Promise<void> {
        for (const [id, wp] of Array.from(this.routeWaypoints.entries())) {
            if (wp.busId === busId) {
                this.routeWaypoints.delete(id);
            }
        }
    }

    // Reservations
    async getReservation(id: string): Promise<Reservation | undefined> {
        return this.reservations.get(id);
    }

    async getReservationsByUser(userId: string): Promise<(Reservation & { bus?: Bus })[]> {
        const reservations = Array.from(this.reservations.values())
            .filter((r) => r.passengerId === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return reservations.map(r => ({
            ...r,
            bus: this.buses.get(r.busId)
        }));
    }

    async getActiveReservationByUser(userId: string): Promise<Reservation | undefined> {
        return Array.from(this.reservations.values()).find(
            (r) => r.passengerId === userId && (r.status === "pending" || r.status === "confirmed")
        );
    }

    async getReservationsByBus(busId: string): Promise<Reservation[]> {
        return Array.from(this.reservations.values())
            .filter((r) => r.busId === busId && (r.status === "pending" || r.status === "confirmed"))
            .sort((a, b) => a.priority - b.priority);
    }

    async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
        const id = randomUUID();
        const reservation: Reservation = {
            ...insertReservation,
            id,
            status: insertReservation.status ?? "pending",
            createdAt: new Date()
        };
        this.reservations.set(id, reservation);
        return reservation;
    }

    async updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation | undefined> {
        const reservation = this.reservations.get(id);
        if (!reservation) return undefined;

        const updatedReservation = { ...reservation, ...updates };
        this.reservations.set(id, updatedReservation);
        return updatedReservation;
    }

    async getNextPriority(busId: string): Promise<number> {
        const reservations = await this.getReservationsByBus(busId);
        if (reservations.length === 0) return 1;
        return Math.max(...reservations.map(r => r.priority)) + 1;
    }

    // Issue Reports
    async createIssueReport(insertReport: InsertIssueReport): Promise<IssueReport> {
        const id = randomUUID();
        const report: IssueReport = {
            ...insertReport,
            id,
            status: insertReport.status ?? "pending",
            createdAt: new Date()
        };
        this.issueReports.set(id, report);
        return report;
    }

    async getIssueReports(): Promise<IssueReport[]> {
        return Array.from(this.issueReports.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
}

export const storage = new MemStorage();
