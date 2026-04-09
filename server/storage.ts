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
import { Pool } from "pg";

export interface CitizenLocation {
    lat: number;
    lng: number;
    timestamp: number;
}

export interface IStorage {
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;

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

    setCitizenLocation(userId: string, loc: CitizenLocation): void;
    getCitizenLocation(userId: string): CitizenLocation | undefined;
    getCitizenLocationsForBus(busId: string): Promise<{ userId: string; name: string; lat: number; lng: number }[]>;
}

// ============================================================
// PostgreSQL Storage
// ============================================================
export class PgStorage implements IStorage {
    private pool: Pool;
    private citizenLocations: Map<string, CitizenLocation> = new Map();
    private busLastUpdate: Map<string, { lat: number; lng: number; time: number }> = new Map();

    constructor(connectionString: string) {
        this.pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
        });
        this.initTables();
    }

    private async initTables() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT,
                role TEXT NOT NULL DEFAULT 'citizen',
                national_id TEXT,
                license_number TEXT
            );

            CREATE TABLE IF NOT EXISTS buses (
                id TEXT PRIMARY KEY,
                driver_id TEXT NOT NULL,
                plate_number TEXT NOT NULL,
                route_name TEXT NOT NULL,
                route_name_en TEXT,
                governorate TEXT,
                destination_governorate TEXT,
                total_capacity INTEGER NOT NULL DEFAULT 15,
                current_passengers INTEGER NOT NULL DEFAULT 0,
                is_visible BOOLEAN NOT NULL DEFAULT true,
                current_lat DOUBLE PRECISION DEFAULT 31.9539,
                current_lng DOUBLE PRECISION DEFAULT 35.9106,
                price DOUBLE PRECISION,
                speed INTEGER
            );

            CREATE TABLE IF NOT EXISTS route_waypoints (
                id TEXT PRIMARY KEY,
                bus_id TEXT NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lng DOUBLE PRECISION NOT NULL,
                order_index INTEGER NOT NULL,
                name TEXT
            );

            CREATE TABLE IF NOT EXISTS reservations (
                id TEXT PRIMARY KEY,
                passenger_id TEXT NOT NULL,
                bus_id TEXT NOT NULL,
                pickup_lat DOUBLE PRECISION NOT NULL,
                pickup_lng DOUBLE PRECISION NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                priority INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS issue_reports (
                id TEXT PRIMARY KEY,
                reporter_id TEXT,
                bus_id TEXT,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        console.log("✅ Database tables initialized.");
    }

    // ── Users ──────────────────────────────────────────────
    async getUser(id: string): Promise<User | undefined> {
        const { rows } = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
        return rows[0] ? this.mapUser(rows[0]) : undefined;
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const { rows } = await this.pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        return rows[0] ? this.mapUser(rows[0]) : undefined;
    }

    async createUser(insertUser: InsertUser): Promise<User> {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO users (id, username, password, full_name, phone, role, national_id, license_number)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [
                id,
                insertUser.username,
                insertUser.password,
                insertUser.fullName,
                insertUser.phone ?? null,
                insertUser.role ?? "citizen",
                insertUser.nationalId ?? null,
                (insertUser as any).licenseNumber ?? null,
            ]
        );
        return this.mapUser(rows[0]);
    }

    private mapUser(row: any): User {
        return {
            id: row.id,
            username: row.username,
            password: row.password,
            fullName: row.full_name,
            phone: row.phone,
            role: row.role,
            nationalId: row.national_id,
            licenseNumber: row.license_number,
        };
    }

    // ── Buses ──────────────────────────────────────────────
    async getBus(id: string): Promise<Bus | undefined> {
        const { rows } = await this.pool.query(`SELECT * FROM buses WHERE id = $1`, [id]);
        return rows[0] ? this.mapBus(rows[0]) : undefined;
    }

    async getBusByDriver(driverId: string): Promise<Bus | undefined> {
        const { rows } = await this.pool.query(`SELECT * FROM buses WHERE driver_id = $1`, [driverId]);
        return rows[0] ? this.mapBus(rows[0]) : undefined;
    }

    async getAllBuses(): Promise<Bus[]> {
        const { rows } = await this.pool.query(`SELECT * FROM buses`);
        return rows.map(this.mapBus);
    }

    async getVisibleBuses(): Promise<Bus[]> {
        const { rows } = await this.pool.query(`SELECT * FROM buses WHERE is_visible = true`);
        return rows.map(this.mapBus);
    }

    async createBus(insertBus: InsertBus): Promise<Bus> {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO buses (id, driver_id, plate_number, route_name, route_name_en, governorate,
             destination_governorate, total_capacity, current_passengers, is_visible, current_lat, current_lng, price, speed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [
                id,
                insertBus.driverId,
                insertBus.plateNumber,
                insertBus.routeName,
                insertBus.routeNameEn ?? null,
                insertBus.governorate ?? null,
                insertBus.destinationGovernorate ?? null,
                insertBus.totalCapacity ?? 15,
                insertBus.currentPassengers ?? 0,
                insertBus.isVisible ?? true,
                insertBus.currentLat ?? 31.9539,
                insertBus.currentLng ?? 35.9106,
                insertBus.price ?? null,
                null,
            ]
        );
        return this.mapBus(rows[0]);
    }

    calculateSpeed(busId: string, newLat: number, newLng: number): number | null {
        const prev = this.busLastUpdate.get(busId);
        const now = Date.now();
        if (!prev) { this.busLastUpdate.set(busId, { lat: newLat, lng: newLng, time: now }); return null; }
        const timeDiffSec = (now - prev.time) / 1000;
        if (timeDiffSec < 3) return null;
        const R = 6371000;
        const dLat = ((newLat - prev.lat) * Math.PI) / 180;
        const dLng = ((newLng - prev.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((prev.lat * Math.PI) / 180) * Math.cos((newLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const distMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        this.busLastUpdate.set(busId, { lat: newLat, lng: newLng, time: now });
        return Math.round((distMeters / timeDiffSec) * 3.6);
    }

    async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined> {
        if (updates.currentLat != null && updates.currentLng != null) {
            const speed = this.calculateSpeed(id, updates.currentLat, updates.currentLng);
            if (speed !== null && speed < 200) updates.speed = speed;
        }
        const fields: string[] = [];
        const values: any[] = [];
        let i = 1;
        const colMap: Record<string, string> = {
            driverId: "driver_id", plateNumber: "plate_number", routeName: "route_name",
            routeNameEn: "route_name_en", governorate: "governorate",
            destinationGovernorate: "destination_governorate", totalCapacity: "total_capacity",
            currentPassengers: "current_passengers", isVisible: "is_visible",
            currentLat: "current_lat", currentLng: "current_lng", price: "price", speed: "speed",
        };
        for (const [key, val] of Object.entries(updates)) {
            const col = colMap[key];
            if (col) { fields.push(`${col} = $${i++}`); values.push(val); }
        }
        if (fields.length === 0) return this.getBus(id);
        values.push(id);
        const { rows } = await this.pool.query(
            `UPDATE buses SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values
        );
        return rows[0] ? this.mapBus(rows[0]) : undefined;
    }

    private mapBus(row: any): Bus {
        return {
            id: row.id, driverId: row.driver_id, plateNumber: row.plate_number,
            routeName: row.route_name, routeNameEn: row.route_name_en,
            governorate: row.governorate, destinationGovernorate: row.destination_governorate,
            totalCapacity: row.total_capacity, currentPassengers: row.current_passengers,
            isVisible: row.is_visible, currentLat: row.current_lat, currentLng: row.current_lng,
            price: row.price, speed: row.speed,
        };
    }

    // ── Route Waypoints ────────────────────────────────────
    async getRouteWaypoints(busId: string): Promise<RouteWaypoint[]> {
        const { rows } = await this.pool.query(
            `SELECT * FROM route_waypoints WHERE bus_id = $1 ORDER BY order_index`, [busId]
        );
        return rows.map(this.mapWaypoint);
    }

    async getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>> {
        const { rows } = await this.pool.query(`SELECT * FROM route_waypoints ORDER BY order_index`);
        const result: Record<string, RouteWaypoint[]> = {};
        for (const row of rows) {
            const wp = this.mapWaypoint(row);
            if (!result[wp.busId]) result[wp.busId] = [];
            result[wp.busId].push(wp);
        }
        return result;
    }

    async createRouteWaypoint(insertWaypoint: InsertRouteWaypoint): Promise<RouteWaypoint> {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO route_waypoints (id, bus_id, lat, lng, order_index, name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [id, insertWaypoint.busId, insertWaypoint.lat, insertWaypoint.lng, insertWaypoint.orderIndex, insertWaypoint.name ?? null]
        );
        return this.mapWaypoint(rows[0]);
    }

    async deleteRouteWaypoints(busId: string): Promise<void> {
        await this.pool.query(`DELETE FROM route_waypoints WHERE bus_id = $1`, [busId]);
    }

    private mapWaypoint(row: any): RouteWaypoint {
        return { id: row.id, busId: row.bus_id, lat: row.lat, lng: row.lng, orderIndex: row.order_index, name: row.name };
    }

    // ── Reservations ───────────────────────────────────────
    async getReservation(id: string): Promise<Reservation | undefined> {
        const { rows } = await this.pool.query(`SELECT * FROM reservations WHERE id = $1`, [id]);
        return rows[0] ? this.mapReservation(rows[0]) : undefined;
    }

    async getReservationsByUser(userId: string): Promise<(Reservation & { bus?: Bus })[]> {
        const { rows } = await this.pool.query(
            `SELECT r.*, b.id as b_id, b.driver_id, b.plate_number, b.route_name, b.route_name_en,
             b.governorate, b.destination_governorate, b.total_capacity, b.current_passengers,
             b.is_visible, b.current_lat, b.current_lng, b.price, b.speed
             FROM reservations r LEFT JOIN buses b ON r.bus_id = b.id
             WHERE r.passenger_id = $1 ORDER BY r.created_at DESC`, [userId]
        );
        return rows.map(row => ({
            ...this.mapReservation(row),
            bus: row.b_id ? this.mapBus({ ...row, id: row.b_id }) : undefined,
        }));
    }

    async getActiveReservationByUser(userId: string): Promise<Reservation | undefined> {
        const { rows } = await this.pool.query(
            `SELECT * FROM reservations WHERE passenger_id = $1 AND status IN ('pending','confirmed') LIMIT 1`, [userId]
        );
        return rows[0] ? this.mapReservation(rows[0]) : undefined;
    }

    async getReservationsByBus(busId: string): Promise<Reservation[]> {
        const { rows } = await this.pool.query(
            `SELECT * FROM reservations WHERE bus_id = $1 AND status IN ('pending','confirmed') ORDER BY priority`, [busId]
        );
        return rows.map(this.mapReservation);
    }

    async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO reservations (id, passenger_id, bus_id, pickup_lat, pickup_lng, status, priority)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [
                id, insertReservation.passengerId, insertReservation.busId,
                insertReservation.pickupLat, insertReservation.pickupLng,
                insertReservation.status ?? "pending", insertReservation.priority ?? 1,
            ]
        );
        return this.mapReservation(rows[0]);
    }

    async updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation | undefined> {
        const fields: string[] = [];
        const values: any[] = [];
        let i = 1;
        if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
        if (fields.length === 0) return this.getReservation(id);
        values.push(id);
        const { rows } = await this.pool.query(
            `UPDATE reservations SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values
        );
        return rows[0] ? this.mapReservation(rows[0]) : undefined;
    }

    async getNextPriority(busId: string): Promise<number> {
        const { rows } = await this.pool.query(
            `SELECT MAX(priority) as max_p FROM reservations WHERE bus_id = $1 AND status IN ('pending','confirmed')`, [busId]
        );
        return (rows[0]?.max_p ?? 0) + 1;
    }

    private mapReservation(row: any): Reservation {
        return {
            id: row.id, passengerId: row.passenger_id, busId: row.bus_id,
            pickupLat: row.pickup_lat, pickupLng: row.pickup_lng,
            status: row.status, priority: row.priority, createdAt: row.created_at,
        };
    }

    // ── Issue Reports ──────────────────────────────────────
    async createIssueReport(insertReport: InsertIssueReport): Promise<IssueReport> {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO issue_reports (id, reporter_id, bus_id, description, status)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [
                id,
                (insertReport as any).reporterId ?? null,
                (insertReport as any).busId ?? null,
                (insertReport as any).description ?? "",
                insertReport.status ?? "pending",
            ]
        );
        return this.mapIssueReport(rows[0]);
    }

    async getIssueReports(): Promise<IssueReport[]> {
        const { rows } = await this.pool.query(`SELECT * FROM issue_reports ORDER BY created_at DESC`);
        return rows.map(this.mapIssueReport);
    }

    private mapIssueReport(row: any): IssueReport {
        return {
            id: row.id, reporterId: row.reporter_id, busId: row.bus_id,
            description: row.description, status: row.status, createdAt: row.created_at,
        } as any;
    }

    // ── Citizen Locations (in-memory, real-time only) ──────
    setCitizenLocation(userId: string, loc: CitizenLocation): void {
        this.citizenLocations.set(userId, loc);
    }

    getCitizenLocation(userId: string): CitizenLocation | undefined {
        return this.citizenLocations.get(userId);
    }

    async getCitizenLocationsForBus(busId: string): Promise<{ userId: string; name: string; lat: number; lng: number }[]> {
        const reservations = await this.getReservationsByBus(busId);
        const results: { userId: string; name: string; lat: number; lng: number }[] = [];
        for (const res of reservations) {
            const loc = this.citizenLocations.get(res.passengerId);
            if (loc && Date.now() - loc.timestamp < 60000) {
                const user = await this.getUser(res.passengerId);
                results.push({ userId: res.passengerId, name: user?.fullName ?? "راكب", lat: loc.lat, lng: loc.lng });
            }
        }
        return results;
    }
}

// ============================================================
// MemStorage (Fallback للتطوير المحلي)
// ============================================================
export class MemStorage implements IStorage {
    private users: Map<string, User>;
    private buses: Map<string, Bus>;
    private routeWaypoints: Map<string, RouteWaypoint>;
    private reservations: Map<string, Reservation>;
    private issueReports: Map<string, IssueReport>;
    private citizenLocations: Map<string, CitizenLocation>;
    private busLastUpdate: Map<string, { lat: number; lng: number; time: number }>;

    constructor() {
        this.users = new Map();
        this.buses = new Map();
        this.routeWaypoints = new Map();
        this.reservations = new Map();
        this.issueReports = new Map();
        this.citizenLocations = new Map();
        this.busLastUpdate = new Map();
        this.seedData();
    }

    private seedData() {
        const driverId = randomUUID();
        this.users.set(driverId, { id: driverId, username: "driver1", password: "123456", fullName: "أحمد محمد", phone: "0791234567", role: "driver", nationalId: "1234567890", licenseNumber: "DL-12345" });

        const citizenId = randomUUID();
        this.users.set(citizenId, { id: citizenId, username: "user1", password: "123456", fullName: "سارة أحمد", phone: "0797654321", role: "citizen", nationalId: "0987654321", licenseNumber: null });

        const addBus = (plate: string, route: string, routeEn: string, gov: string, dest: string, cap: number, pass: number, lat: number, lng: number, price: number) => {
            const id = randomUUID();
            this.buses.set(id, { id, driverId: randomUUID(), plateNumber: plate, routeName: route, routeNameEn: routeEn, governorate: gov, destinationGovernorate: dest, totalCapacity: cap, currentPassengers: pass, isVisible: true, currentLat: lat, currentLng: lng, price, speed: null });
        };
        addBus("23-45678", "عمان - إربد", "Amman - Irbid", "amman", "irbid", 20, 5, 32.0, 35.85, 1.25);
        addBus("34-56789", "عمان - العقبة", "Amman - Aqaba", "amman", "aqaba", 25, 22, 31.85, 35.95, 3.0);
        addBus("45-67890", "إربد - عجلون", "Irbid - Ajloun", "irbid", "ajloun", 12, 3, 32.55, 35.85, 0.75);
        addBus("56-78901", "الزرقاء - المفرق", "Zarqa - Mafraq", "zarqa", "mafraq", 18, 10, 32.07, 36.1, 1.0);
    }

    async getUser(id: string) { return this.users.get(id); }
    async getUserByUsername(username: string) { return Array.from(this.users.values()).find(u => u.username === username); }
    async createUser(insertUser: InsertUser): Promise<User> {
        const id = randomUUID();
        const user: User = { ...insertUser, id, role: insertUser.role ?? "citizen", nationalId: insertUser.nationalId ?? null, licenseNumber: (insertUser as any).licenseNumber ?? null };
        this.users.set(id, user);
        return user;
    }

    async getBus(id: string) { return this.buses.get(id); }
    async getBusByDriver(driverId: string) { return Array.from(this.buses.values()).find(b => b.driverId === driverId); }
    async getAllBuses() { return Array.from(this.buses.values()); }
    async getVisibleBuses() { return Array.from(this.buses.values()).filter(b => b.isVisible); }
    async createBus(insertBus: InsertBus): Promise<Bus> {
        const id = randomUUID();
        const bus: Bus = { ...insertBus, id, routeNameEn: insertBus.routeNameEn ?? null, governorate: insertBus.governorate ?? null, destinationGovernorate: insertBus.destinationGovernorate ?? null, totalCapacity: insertBus.totalCapacity ?? 15, currentPassengers: insertBus.currentPassengers ?? 0, isVisible: insertBus.isVisible ?? true, currentLat: insertBus.currentLat ?? 31.9539, currentLng: insertBus.currentLng ?? 35.9106, price: insertBus.price ?? null, speed: null };
        this.buses.set(id, bus);
        return bus;
    }

    calculateSpeed(busId: string, newLat: number, newLng: number): number | null {
        const prev = this.busLastUpdate.get(busId); const now = Date.now();
        if (!prev) { this.busLastUpdate.set(busId, { lat: newLat, lng: newLng, time: now }); return null; }
        const timeDiffSec = (now - prev.time) / 1000; if (timeDiffSec < 3) return null;
        const R = 6371000; const dLat = ((newLat - prev.lat) * Math.PI) / 180; const dLng = ((newLng - prev.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((prev.lat * Math.PI) / 180) * Math.cos((newLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const distMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        this.busLastUpdate.set(busId, { lat: newLat, lng: newLng, time: now });
        return Math.round((distMeters / timeDiffSec) * 3.6);
    }

    async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | undefined> {
        const bus = this.buses.get(id); if (!bus) return undefined;
        if (updates.currentLat != null && updates.currentLng != null) { const speed = this.calculateSpeed(id, updates.currentLat, updates.currentLng); if (speed !== null && speed < 200) updates.speed = speed; }
        const updatedBus = { ...bus, ...updates }; this.buses.set(id, updatedBus); return updatedBus;
    }

    async getRouteWaypoints(busId: string) { return Array.from(this.routeWaypoints.values()).filter(wp => wp.busId === busId).sort((a, b) => a.orderIndex - b.orderIndex); }
    async getAllRouteWaypoints(): Promise<Record<string, RouteWaypoint[]>> {
        const result: Record<string, RouteWaypoint[]> = {};
        for (const wp of Array.from(this.routeWaypoints.values())) { if (!result[wp.busId]) result[wp.busId] = []; result[wp.busId].push(wp); }
        for (const busId of Object.keys(result)) result[busId].sort((a, b) => a.orderIndex - b.orderIndex);
        return result;
    }
    async createRouteWaypoint(insertWaypoint: InsertRouteWaypoint): Promise<RouteWaypoint> {
        const id = randomUUID(); const waypoint: RouteWaypoint = { ...insertWaypoint, id, name: insertWaypoint.name || null };
        this.routeWaypoints.set(id, waypoint); return waypoint;
    }
    async deleteRouteWaypoints(busId: string) { for (const [id, wp] of Array.from(this.routeWaypoints.entries())) { if (wp.busId === busId) this.routeWaypoints.delete(id); } }

    async getReservation(id: string) { return this.reservations.get(id); }
    async getReservationsByUser(userId: string): Promise<(Reservation & { bus?: Bus })[]> {
        return Array.from(this.reservations.values()).filter(r => r.passengerId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(r => ({ ...r, bus: this.buses.get(r.busId) }));
    }
    async getActiveReservationByUser(userId: string) { return Array.from(this.reservations.values()).find(r => r.passengerId === userId && (r.status === "pending" || r.status === "confirmed")); }
    async getReservationsByBus(busId: string) { return Array.from(this.reservations.values()).filter(r => r.busId === busId && (r.status === "pending" || r.status === "confirmed")).sort((a, b) => a.priority - b.priority); }
    async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
        const id = randomUUID(); const reservation: Reservation = { ...insertReservation, id, status: insertReservation.status ?? "pending", createdAt: new Date() };
        this.reservations.set(id, reservation); return reservation;
    }
    async updateReservation(id: string, updates: Partial<Reservation>): Promise<Reservation | undefined> {
        const reservation = this.reservations.get(id); if (!reservation) return undefined;
        const updated = { ...reservation, ...updates }; this.reservations.set(id, updated); return updated;
    }
    async getNextPriority(busId: string): Promise<number> {
        const reservations = await this.getReservationsByBus(busId); if (reservations.length === 0) return 1;
        return Math.max(...reservations.map(r => r.priority)) + 1;
    }

    async createIssueReport(insertReport: InsertIssueReport): Promise<IssueReport> {
        const id = randomUUID(); const report: IssueReport = { ...insertReport, id, status: insertReport.status ?? "pending", createdAt: new Date() } as any;
        this.issueReports.set(id, report); return report;
    }
    async getIssueReports(): Promise<IssueReport[]> { return Array.from(this.issueReports.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }

    setCitizenLocation(userId: string, loc: CitizenLocation) { this.citizenLocations.set(userId, loc); }
    getCitizenLocation(userId: string) { return this.citizenLocations.get(userId); }
    async getCitizenLocationsForBus(busId: string): Promise<{ userId: string; name: string; lat: number; lng: number }[]> {
        const activeReservations = Array.from(this.reservations.values()).filter(r => r.busId === busId && (r.status === "pending" || r.status === "confirmed"));
        const results: { userId: string; name: string; lat: number; lng: number }[] = [];
        for (const res of activeReservations) {
            const loc = this.citizenLocations.get(res.passengerId);
            if (loc && Date.now() - loc.timestamp < 60000) {
                const user = this.users.get(res.passengerId);
                results.push({ userId: res.passengerId, name: user?.fullName ?? "راكب", lat: loc.lat, lng: loc.lng });
            }
        }
        return results;
    }
}

// ============================================================
// تصدير الـ Storage المناسب بناءً على DATABASE_URL
// ============================================================
export const storage: IStorage = process.env.DATABASE_URL
    ? new PgStorage(process.env.DATABASE_URL)
    : new MemStorage();

console.log(process.env.DATABASE_URL
    ? "🗄️  Using PostgreSQL storage (Render)"
    : "💾  Using in-memory storage (local dev)"
);