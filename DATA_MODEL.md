# Firestore Data Model & Schema Specification

All timestamps are stored as Firestore Server Timestamps in UTC. Sensitive details are segregated across collections with strict rule-based isolation.

---

## Collections Reference

### 1. `users`
* **Doc ID**: `uid`
* **Fields**: `email`, `role` (`'client' | 'therapist' | 'admin'`), `status` (`'active' | 'suspended' | 'deactivated'`), `emailVerified`, `createdAt`, `updatedAt`.
* **Access Rules**: User can read own doc; Therapist/Admin can read; Admin can update roles.

### 2. `clients`
* **Doc ID**: `uid`
* **Fields**: `legalFirstName`, `legalMiddleName`, `legalLastName`, `preferredName`, `pronouns`, `dob`, `address`, `email`, `primaryPhone`, `alternatePhone`, `preferredContactMethod`, `communicationConsent`, `emergencyContact`, `primaryCareProvider`, `referralSource`, `preferredFormat`, `accessibilityRequests`, `preferredPharmacy`, `insuranceInfo`, `insuranceCardFrontPath`, `insuranceCardBackPath`, `assignedTherapistId`, `intakeStatus`, `consentStatus`, `createdAt`, `updatedAt`.
* **Access Rules**: Client can read/edit permitted fields on own doc. Therapist/Admin read/manage.

### 3. `appointments`
* **Doc ID**: Auto-generated
* **Fields**: `clientId`, `therapistId`, `appointmentTypeId`, `appointmentTypeName`, `startISO`, `endISO`, `timezone`, `format`, `locationOrLink`, `status`, `cancellationReason`, `priceInCents`, `googleCalendarEventId`, `syncStatus`, `createdAt`, `updatedAt`.

### 4. `appointmentLocks`
* **Doc ID**: `{therapistId}_{slotTimestamp}`
* **Fields**: `appointmentId`, `lockedByUid`, `expiresAt`, `createdAt`.
* **Purpose**: Prevents double booking via atomic Firestore transactions.

### 5. `sharedNotes`
* **Doc ID**: Auto-generated
* **Fields**: `clientId`, `therapistId`, `title`, `recapSummary`, `homeworkAssigned`, `goalsForNextSession`, `resources`, `isPublished`, `publishedAt`, `createdAt`, `updatedAt`.
* **Access Rules**: Client can ONLY read when `isPublished == true` and `clientId == request.auth.uid`.

### 6. `privateClinicalNotes`
* **Doc ID**: Auto-generated
* **Fields**: `clientId`, `therapistId`, `appointmentId`, `noteType`, `dataSection`, `assessmentSection`, `planSection`, `isFinalized`, `finalizedAtISO`, `amendments` (array of `{amendedAtISO, amendedByUid, reason, additionalContent}`).
* **Access Rules**: **STRICT DENY ALL FOR CLIENTS**. Read/Write allowed ONLY for Therapists and Admins.

### 7. `invoices` & `ledgerEntries`
* **Invoices Doc ID**: Auto-generated
* **Fields**: `clientId`, `appointmentId`, `invoiceNumber`, `description`, `totalCents`, `balanceCents`, `status`, `dueDate`, `createdAt`, `updatedAt`.
* **Ledger Entries Doc ID**: Auto-generated (Append-only)
* **Fields**: `clientId`, `invoiceId`, `type`, `amountCents`, `paymentMethod`, `transactionRef`, `notes`, `createdById`, `createdAt`.

### 8. `consentTemplates` & `signedDocuments`
* **Signed Documents Doc ID**: Auto-generated (Immutable)
* **Fields**: `clientId`, `templateId`, `templateVersion`, `documentTitle`, `exactTextSnapshot`, `clientTypedName`, `signatureDataUrl`, `signedAtISO`, `documentHash`, `status`.

### 9. `auditEvents`
* **Doc ID**: Auto-generated (Append-only)
* **Fields**: `actorUid`, `actorRole`, `targetUid`, `action`, `resourcePath`, `changedFields`, `previousValues`, `newValues`, `timestamp`.
