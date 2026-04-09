import { QueryClient, QueryFunction } from "@tanstack/react-query";

// 👈 الرابط الثابت لسيرفرك على Render (استبدله برابطك الحقيقي إذا كان مختلفاً)
const API_BASE_URL = "https://bus-app.onrender.com";

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
    // توجيه الطلب للسيرفر الحقيقي
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

    const res = await fetch(fullUrl, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include", // 👈 مهم جداً لبقاء تسجيل الدخول
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
            // توجيه جلب البيانات للسيرفر الحقيقي
            const urlPath = queryKey.join("/") as string;
            const fullUrl = urlPath.startsWith("http") ? urlPath : `${API_BASE_URL}/${urlPath}`;

            const res = await fetch(fullUrl, {
                credentials: "include", // 👈 مهم جداً لبقاء تسجيل الدخول
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
            refetchInterval: false,
            refetchOnWindowFocus: false,
            staleTime: Infinity,
            retry: false,
        },
        mutations: {
            retry: false,
        },
    },
});