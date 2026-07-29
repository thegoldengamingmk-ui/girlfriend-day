/**
 * Email Service Module
 * Separates authentication logic from email delivery mechanics.
 * Supports Supabase Auth default mailer as well as custom SMTP providers (Brevo, Resend, etc.).
 */

import { supabase } from "./supabase"

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  templateId?: string
}

export class EmailService {
  private static instance: EmailService
  private provider: "supabase" | "custom" = "supabase"

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  /**
   * Send verification email or OTP via current configured provider
   */
  public async sendVerificationOtp(email: string): Promise<boolean> {
    if (this.provider === "supabase") {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      })
      if (error) {
        // Fall back to resend signup email if user was created via signUp
        const { error: resendErr } = await supabase.auth.resend({
          type: "signup",
          email: email.trim(),
        })
        if (resendErr) throw resendErr
      }
      return true
    }

    // Custom SMTP hook (Brevo / Resend adapter placeholder for future scalability)
    return true
  }

  /**
   * Send withdrawal confirmation OTP email
   */
  public async sendWithdrawalOtp(email: string): Promise<boolean> {
    if (this.provider === "supabase") {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      })
      if (error) throw error
      return true
    }

    return true
  }

  /**
   * Send password reset email
   */
  public async sendPasswordReset(email: string): Promise<boolean> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) throw error
    return true
  }
}

export const emailService = EmailService.getInstance()
