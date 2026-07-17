import { z } from "zod";

const COMMON_PASSWORDS = ["password123", "qwerty123456", "letmein123456", "admin123456", "welcome123"];

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

export const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .refine(
      (val) => !COMMON_PASSWORDS.includes(val.toLowerCase()),
      "This password is too common. Please choose a stronger password."
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .refine(
      (val) => !COMMON_PASSWORDS.includes(val.toLowerCase()),
      "This password is too common."
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(12, "New password must be at least 12 characters")
    .refine(
      (val) => !COMMON_PASSWORDS.includes(val.toLowerCase()),
      "This password is too common."
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must contain only digits"),
});

export const inviteEmployeeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum([
    "administrator",
    "operations_manager",
    "office_manager",
    "estimator",
    "crew_leader",
    "crew_member",
    "snow_operations_manager",
    "inventory_manager",
    "bookkeeper",
    "read_only",
  ]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
