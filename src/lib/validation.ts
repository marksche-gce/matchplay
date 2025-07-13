export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUsername = (username: string): boolean => {
  // Username must be 3-20 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const validatePhone = (phone: string): boolean => {
  // Basic phone validation - accepts various formats
  const phoneRegex = /^[\+]?[0-9\s\-\(\)\.]{10,}$/;
  return phone.length === 0 || phoneRegex.test(phone);
};

export const validateHandicap = (handicap: number): boolean => {
  return handicap >= 0 && handicap <= 36;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};