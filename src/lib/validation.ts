export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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