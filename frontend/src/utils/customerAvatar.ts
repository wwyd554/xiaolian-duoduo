const DEFAULT_CUSTOMER_AVATAR = "/avatars/customer-cartoon-v1.webp";
const DEFAULT_CUSTOMER_AVATAR_LARGE = "/avatars/customer-cartoon-v1-320w.webp";

/** One customer portrait source across scenario cards, practice, and review. */
export function customerAvatar(
  name?: string,
  avatar?: string,
  size: "small" | "large" = "small",
): string {
  if (
    avatar &&
    (/^(https?:|data:image\/|\/)/.test(avatar) ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(avatar))
  ) {
    return avatar;
  }
  if (name === "林嘉诚") return "/avatars/lin-jiacheng-cartoon-v2-340w.webp";
  return size === "large"
    ? DEFAULT_CUSTOMER_AVATAR_LARGE
    : DEFAULT_CUSTOMER_AVATAR;
}
