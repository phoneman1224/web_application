/**
 * Router Library
 * Simple URL routing with path parameters and HTTP method matching
 */

type RouteHandler = (
  request: Request,
  params: Record<string, string>,
  env: any,
  ctx: ExecutionContext
) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  /**
   * Register a GET route
   */
  get(path: string, handler: RouteHandler): this {
    this.addRoute('GET', path, handler);
    return this;
  }

  /**
   * Register a POST route
   */
  post(path: string, handler: RouteHandler): this {
    this.addRoute('POST', path, handler);
    return this;
  }

  /**
   * Register a PUT route
   */
  put(path: string, handler: RouteHandler): this {
    this.addRoute('PUT', path, handler);
    return this;
  }

  /**
   * Register a DELETE route
   */
  delete(path: string, handler: RouteHandler): this {
    this.addRoute('DELETE', path, handler);
    return this;
  }

  /**
   * Register a PATCH route
   */
  patch(path: string, handler: RouteHandler): this {
    this.addRoute('PATCH', path, handler);
    return this;
  }

  /**
   * Handle an incoming request
   */
  async handle(
    request: Request,
    env: any,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      const match = path.match(route.pattern);
      if (!match) {
        continue;
      }

      // Extract path parameters
      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = match[i + 1];
      }

      // Call handler
      try {
        return await route.handler(request, params, env, ctx);
      } catch (error: any) {
        console.error('Route handler error:', error);
        return this.errorResponse(error);
      }
    }

    // No route matched
    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Add a route with path parameter support
   */
  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];

    // Convert path pattern to regex
    // /api/items/:id -> /api/items/([^/]+)
    const patternString = path
      .replace(/:[^/]+/g, (match) => {
        const paramName = match.slice(1); // Remove ':'
        paramNames.push(paramName);
        return '([^/]+)';
      })
      .replace(/\//g, '\\/'); // Escape forward slashes

    const pattern = new RegExp(`^${patternString}$`);

    this.routes.push({
      method,
      pattern,
      paramNames,
      handler
    });
  }

  /**
   * Convert error to JSON response
   */
  private errorResponse(error: any): Response {
    let status = 500;
    let message = 'Internal Server Error';
    let details: any = undefined;

    if (error.name === 'ValidationError') {
      status = 400;
      message = error.message;
      details = error.details;
    } else if (error.name === 'NotFoundError') {
      status = 404;
      message = error.message;
    } else if (error.message) {
      message = error.message;
    }

    return new Response(
      JSON.stringify({ error: message, details }),
      {
        status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Helper: Parse JSON body from request
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

/**
 * Helper: Create JSON response
 */
export function jsonResponse(
  data: any,
  status: number = 200,
  headers?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
}

/**
 * Helper: Create success response (200)
 */
export function ok(data: any): Response {
  return jsonResponse(data, 200);
}

/**
 * Helper: Create created response (201)
 */
export function created(data: any): Response {
  return jsonResponse(data, 201);
}

/**
 * Helper: Create no content response (204)
 */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Helper: Create bad request response (400)
 */
export function badRequest(message: string, details?: any): Response {
  return jsonResponse({ error: message, details }, 400);
}

/**
 * Helper: Create unauthorized response (401)
 */
export function unauthorized(message: string = 'Unauthorized'): Response {
  return jsonResponse({ error: message }, 401);
}

/**
 * Helper: Create not found response (404)
 */
export function notFound(message: string = 'Not Found'): Response {
  return jsonResponse({ error: message }, 404);
}

/**
 * Helper: Create conflict response (409)
 */
export function conflict(message: string, details?: any): Response {
  return jsonResponse({ error: message, details }, 409);
}

/**
 * Helper: Create internal server error response (500)
 */
export function internalError(message: string = 'Internal Server Error'): Response {
  return jsonResponse({ error: message }, 500);
}

/**
 * Helper: Extract query parameters from request
 */
export function getQueryParams(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

/**
 * Helper: Generate UUID v4
 */
export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${randomPart}`;
}
