export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function requestApi(path, requestBody) {
  let response;
  try {
    response = await fetch(API_BASE_URL + path, requestBody ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    } : {});
  } catch {
    throw new Error("Could not reach FastAPI. Start the backend on port 8000.");
  }
  const responseData = await response.json();
  if (!response.ok) {
    throw new Error(typeof responseData.detail === "string" ? responseData.detail : "Check your repository URL and issue.");
  }
  return responseData;
}
