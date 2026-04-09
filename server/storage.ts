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
import sessionContainer from "express-session";
import MemoryStoreFactory from "memorystore";

const MemoryStore = MemoryStoreFactory(sessionContainer);

export interface IStorage {
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
    getBus(id: string): Promise<Bus | undefined>;
    getBusByDriver(driverId: string): Promise<Bus | undefined>;
    getVisibleBuses(): Promise<Bus[]>;
    createBus(bus: InsertBus): Promise<Bus>;
    updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined>;
    getRouteWaypoints(busId: string): Promise<RouteWaypoint[]>;
    getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>>;
    deleteRouteWaypoints(busId: string): Promise<void>;
    createRouteWaypoint(wp: InsertRouteWaypoint): Promise<RouteWaypoint>;
    createReservation(reservation: InsertReservation): Promise<Reservation>;
    getActiveReservationByUser(userId: string): Promise<Reservation | undefined>;
    getNextPriority(busId: string): Promise<number>;
    sessionStore: sessionContainer.Store;
}

export class MemStorage implements IStorage {
    private users: Map<string, User>;
    private buses: Map<string, Bus>;
    private routeWaypoints: Map<string, RouteWaypoint>;
    private reservations: Map<string, Reservation>;
    public sessionStore: sessionContainer.Store;

    constructor() {
        this.users = new Map();
        this.buses = new Map();
        this.routeWaypoints = new Map();
        this.reservations = new Map();
        // إعداد مخزن الجلسات للذاكرة (ضروري لتجنب تسريب الذاكرة في ريندر)
        this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
        this.seedData();
    }

    private seedData() {
        const dId = "driver-123";
        this.users.set(dId, {
            id: dId,
            username: "driver1",
            password: "123456",
            fullName: "أحمد السائق",
            role: "driver",
            phone: "0790000000",
            nationalId: "111",
            licenseNumber: "DL-123"
        } as any);

        const uId = "user-123";
        this.users.set(uId, {
            id: uId,
            username: "user1",
            password: "123456",
            fullName: "سارة المواطنة",
            role: "citizen",
            phone: "0780000000",
            nationalId: "222",
            licenseNumber: null
        } as any);
    }

    async getUser(id: string) { return this.users.get(id); }
    async getUserByUsername(username: string) {
        return Array.from(this.users.values()).find(u => u.username === username);
    }
    async createUser(insertUser: InsertUser) {
        const id = randomUUID();
        const user = { ...insertUser, id } as any;
        this.users.set(id, user);
        return user;
    }

    async getBus(id: string) { return this.buses.get(id); }
    async getBusByDriver(driverId: string) {
        return Array.from(this.buses.values()).find(b => b.driverId === driverId);
    }
    async getVisibleBuses() {
        return Array.from(this.buses.values()).filter(b => b.isVisible);
    }
    async createBus(insertBus: InsertBus) {
        const id = randomUUID();
        const bus = { ...insertBus, id, currentPassengers: 0, isVisible: true } as any;
        this.buses.set(id, bus);
        return bus;
    }
    async updateBus(id: string, updates: Partial<Bus>) {
        const bus = this.buses.get(id);
        if (!bus) return undefined;
        const updated = { ...bus, ...updates };
        this.buses.set(id, updated);
        return updated;
    }

    async getRouteWaypoints(busId: string) {
        return Array.from(this.routeWaypoints.values())
            .filter(wp => wp.busId === busId)
            .sort((a, b) => a.orderIndex - b.orderIndex);
    }

    // إصلاح الخطأ الموضح في الصورة image_aac184
    async getAllRouteWaypoints() {
        const res: Record<string, RouteWaypoint[]> = {};
        const waypoints = Array.from(this.routeWaypoints.values());
        for (const wp of waypoints) {
            if (!res[wp.busId]) res[wp.busId] = [];
            res[wp.busId].push(wp);
        }
        return res;
    }

    async createRouteWaypoint(wp: InsertRouteWaypoint) {
        const id = randomUUID();
        const newWp = { ...wp, id } as any;
        this.routeWaypoints.set(id, newWp);
        return newWp;
    }

    // إصلاح الخطأ الموضح في الصورة image_aab9c2
    async deleteRouteWaypoints(busId: string) {
        const entries = Array.from(this.routeWaypoints.entries());
        for (const [id, wp] of entries) {
            if (wp.busId === busId) {
                this.routeWaypoints.delete(id);
            }
        }
    }

    async getActiveReservationByUser(userId: string) {
        return Array.from(this.reservations.values())
            .find(r => r.passengerId === userId && r.status === "confirmed");
    }

    async createReservation(res: InsertReservation) {
        const id = randomUUID();
        const newRes = { ...res, id, createdAt: new Date() } as any;
        this.reservations.set(id, newRes);
        return newRes;
    }

    async getNextPriority(busId: string) {
        const list = Array.from(this.reservations.values()).filter(r => r.busId === busId);
        return list.length + 1;
    }
}

export const storage = new MemStorage();