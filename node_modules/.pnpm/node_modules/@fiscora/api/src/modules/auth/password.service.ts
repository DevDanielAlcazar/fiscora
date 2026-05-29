import { hash, verify } from "argon2";

export class PasswordService {
  static async hashPassword(password: string): Promise<string> {
    this.validatePassword(password);
    return await hash(password);
  }

  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    this.validatePassword(password);
    return await verify(hash, password);
  }

  private static validatePassword(password: string): void {
    if (!password || typeof password !== "string") {
      throw new Error("Password cannot be empty");
    }

    if (password.length < 12) {
      throw new Error("Password must be at least 12 characters long");
    }
  }
}
