# Family Trust Therapy - Client & Clinical Management Portal

A secure, modern client-management and clinical portal designed specifically for a therapy practice. Built directly into the practice website using Astro v5, React, Tailwind CSS, and Firebase.

---

## Key Features

* **Dual Experience Portal**:
  * **Client Portal**: Dashboard, Profile management, Appointment booking, Multi-step intake forms, E-signature consent documents, Shared session summaries, and Billing statements.
  * **Therapist / Administrative Portal**: Searchable client directory, Tabbed clinical charts, Agenda/Week/Month calendar, Availability manager, 🔒 Private Clinical Notes (DAP/SOAP) with amendments, and Financial ledger.
* **Security & Role-Based Access Control**:
  * Server-enforced Firebase Custom Claims (`client`, `therapist`, `admin`).
  * Strict deny-by-default Firestore Security Rules & Storage Rules.
  * Absolute isolation for private clinical notes (clients denied at security rule level).
  * Email verification enforcement and staff TOTP Multi-Factor Authentication (MFA).
* **Smart Scheduling & Race-Condition Locking**:
  * Atomic server-side reservation locks in `appointmentLocks` preventing double bookings.
  * Google Calendar 2-way sync with privacy safeguards (generic event titles by default).
* **Legal & Financial Integrity**:
  * Immutable signed document snapshots with unique audit hashes.
  * Append-only financial transaction ledger.
  * Audit logging for sensitive record views and updates (`auditEvents`).

---

## Technology Stack

* **Frontend**: Astro v5, React (v19), Tailwind CSS v3, TypeScript.
* **Backend Services**: Firebase Authentication, Cloud Firestore, Cloud Storage, Firebase Local Emulator Suite.
* **Security**: Firebase App Check, Custom Claims, Security Rules, Secret Manager.

---

## Local Development & Emulator Suite

The entire application runs locally using the **Firebase Local Emulator Suite** without requiring active cloud billing during development.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Firebase Emulators
```bash
npx firebase emulators:start
```
* Emulator UI: `http://localhost:4000`
* Auth Emulator: `localhost:9099`
* Firestore Emulator: `localhost:8080`
* Storage Emulator: `localhost:9199`

### 3. Start Astro Development Server
```bash
npm run dev
```
Open `http://localhost:4321/portal` to access the portal.

---

## Testing Security Rules

Run the automated Firestore Security Rules test suite:
```bash
npm run test
```
Or directly with ts-jest / vitest:
```bash
npx jest tests/firestore.rules.test.ts
```

---

## Seeding First Practice Administrator

To assign the administrator role to a registered user account:
```bash
npx tsx scripts/seed-admin.ts <FIREBASE_USER_UID> admin
```

---

## Documentation Index

* 📘 [SETUP_GUIDE.md](file:///c:/Users/danie/Documents/Projects/attachment-matters-website/SETUP_GUIDE.md): 36-step guide for non-technical owners to deploy under their Google account.
* 🏛️ [ARCHITECTURE.md](file:///c:/Users/danie/Documents/Projects/attachment-matters-website/ARCHITECTURE.md): System architecture and data flow.
* 🗄️ [DATA_MODEL.md](file:///c:/Users/danie/Documents/Projects/attachment-matters-website/DATA_MODEL.md): Firestore database schema reference.
* 🔒 [SECURITY.md](file:///c:/Users/danie/Documents/Projects/attachment-matters-website/SECURITY.md): RBAC matrix, MFA, and security controls.
* 📋 [PRIVACY_AND_COMPLIANCE_CHECKLIST.md](file:///c:/Users/danie/Documents/Projects/attachment-matters-website/PRIVACY_AND_COMPLIANCE_CHECKLIST.md): Legal and operational compliance responsibilities.
