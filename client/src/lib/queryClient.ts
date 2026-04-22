import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * 👈 هذا هو الرابط الذي ظهر في صورتك الأخيرة (رابط السيرفر)
 * نستخدمه هنا ليربط الموبايل بالسيرفر مباشرة
 */
const API_BASE_URL = "https://bus-p4kg.onrender.com";

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
    // إصلاح الرابط هنا لتجنب التكرار
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

    const res = await fetch(fullUrl, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
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

            // 🔥 هنا كان الخطأ (تم إزالة /api/ المكررة وإصلاح دمج الرابط)
            const fullUrl = urlPath.startsWith("http") ? urlPath : `${API_BASE_URL}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;

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