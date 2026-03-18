import requestIp from 'request-ip';

/**
 * Extract device/IP info from the request object.
 * Used by authController for login alerts.
 */
export const getUserDeviceInfo = (req) => {
  const ip = requestIp.getClientIp(req) || req.ip || 'Unknown';
  const ua = req.headers['user-agent'] || 'Unknown';

  return {
    ip,
    userAgent: ua
  };
};