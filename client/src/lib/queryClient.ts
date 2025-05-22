import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  options?: { isFormData?: boolean }
): Promise<Response> {
  console.log(`Making ${method} request to ${url}`, data);
  
  let fetchOptions: RequestInit = {
    method,
    credentials: "include",
  };

  if (data) {
    if (options?.isFormData) {
      // For FormData, don't set Content-Type header (browser will set it with boundary)
      fetchOptions.body = data as FormData;
    } else {
      // For JSON data
      fetchOptions.headers = { "Content-Type": "application/json" };
      fetchOptions.body = JSON.stringify(data);
    }
  }
  
  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    // Log more details about the error
    console.error(`API request failed with status ${res.status}:`, res.statusText);
    try {
      const errorBody = await res.clone().json();
      console.error("Error response body:", errorBody);
    } catch (e) {
      console.error("Could not parse error response as JSON");
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
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
