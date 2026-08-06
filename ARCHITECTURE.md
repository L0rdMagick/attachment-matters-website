# Therapy Portal Architecture & Technical Blueprint

This document outlines the architecture, component interaction, and security boundaries for the Family Trust Therapy portal.

---

## 1. High-Level Architecture Diagram

```
                              ┌─────────────────────────────────────────┐
                              │            Astro + React Frontend       │
                              │       (Tailwind CSS, Playfair/Source)   │
                              └────────────────────┬────────────────────┘
                                                   │
                                      ┌────────────┴────────────┐
                                      ▼                         ▼
                           ┌──────────────────┐     ┌───────────────────────┐
                           │   Firebase Web   │     │  Firebase Cloud Funcs │
                           │   SDK (v11)      │     │  (Server-side API)    │
                           └────────┬─────────┘     └───────────┬───────────┘
                                    │                           │
                   ┌────────────────┴──────────────┬────────────┴───────────┐
                   ▼                               ▼                        ▼
       ┌──────────────────────┐        ┌──────────────────────┐  ┌─────────────────────┐
       │   Cloud Firestore    │        │    Cloud Storage     │  │   Google Calendar   │
       │ (Security Rules)     │        │   (Storage Rules)    │  │     API (OAuth)     │
       └──────────────────────┘        └──────────────────────┘  └─────────────────────┘
```

---

## 2. Security Boundaries & Authorization Flow

1. **Client Identification**: Every authenticated request passes a Firebase Authentication JWT ID Token containing custom claims (`role: 'client' | 'therapist' | 'admin'`).
2. **Firestore Security Rules**: Rules evaluate claims before any read/write request touches data.
3. **Clinical Isolation**: Private clinical notes (`privateClinicalNotes`) are stored in a dedicated top-level collection with explicit rule-level denial for all client UIDs.
4. **Atomic Transactions**: Appointment bookings use Firestore transactions to acquire an exclusive lock document in `appointmentLocks/{therapistId}_{slotKey}` before confirming, preventing race conditions.

---

## 3. Technology Choices Rationale

* **Astro v5 + React Integration**: Allows high-performance static rendering for the public website while mounting isolated React application sub-routes (`/portal/*`) for dynamic portal features.
* **Firebase Backend**: Provides serverless authentication, scalable database, encrypted storage, and emulator support with zero infrastructure maintenance overhead for the practice owner.
