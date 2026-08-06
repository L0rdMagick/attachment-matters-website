# Family Trust Therapy Portal - Non-Technical Owner Setup Guide

This guide is written specifically for the owner of Family Trust Therapy. It explains step-by-step how to set up, configure, and host your client management portal entirely under your own personal or business Google Account (`console.firebase.google.com`).

---

## Table of Contents
1. [Creating Your Google Cloud & Firebase Project](#1-creating-your-google-cloud--firebase-project)
2. [Firestore Location & Production Database Setup](#2-firestore-location--production-database-setup)
3. [Enabling Billing & Budget Alerts](#3-enabling-billing--budget-alerts)
4. [Configuring Firebase Authentication](#4-configuring-firebase-authentication)
5. [Upgrading Authentication & Enabling Staff MFA](#5-upgrading-authentication--enabling-staff-mfa)
6. [Cloud Storage & Security Rules](#6-cloud-storage--security-rules)
7. [Enabling Firebase App Check & Cloud Functions](#7-enabling-firebase-app-check--cloud-functions)
8. [Configuring Google Calendar API & OAuth 2.0](#8-configuring-google-calendar-api--oauth-20)
9. [Setting Up Environment Keys & Public Config](#9-setting-up-environment-keys--public-config)
10. [Onboarding the First Administrator & Therapist](#10-onboarding-the-first-administrator--therapist)
11. [Backups, Point-in-Time Recovery & Security Logs](#11-backups-point-in-time-recovery--security-logs)
12. [Accepting the Google Cloud HIPAA Business Associate Addendum (BAA)](#12-accepting-the-google-cloud-hipaa-business-associate-addendum-baa)
13. [Consumer Gmail Privacy vs. Google Workspace](#13-consumer-gmail-privacy-vs-google-workspace)
14. [Pre-Launch Technical & Legal Checklist](#14-pre-launch-technical--legal-checklist)

---

## 1. Creating Your Google Cloud & Firebase Project

1. Log in to your primary Google Account.
2. Navigate to the **[Firebase Console](https://console.firebase.google.com)**.
3. Click **Add project** (or **Create a project**).
4. Enter your project name: `family-trust-therapy-portal`.
5. Enable or disable Google Analytics based on your preference (ensure IP anonymization is enabled if activated).
6. Click **Create Project** and wait for provision completion.

---

## 2. Firestore Location & Production Database Setup

1. In the left navigation menu of the Firebase Console, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. **Database Location**: Choose a region close to your practice location (e.g., `nam5 (us-central)` or `us-south1`). *Note: Once selected, this location cannot be changed.*
4. **Security Rules**: Select **Start in production mode** (this enforces deny-by-default security rules).
5. Click **Enable**.

---

## 3. Enabling Billing & Budget Alerts

1. In Firebase Console, click the gear icon (⚙️) next to *Project Overview* and select **Project settings**.
2. Under the *General* tab, select **Modify plan** or **Upgrade** to the **Blaze (Pay as you go)** plan.
3. Link your credit card or payment method (Firebase includes generous free monthly tiers).
4. Go to **[Google Cloud Billing Console](https://console.cloud.google.com/billing)**.
5. Click **Budgets & alerts** > **Create Budget**.
6. Set a monthly budget alert (e.g., $25.00 USD) and configure email notifications at 50%, 80%, and 100% threshold levels to prevent unexpected charges.

---

## 4. Configuring Firebase Authentication

1. In Firebase Console, go to **Build** > **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable **Email/Password**. Leave *Email link (passwordless sign-in)* disabled unless requested.
5. Click **Save**.
6. Under **Settings** > **Authorized domains**, add your custom website domain (e.g., `familytrusttherapy.com`).

---

## 5. Upgrading Authentication & Enabling Staff MFA

1. To protect therapist and administrator accounts with Multi-Factor Authentication (MFA), click **Sign-in method** > **Upgrade to Identity Platform**.
2. Once upgraded, navigate to **Authentication** > **Settings** > **MFA**.
3. Set MFA to **Required** for staff or **Optional/Enforced by Role**.
4. Select **TOTP Authenticator app** (Google Authenticator, Duo, or 1Password) as the required MFA channel for all therapist and admin roles.

---

## 6. Cloud Storage & Security Rules

1. Go to **Build** > **Storage**.
2. Click **Get Started**.
3. Choose **Start in production mode**.
4. Select the same region location as your Firestore database.
5. Click **Done**.

---

## 7. Enabling Firebase App Check & Cloud Functions

1. Go to **Build** > **App Check**.
2. Register your web app with **reCAPTCHA Enterprise** or **Cloudflare Turnstile** to block automated abuse and unauthorized API calls.
3. Enable App Check enforcement for Firestore, Storage, and Cloud Functions.

---

## 8. Configuring Google Calendar API & OAuth 2.0

1. Go to the **[Google Cloud Console](https://console.cloud.google.com)** for your project.
2. Search for **Google Calendar API** in the top search bar and click **Enable**.
3. Go to **APIs & Services** > **OAuth consent screen**.
   * User Type: Select **External** (or Internal if using Google Workspace).
   * App Name: `Family Trust Therapy Portal`.
   * User Support Email: Your office email.
   * Developer Contact Info: Your office email.
   * Scopes: Add `https://www.googleapis.com/auth/calendar.events.readonly` and `https://www.googleapis.com/auth/calendar.events`.
4. Go to **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**.
   * Application type: **Web application**.
   * Name: `Therapy Portal Calendar Client`.
   * Authorized JavaScript origins: `https://familytrusttherapy.com` (and `http://localhost:4321` for testing).
   * Authorized redirect URIs: `https://familytrusttherapy.com/portal/api/gcal/callback`.
5. Copy your **Client ID** and **Client Secret**. Store these securely in Google Secret Manager or Environment Variables. Never commit them to source control.

---

## 9. Setting Up Environment Keys & Public Config

Copy `.env.example` to `.env` on your deployment server:

```env
PUBLIC_FIREBASE_API_KEY=your_public_api_key
PUBLIC_FIREBASE_AUTH_DOMAIN=family-trust-therapy-portal.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=family-trust-therapy-portal
PUBLIC_FIREBASE_STORAGE_BUCKET=family-trust-therapy-portal.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## 10. Onboarding the First Administrator & Therapist

To safely seed the initial practice administrator without leaving public admin registration open:

1. Create a normal account in the portal UI using your practice email address.
2. Run the seed script on your workstation:
   ```bash
   npx tsx scripts/seed-admin.ts <YOUR_FIREBASE_USER_UID> admin
   ```
3. This sets the custom claim `role: 'admin'` on your account, unlocking administrator privileges.

---

## 11. Backups, Point-in-Time Recovery & Security Logs

1. Go to **Cloud Firestore** > **Data** > **Backups**.
2. Enable **Point-in-Time Recovery (PITR)** to allow database restoration to any microsecond in the past 7 days.
3. Configure scheduled daily Firestore exports to a dedicated secure Cloud Storage bucket:
   ```bash
   gcloud firestore export gs://family-trust-therapy-portal-backups
   ```

---

## 12. Accepting the Google Cloud HIPAA Business Associate Addendum (BAA)

If your practice is a Covered Entity or Business Associate under HIPAA:

1. Log in to the **[Google Cloud Console](https://console.cloud.google.com)**.
2. In the left navigation menu, go to **IAM & Admin** > **Privacy & Security** (or **Compliance**).
3. Locate the **HIPAA Business Associate Agreement (BAA)** section.
4. Review the terms and click **Accept HIPAA BAA**.
5. Verify that Firestore, Cloud Storage, Firebase Authentication, Cloud Functions, and Secret Manager are listed as covered services.

---

## 13. Consumer Gmail Privacy vs. Google Workspace

> [!WARNING]
> **DO NOT USE A CONSUMER (@gmail.com) ACCOUNT FOR PHI**: Personal consumer `@gmail.com` accounts are NOT covered by Google's HIPAA BAA.
> 
> * Always use a **Google Workspace for Healthcare** paid account with a signed BAA.
> * If a personal consumer calendar is temporarily used only for blocking out personal unavailable times, keep calendar event titles generic (e.g., *"Personal Block"* or *"Reserved Appointment"*) and never include client names, intake notes, or diagnoses.

---

## 14. Pre-Launch Technical & Legal Checklist

### Technical Readiness
- [x] Firebase Local Emulator Suite rules testing passes 100%.
- [x] Firestore deny-by-default security rules deployed.
- [x] Storage rules deployed with size and MIME restrictions.
- [x] Staff MFA required and TOTP configured.
- [x] Google Calendar 2-way sync verified with generic privacy titles.

### Operational & Legal Compliance
- [ ] Google Cloud HIPAA BAA accepted in Google Cloud Console.
- [ ] Practice Notice of Privacy Practices (NPP) reviewed by licensed attorney.
- [ ] Informed Consent and Telehealth Consent templates reviewed by legal counsel.
- [ ] Billing policies and cancellation fee rules published.
- [ ] Emergency 988 lifeline notice verified prominently on all portal pages.
