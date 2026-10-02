/**
 * Petit client JSON pour les points d'accès /api de l'application.
 * Le jeton CSRF est lu dans le cookie XSRF-TOKEN posé par Laravel.
 */
function csrfToken(): string | undefined {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
}

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

function headers(json: boolean): Record<string, string> {
    const token = csrfToken();
    return {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-XSRF-TOKEN': token } : {}),
    };
}

async function handle<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let message = `Erreur ${response.status}`;
        let errors: Record<string, string[]> = {};
        try {
            const data = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
            if (data.message) message = data.message;
            if (data.errors) errors = data.errors;
        } catch {
            /* réponse non JSON */
        }
        if (response.status === 419) message = 'Ta session a expiré. Recharge la page.';
        if (response.status === 429) message = 'Trop de requêtes. Patiente un instant.';
        throw new ApiError(response.status, message, errors);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { headers: headers(false), credentials: 'same-origin', signal });
    return handle<T>(response);
}

export async function sendJson<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown, options: { signal?: AbortSignal; keepalive?: boolean } = {}): Promise<T> {
    const response = await fetch(url, {
        method,
        headers: headers(true),
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
        keepalive: options.keepalive,
    });
    return handle<T>(response);
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return sendJson<T>('POST', url, body, { signal });
}
