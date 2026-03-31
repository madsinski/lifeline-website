# Custom Email Setup for Lifeline Health

This guide covers how to send auth emails (sign-up confirmation, password reset, magic links) from a custom Lifeline domain instead of the default Supabase address.

## 1. Setting up Custom SMTP in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Settings** (gear icon) -> **Authentication** -> **SMTP Settings**
3. Toggle **Enable Custom SMTP** on
4. Fill in the SMTP details from your chosen provider:
   - **Sender email**: `no-reply@lifeline.is` (or `hello@lifeline.is`)
   - **Sender name**: `Lifeline Health`
   - **Host**: (from your SMTP provider)
   - **Port**: `587` (TLS) or `465` (SSL)
   - **Username**: (from your SMTP provider)
   - **Password**: (from your SMTP provider)
5. Click **Save**
6. Send a test email to verify it works

## 2. Recommended SMTP Providers

Any of these work well for transactional email from Iceland:

### Postmark (recommended)
- Website: https://postmarkapp.com
- Pricing: 10,000 emails/month for $15
- Pros: Best deliverability, fast delivery, simple setup
- Setup: Create account -> Add domain -> Verify DNS (DKIM, SPF) -> Get SMTP credentials

### SendGrid
- Website: https://sendgrid.com
- Pricing: Free tier (100 emails/day), paid from $19.95/month
- Pros: Free tier available, well-documented API
- Setup: Create account -> Authenticate domain -> Get API key -> Use as SMTP password

### Amazon SES
- Website: https://aws.amazon.com/ses/
- Pricing: $0.10 per 1,000 emails (very cheap)
- Pros: Cheapest option at scale
- Cons: More complex setup (AWS account required)
- Setup: AWS Console -> SES -> Verify domain -> Request production access -> Get SMTP credentials

### Resend
- Website: https://resend.com
- Pricing: Free (100 emails/day), paid from $20/month
- Pros: Modern API, good developer experience
- Setup: Create account -> Add domain -> Verify DNS -> Get API key

## 3. DNS Configuration

Regardless of provider, you need to add these DNS records for `lifeline.is`:

- **SPF record**: TXT record allowing the SMTP provider to send on your behalf
- **DKIM record**: TXT/CNAME record for email signing
- **DMARC record**: TXT record for email policy (optional but recommended)

Example (varies by provider):
```
lifeline.is    TXT    "v=spf1 include:_spf.postmarkapp.com ~all"
```

## 4. Email Template Customization

1. Go to Supabase dashboard -> **Authentication** -> **Email Templates**
2. You can customize these templates:
   - **Confirm signup**
   - **Invite user**
   - **Magic link**
   - **Change email address**
   - **Reset password**

### Example: Confirm Signup Template

Subject: `Welcome to Lifeline Health - Confirm your email`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ecf0f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecf0f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1F2937 0%, #111827 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #20c858; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                Lifeline Health
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1F2937; font-size: 20px; font-weight: 600;">
                Welcome to Lifeline
              </h2>
              <p style="margin: 0 0 24px; color: #6B7280; font-size: 15px; line-height: 1.6;">
                Thank you for creating your account. Please confirm your email address by clicking the button below.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display: inline-block; padding: 14px 32px; background-color: #20c858; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 12px rgba(32,200,88,0.3);">
                      Confirm email address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #9CA3AF; font-size: 13px; line-height: 1.5;">
                If you did not create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                Lifeline Health ehf. &middot; Lagmula 5, 108 Reykjavik, Iceland
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Example: Password Reset Template

Subject: `Reset your Lifeline password`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ecf0f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecf0f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1F2937 0%, #111827 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #20c858; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                Lifeline Health
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1F2937; font-size: 20px; font-weight: 600;">
                Reset your password
              </h2>
              <p style="margin: 0 0 24px; color: #6B7280; font-size: 15px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display: inline-block; padding: 14px 32px; background-color: #20c858; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 12px rgba(32,200,88,0.3);">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #9CA3AF; font-size: 13px; line-height: 1.5;">
                If you did not request a password reset, you can safely ignore this email. This link will expire in 24 hours.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                Lifeline Health ehf. &middot; Lagmula 5, 108 Reykjavik, Iceland
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Example: Magic Link Template

Subject: `Your Lifeline login link`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #ecf0f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecf0f3; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #1F2937 0%, #111827 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #20c858; font-size: 24px; font-weight: 700;">Lifeline Health</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1F2937; font-size: 20px; font-weight: 600;">Sign in to Lifeline</h2>
              <p style="margin: 0 0 24px; color: #6B7280; font-size: 15px; line-height: 1.6;">
                Click the button below to sign in to your account. This link expires in 1 hour.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display: inline-block; padding: 14px 32px; background-color: #20c858; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 12px rgba(32,200,88,0.3);">
                      Sign in
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #9CA3AF; font-size: 13px;">
                If you did not request this link, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                Lifeline Health ehf. &middot; Lagmula 5, 108 Reykjavik, Iceland
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## 5. Testing

After configuring SMTP and templates:

1. Create a test account on the website to verify the confirmation email
2. Use the "Forgot password" flow to test the reset email
3. Check spam folders if emails don't arrive
4. Verify the "From" address shows as `Lifeline Health <no-reply@lifeline.is>`

## 6. Important Notes

- Custom SMTP requires a paid Supabase plan (Pro or above)
- DNS changes (SPF, DKIM) can take up to 48 hours to propagate
- Always test with multiple email providers (Gmail, Outlook, etc.)
- Monitor your SMTP provider's dashboard for bounce rates and delivery issues
