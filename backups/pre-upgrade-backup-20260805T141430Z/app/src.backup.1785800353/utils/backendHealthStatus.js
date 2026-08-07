export function resolveBackendStatus(payload, isError = false) {
  if (isError) {
    return 'Backend Offline — Local Fallback';
  }

  if (payload?.healthy === true || payload?.status === 'ok' || payload?.status === 'healthy') {
    return 'Backend Healthy';
  }

  return 'Backend Unhealthy';
}
