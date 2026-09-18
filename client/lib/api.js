// Keep this existing variable name so current deployments do not need a rename.
const configuredBackendUrl =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
const environment = process.env.NODE_ENV;

export function resolveBackendUrl(configuredUrl, mode, pageUrl = "") {
  const value =
    configuredUrl.trim().replace(/\/+$/, "") ||
    (mode === "development" ? "http://localhost:8000" : "");
  if (!value)
    throw new Error(
      "API configuration missing. Set NEXT_PUBLIC_API_URL on the frontend platform, then rebuild and redeploy.",
    );
  let backendUrl;
  try {
    backendUrl = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a full http(s) backend URL.");
  }
  if (
    !["http:", "https:"].includes(backendUrl.protocol) ||
    backendUrl.username ||
    backendUrl.password ||
    backendUrl.search ||
    backendUrl.hash ||
    backendUrl.pathname !== "/"
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be the backend origin only, without /api, credentials, query parameters or fragments.",
    );
  }
  if (pageUrl) {
    const page = new URL(pageUrl);
    const localHosts = ["localhost", "127.0.0.1", "[::1]"];
    if (
      !localHosts.includes(page.hostname) &&
      localHosts.includes(backendUrl.hostname)
    ) {
      throw new Error(
        "This deployed frontend was built with a localhost API URL. Set NEXT_PUBLIC_API_URL to the deployed backend and rebuild.",
      );
    }
    if (page.protocol === "https:" && backendUrl.protocol !== "https:") {
      throw new Error(
        "An HTTPS frontend requires an HTTPS backend. Update NEXT_PUBLIC_API_URL and rebuild.",
      );
    }
  }
  return backendUrl.origin;
}

export function getApiUrl(path) {
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  return resolveBackendUrl(configuredBackendUrl, environment, pageUrl) + path;
}

export async function requestApi(path, requestBody) {
  const url = getApiUrl(path);
  let response;
  try {
    response = await fetch(url, {
      ...(requestBody
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        : {}),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (error.name === "TimeoutError")
      throw new Error(
        "Backend request timed out. A sleeping deployment may need a moment to start; retry the connection.",
      );
    throw new Error(
      "Network or CORS error contacting " +
        new URL(url).origin +
        ". Check backend availability and its allowed frontend origins.",
    );
  }
  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    throw new Error(
      "Backend returned " +
        response.status +
        " with a non-JSON response. Check the API URL, deployment and proxy routing.",
    );
  }
  if (!response.ok) {
    const detail =
      typeof responseData.detail === "string"
        ? responseData.detail
        : "Check the request and backend logs.";
    const category =
      response.status === 401
        ? "Authentication failed"
        : response.status === 403
          ? "Access denied"
          : response.status >= 500
            ? "Backend server error"
            : "Request rejected";
    const error = new Error(
      category + " (HTTP " + response.status + "): " + detail,
    );
    error.status = response.status;
    throw error;
  }
  return responseData;
}

export function subscribeToRun(runId, onAgentEvent, onConnectionChange) {
  const eventSource = new EventSource(
    getApiUrl("/api/runs/" + runId + "/events"),
  );
  eventSource.onopen = () => onConnectionChange("Live");
  eventSource.onmessage = (message) => {
    try {
      const agentEvent = JSON.parse(message.data);
      onAgentEvent(agentEvent);
      if (
        ["completed", "cancelled", "failed"].includes(agentEvent.state.status)
      ) {
        eventSource.close();
        onConnectionChange("Finished");
      }
    } catch {
      eventSource.close();
      onConnectionChange("Invalid stream response. Reload to reconnect.");
    }
  };
  eventSource.onerror = () => onConnectionChange("Reconnecting…");
  return () => eventSource.close();
}
