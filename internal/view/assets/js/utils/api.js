// Handles API responses in both legacy and new message formats
export async function handleApiResponse(response) {
	if (!response.ok) throw response;

	// Return early for 204 No Content responses
	if (response.status === 204) {
		return null;
	}

	const contentType = response.headers.get("Content-Type");
	if (!contentType || !contentType.includes("application/json")) {
		return response;
	}

	const data = await response.json();

	// Check if response is in the new message format
	if (data && typeof data === "object" && "ok" in data && "message" in data) {
		if (!data.ok) {
			throw new Error(data.message?.error || "Unknown error");
		}
		return data.message;
	}

	// Legacy format - return as is
	return data;
}

// Handles API errors and returns a user-friendly error message
export async function handleApiError(error) {
	if (error instanceof Response) {
		const data = await error.json();

		if (data && typeof data === "object" && "error" in data) {
			return data.error;
		} else if (
			data &&
			typeof data === "object" &&
			"message" in data &&
			"error" in data.message
		) {
			return data.message.error;
		} else {
			return error.statusText;
		}
	}

	return "Unknown error occurred";
}

function parseJWT(token) {
	try {
		return JSON.parse(atob(token.split(".")[1]));
	} catch (e) {
		return null;
	}
}

let refreshPromise = null;

// Makes an API request with proper error handling
export async function apiRequest(url, options = {}) {
	const urlString = url.toString();
	const isAuthRequest =
		urlString.includes("auth/refresh") ||
		urlString.includes("auth/login") ||
		urlString.includes("auth/logout");

	if (!isAuthRequest) {
		const token = localStorage.getItem("shiori-token");
		if (token) {
			const claims = parseJWT(token);
			if (claims && claims.exp) {
				const timeRemaining = claims.exp * 1000 - Date.now();
				const threshold =
					localStorage.getItem("shiori-remember-me") === "true"
						? 24 * 60 * 60 * 1000 // 1 day
						: 10 * 60 * 1000; // 10 minutes

				if (timeRemaining > 0 && timeRemaining < threshold) {
					if (!refreshPromise) {
						refreshPromise = (async () => {
							try {
								const json = await apiRequest(
									new URL("api/v1/auth/refresh", document.baseURI),
									{ method: "POST" }
								);
								document.cookie = `token=${json.token}; Path=${
									new URL(document.baseURI).pathname
								}; Expires=${new Date(json.expires * 1000).toUTCString()}`;
								localStorage.setItem("shiori-token", json.token);
								localStorage.setItem(
									"shiori-account",
									JSON.stringify(parseJWT(json.token).account)
								);
							} catch (err) {
								console.error("Auto token refresh failed:", err);
							} finally {
								refreshPromise = null;
							}
						})();
					}
					await refreshPromise;
				}
			}
		}
	}

	try {
		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer " + localStorage.getItem("shiori-token"),
				...(options.headers || {}),
			},
		});

		return await handleApiResponse(response);
	} catch (error) {
		throw new Error(await handleApiError(error));
	}
}
