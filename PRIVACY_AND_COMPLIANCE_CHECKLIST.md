# Privacy & Compliance Checklist

This document separates software technical capabilities from the practice owner's legal, operational, vendor, and configuration responsibilities under HIPAA (Health Insurance Portability and Accountability Act).

---

## Important Legal Disclaimer
> [!IMPORTANT]
> The software provided here is designed with technical safeguards aligned with HIPAA requirements. However, **no software is automatically "HIPAA compliant" out of the box**. Compliance is a combination of technical configuration, signed vendor agreements (BAAs), administrative policies, physical safeguards, and operational practices.

---

## 1. Technical Software Safeguards (Implemented)

- [x] **Access Control & RBAC**: Enforced via Firebase Custom Claims and server-side security rules.
- [x] **Client Privacy Isolation**: Clients cannot access other clients' data or private clinical notes.
- [x] **Encryption in Transit**: All API communications use TLS 1.3/HTTPS.
- [x] **Encryption at Rest**: Cloud Firestore and Cloud Storage enforce AES-256 encryption at rest.
- [x] **Audit Controls**: Profile updates, document signatures, and financial entries are logged with timestamps and actor UIDs.
- [x] **Integrity & Non-Repudiation**: Signed consent forms freeze document text snapshots and record unique hashes.
- [x] **Google Calendar Safeguards**: Generic event titles (*"Reserved Appointment"*) hide clinical reasons from external calendar servers by default.

---

## 2. Owner Operational & Vendor Responsibilities (Required Before Launch)

### Vendor Agreements (BAAs)
- [ ] Sign the **Google Cloud HIPAA Business Associate Addendum (BAA)** in Google Cloud Console.
- [ ] Ensure any third-party email or SMS gateway used to transmit notifications has a signed BAA in place or uses non-PHI generic templates only.

### Administrative & Physical Safeguards
- [ ] Appoint a Practice Security & Privacy Officer.
- [ ] Conduct a formal Security Risk Assessment (SRA) for the practice.
- [ ] Enforce strong password policies and unique staff logins (never share staff passwords).
- [ ] Require staff to lock workstations when stepping away.
- [ ] Establish written policies for workstation security, device encryption, and data backup retention.

### Legal Templates & Notices
- [ ] Have a licensed attorney or healthcare compliance professional review all consent templates (*Informed Consent*, *Telehealth Consent*, *Notice of Privacy Practices*).
- [ ] Publish the practice's official **Notice of Privacy Practices (NPP)** in the portal.
