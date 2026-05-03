// Authenticated fetch utility for API calls

export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('authToken');

    const headers: HeadersInit = {
        ...options.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        console.log(`[AuthFetch] Token attached for ${url}`);
    } else {
        console.warn(`[AuthFetch] NO TOKEN found in localStorage for ${url}`);
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s Timeout

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

// Helper for JSON requests
export const authFetchJson = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const response = await authFetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || response.statusText);
    }

    return response.json();
};
