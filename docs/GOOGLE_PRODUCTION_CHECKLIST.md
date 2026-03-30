# Google Production Checklist

This project currently uses Google OAuth to connect hidden Google accounts behind member vaults.

## What changed in the app

- One hidden Google account is now treated as one full Google account.
- The app no longer asks admin to choose `drive` or `mail`.
- The app no longer asks admin to type quota values manually.
- Real quota and mailbox data are fetched from Google after OAuth and sync.

## Testing mode vs production mode

In `Testing` mode:

- only listed test users can authorize
- Google shows the unverified app warning
- refresh tokens can expire in 7 days

In `In production` mode:

- broader use is possible
- but sensitive-scope verification is usually required for Gmail and Drive data access

## Current scopes used by this app

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive.metadata.readonly`
- `https://www.googleapis.com/auth/gmail.readonly`

## Production steps

1. Create a separate Google Cloud project for production.
2. Enable the Google Drive API.
3. Enable the Gmail API.
4. Configure the OAuth consent screen with real branding.
5. Add your production home page.
6. Add your privacy policy URL.
7. Add your terms of service URL if available.
8. Verify every domain used by:
   - home page
   - privacy policy
   - authorized redirect URIs
   - authorized JavaScript origins
9. Keep the scope list minimal and accurate.
10. Move the app publishing status to `In production`.
11. Submit the OAuth app for sensitive-scope verification.
12. Prepare a demo video that shows:
   - where the scopes are used
   - how a hidden Google account is connected
   - how the user sees aggregated data in the vault
13. Explain in the verification submission why Gmail and Drive access are needed.
14. Make sure the app UI clearly tells users what data is accessed and why.

## Important policy note

Because this app uses Gmail and Drive OAuth scopes, long-term production use may require Google verification before broad public use.

Official references:

- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://support.google.com/cloud/answer/15549945
