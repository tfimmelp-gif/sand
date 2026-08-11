export function isValidSlug(slug: string) {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(slug);
}

export function generateSlug(length = 8) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let slug = "";

  for (let index = 0; index < length; index += 1) {
    slug += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return slug;
}

export function validateDestinationUrl(value: string) {
  const parsedDestination = new URL(value);

  if (!["http:", "https:"].includes(parsedDestination.protocol)) {
    throw new Error("Destination must use HTTP or HTTPS.");
  }

  return parsedDestination.toString();
}
