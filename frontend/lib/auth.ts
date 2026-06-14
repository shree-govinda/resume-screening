export const getRole = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
};

export const isLoggedIn = (): boolean => !!localStorage.getItem("access_token");

export const logout = () => {
  localStorage.clear();
  window.location.href = "/login";
};

export const saveTokens = (access: string, refresh: string) => {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
  // Decode role from JWT payload
  try {
    const payload = JSON.parse(atob(access.split(".")[1]));
    localStorage.setItem("role", payload.role);
  } catch {}
};
