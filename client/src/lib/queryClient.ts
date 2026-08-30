import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const buildApiUrl = (path: string) => {
    if (path.startsWith("http")) return path;
    return API_BASE_URL ? `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}` : path;
};
let csrfTokenCache: string | null = null;

async function getCsrfToken() {
    if (csrfTokenCache) return csrfTokenCache;
    const response = await fetch(buildApiUrl("/api/auth/csrf-token"), {
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error("Failed to get CSRF token");
    }
    const data = await response.json();
    csrfTokenCache = data.csrfToken;
    return csrfTokenCache;
}

async function throwIfResNotOk(res: Response) {
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
    }
}

export async function apiRequest(
    method: string,
    url: string,
    data?: unknown | undefined,
): Promise<Response> {
    const fullUrl = buildApiUrl(url);
    const shouldAttachCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
    const csrfToken = shouldAttachCsrf ? await getCsrfToken() : null;

    const res = await fetch(fullUrl, {
        method,
        headers: {
            ...(data ? { "Content-Type": "application/json" } : {}),
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include", // مهم جداً لبقاء المستخدم مسجل دخول
    });

    await throwIfResNotOk(res);
    return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
    on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
    ({ on401: unauthorizedBehavior }) =>
        async ({ queryKey }) => {
            const urlPath = queryKey.join("/") as string;

            const fullUrl = buildApiUrl(urlPath);

            const res = await fetch(fullUrl, {
                credentials: "include",
            });

            if (unauthorizedBehavior === "returnNull" && res.status === 401) {
                return null;
            }

            await throwIfResNotOk(res);
            return await res.json();
        };

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            queryFn: getQueryFn({ on401: "throw" }),
            refetchInterval: 5000, // تحديث تلقائي كل 5 ثوانٍ لمراقبة حركة الباصات
            refetchOnWindowFocus: true,
            staleTime: 0,
            retry: false,
        },
        mutations: {
            retry: false,
        },
    },
});