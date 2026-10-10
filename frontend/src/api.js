export function createApi(getSession, onUnauthorized) {
  return async function api(path, method = 'GET', body) {
    const session = getSession();
    const response = await fetch('/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(session && { Authorization: 'Bearer ' + session.token }),
      },
      body: body && JSON.stringify(body),
    });
    const json = await response.json();
    if (response.status === 401 && session) onUnauthorized();
    if (!json.success) throw new Error(json.message || 'Error');
    return json.data;
  };
}
