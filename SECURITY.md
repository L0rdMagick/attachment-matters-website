# Security Architecture & Controls

This document details the security controls and authorization policies implemented across the Family Trust Therapy portal.

---

## 1. Authorization Matrix

Enforcement is driven by **Firebase Security Rules** (`firestore.rules` and `storage.rules`) and server custom claims.

| Data Collection / Feature | Client Role | Therapist Role | Practice Admin Role |
| :--- | :--- | :--- | :--- |
| **Own Profile** | Read / Edit allowed fields | Read | Read |
| **Client Directory** | Denied | Read assigned clients | Read all clients |
| **Appointments** | Create/Read/Cancel own | Full control (assigned/all) | Full control |
| **Intake Forms** | Fill/Submit own | Read/Review assigned | Read/Manage templates |
| **Consent Documents** | Sign/Download own | Read/Download assigned | Manage templates/Read |
| **Shared Notes** | Read *published* only | Create/Edit/Publish assigned | Read all shared notes |
| **Private Clinical Notes** | **DENIED (0 access)** | Read/Write assigned | Read/Write (if clinical admin) |
| **Ledger & Invoices** | Read own invoices/receipts | Read/Create for assigned | Full ledger control |
| **Audit Logs** | Denied | Denied | Read only |

---

## 2. Key Security Mechanisms

1. **Deny-By-Default**: Default security rule blocks all unauthenticated and unauthorized requests.
2. **Staff MFA**: Therapist and administrator logins require TOTP Authenticator Multi-Factor Authentication.
3. **Private Clinical Notes Isolation**: `privateClinicalNotes` collection is completely isolated from clients at the database rule layer.
4. **Rate Limiting & Lockouts**: Protected against brute-force login attempts via Firebase Authentication safeguards.
5. **No Credit Card Storage**: No raw credit card numbers or security codes are stored in Firestore.
6. **Audit Event Logging**: Critical profile changes, payment entries, and document signatures are recorded in an append-only audit trail (`auditEvents`).
