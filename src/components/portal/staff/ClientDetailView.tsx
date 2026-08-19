import React, { useState, useEffect } from 'react';
import { getClientProfile } from '../../../lib/firebase/clients';
import { getSignedDocuments } from '../../../lib/firebase/consent';
import { getIntakeSubmission, reviewIntakeSubmission } from '../../../lib/firebase/intake';
import { getAppointments, updateAppointmentStatus, bookAppointmentWithLock, getAvailabilityRules, checkTherapistSlotAvailability, DEFAULT_AVAILABILITY_RULES } from '../../../lib/firebase/scheduling';
import type { ClientProfileData } from '../../../types/client';
import type { SignedDocumentData } from '../../../types/consent';
import type { IntakeSubmissionData } from '../../../types/intake';
import type { AppointmentData, AppointmentStatus, AvailabilityRules } from '../../../types/scheduling';
import { PrivateClinicalNotesView } from '../notes/PrivateClinicalNotesView';
import { PrintableIntakeDocument } from '../intake/PrintableIntakeDocument';
import { PrintableSignedConsentDocument } from '../consent/PrintableSignedConsentDocument';

interface ClientDetailViewProps {
  clientId: string;
  onBack: () => void;
}

type ChartTab =
  | 'overview'
  | 'contact'
  | 'appointments'
  | 'intake'
  | 'documents'
  | 'shared-notes'
  | 'private-clinical-notes'
  | 'billing'
  | 'files'
  | 'audit';

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onBack }) => {
  const [client, setClient] = useState<ClientProfileData | null>(null);
  const [signedDocs, setSignedDocs] = useState<SignedDocumentData[]>([]);
  const [intakeData, setIntakeData] = useState<IntakeSubmissionData | null>(null);
  const [clientAppointments, setClientAppointments] = useState<AppointmentData[]>([]);
  const [rules, setRules] = useState<AvailabilityRules>(DEFAULT_AVAILABILITY_RULES);
  const [selectedDoc, setSelectedDoc] = useState<SignedDocumentData | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Review states
  const [reviewingIntake, setReviewingIntake] = useState(false);
  const [revisionNotesInput, setRevisionNotesInput] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // Admin Schedule Appointment Modal State (Must be declared at top level before conditional returns)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedType, setSchedType] = useState(DEFAULT_AVAILABILITY_RULES.appointmentTypes[0]);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedFormat, setSchedFormat] = useState<'telehealth' | 'in_person'>('telehealth');
  const [schedBooking, setSchedBooking] = useState(false);
  const [schedMessage, setSchedMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
      try {
        const [data, docs, intake, appts, r] = await Promise.all([
          getClientProfile(clientId),
          getSignedDocuments(clientId),
          getIntakeSubmission(clientId),
          getAppointments({ clientId }),
          getAvailabilityRules('default')
        ]);
        setClient(data);
        setSignedDocs(docs);
        setIntakeData(intake);
        setClientAppointments(appts);
        if (r) setRules(r);
        if (docs.length > 0) {
          setSelectedDoc(docs[0]);
        }
      } catch (err) {
        console.error("Failed to load client chart", err);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const refreshSignedDocs = async () => {
    setLoadingDocs(true);
    try {
      const docs = await getSignedDocuments(clientId);
      setSignedDocs(docs);
      if (docs.length > 0 && !selectedDoc) {
        setSelectedDoc(docs[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const refreshIntake = async () => {
    try {
      const intake = await getIntakeSubmission(clientId);
      setIntakeData(intake);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewStatus = async (status: 'approved' | 'revision_requested') => {
    setReviewingIntake(true);
    try {
      await reviewIntakeSubmission(clientId, status, status === 'revision_requested' ? revisionNotesInput : undefined);
      await refreshIntake();
      setShowRevisionForm(false);
      alert(`Intake submission marked as ${status.replace('_', ' ')}.`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to update intake review status.");
    } finally {
      setReviewingIntake(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'documents') {
      refreshSignedDocs();
    }
    if (activeTab === 'intake') {
      refreshIntake();
    }
  }, [activeTab]);

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl font-sans text-sm">Loading client chart...</div>;
  }

  if (!client) {
    return (
      <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl font-sans">
        <p className="text-red-600 mb-4 text-sm">Client chart not found.</p>
        <button onClick={onBack} className="px-4 py-2 bg-[#4A5741] text-white text-xs rounded-xl font-medium">
          ← Back to Directory
        </button>
      </div>
    );
  }

  const tabs: { id: ChartTab; label: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview & Profile' },
    { id: 'contact', label: 'Contact Info' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'intake', label: 'Intake Packet', badge: intakeData?.status || client.intakeStatus },
    { id: 'documents', label: 'Signed Docs', badge: signedDocs.length > 0 ? `${signedDocs.length} Signed` : client.consentStatus },
    { id: 'shared-notes', label: 'Shared Summaries' },
    { id: 'private-clinical-notes', label: '🔒 Private Notes (DAP/SOAP)' },
    { id: 'billing', label: 'Billing & Ledger' },
    { id: 'files', label: 'Insurance Cards & Files' },
    { id: 'audit', label: 'Audit History' }
  ];

  const handleStatusChangeInChart = async (apptId: string, status: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(apptId, status);
      const appts = await getAppointments({ clientId });
      setClientAppointments(appts);
    } catch (err) {
      console.error("Failed to update appointment status", err);
    }
  };

  const upcomingAppts = clientAppointments.filter(a => a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled');
  const pastAppts = clientAppointments.filter(a => a.status === 'completed' || a.status.startsWith('canceled'));

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSchedBooking(true);
    setSchedMessage(null);

    // Check practice settings availability against all therapist appointments
    const allTherapistAppts = await getAppointments({ therapistId: 'default_therapist' });
    const availCheck = checkTherapistSlotAvailability(
      schedDate,
      schedTime,
      schedType?.durationMinutes || 50,
      rules,
      allTherapistAppts,
      schedType?.bufferBeforeMinutes || 0,
      schedType?.bufferAfterMinutes || 0
    );

    if (availCheck.hasDoubleBooking) {
      const proceedDouble = confirm(
        `⚠️ DOUBLE BOOKING WARNING:\n\n${availCheck.doubleBookingReason}\n\nDo you want to override and proceed with this double booking?`
      );
      if (!proceedDouble) {
        setSchedBooking(false);
        setShowScheduleModal(false);
        return;
      }
    }

    if (availCheck.isOutsideHours) {
      const proceedOutside = confirm(
        `⚠️ OUTSIDE SCHEDULED HOURS WARNING:\n\n${availCheck.outsideHoursReason}\n\nDo you want to override your practice settings and schedule this session outside of scheduled hours?`
      );
      if (!proceedOutside) {
        setSchedBooking(false);
        setShowScheduleModal(false);
        return;
      }
    }

    const startISO = `${schedDate}T${schedTime}:00`;
    const endISO = new Date(new Date(startISO).getTime() + (schedType?.durationMinutes || 50) * 60000).toISOString();

    try {
      await bookAppointmentWithLock({
        clientId: client.uid,
        clientName: `${client.legalFirstName} ${client.legalLastName}`,
        clientEmail: client.email || undefined,
        therapistId: 'default_therapist',
        appointmentTypeId: schedType.id,
        appointmentTypeName: schedType.name,
        startISO,
        endISO,
        timezone: rules.timezone || 'America/Chicago',
        format: schedFormat,
        locationOrLink: schedFormat === 'telehealth' ? 'https://familytrusttherapy.com/telehealth-room' : '123 Practice Way, Suite 100',
        status: 'confirmed',
        priceInCents: schedType.priceInCents,
        syncStatus: 'pending'
      }, true);

      const appts = await getAppointments({ clientId: client.uid });
      setClientAppointments(appts);
      setShowScheduleModal(false);
      alert(`Appointment for ${client.legalFirstName} ${client.legalLastName} scheduled successfully!`);
    } catch (err: any) {
      console.error(err);
      setSchedMessage(err.message || "Failed to schedule appointment due to lock collision.");
    } finally {
      setSchedBooking(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Client Summary */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print print:hidden">
        <div>
          <button onClick={onBack} className="text-xs text-[#BF5B33] hover:underline font-semibold mb-2 block">
            ← Back to Directory
          </button>
          <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">
            {client.legalLastName}, {client.legalFirstName}{' '}
            {client.legalMiddleName ? `${client.legalMiddleName} ` : ''}
            {client.preferredName ? <span className="text-[#4A5741] font-normal">("{client.preferredName}")</span> : ''}
          </h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            DOB: <span className="font-semibold text-[#2C2A2A]">{client.dob || 'Not provided'}</span> | Pronouns:{' '}
            <span className="font-semibold text-[#2C2A2A]">{client.pronouns || 'Not specified'}</span> | Format:{' '}
            <span className="font-semibold text-[#2C2A2A] capitalize">{client.preferredFormat || 'Telehealth'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#4A5741]/10 text-[#4A5741] border border-[#4A5741]/20">
            Account Status: {client.accountStatus || 'Active'}
          </span>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            + Schedule Appointment
          </button>
        </div>
      </div>

      {/* Chart Navigation Tabs */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-2 shadow-sm overflow-x-auto flex space-x-1 no-print print:hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isPrivate = tab.id === 'private-clinical-notes';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                isActive
                  ? isPrivate
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'bg-[#4A5741] text-white shadow-sm'
                  : isPrivate
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-[#2C2A2A]/80 hover:bg-[#EAE1D2]/50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#BF5B33]/10 text-[#BF5B33]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display Area */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
        {activeTab === 'overview' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <h3 className="text-xl font-serif font-medium border-b border-[#EAE1D2] pb-2">Comprehensive Client Chart Overview</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Identification & Demographics */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">1. Legal Demographics</h4>
                <p><strong>Legal Name:</strong> {client.legalLastName}, {client.legalFirstName} {client.legalMiddleName || ''}</p>
                <p><strong>Preferred Name:</strong> {client.preferredName || 'Same as legal name'}</p>
                <p><strong>Pronouns:</strong> {client.pronouns || 'Not specified'}</p>
                <p><strong>Date of Birth:</strong> {client.dob || 'Not provided'}</p>
                <p><strong>System UID:</strong> <code className="text-xs bg-white px-2 py-0.5 rounded border border-[#EAE1D2]">{client.uid}</code></p>
              </div>

              {/* 2. Contact & Address */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">2. Contact Information</h4>
                <p><strong>Email Address:</strong> {client.email}</p>
                <p><strong>Primary Phone:</strong> {client.primaryPhone || 'N/A'}</p>
                <p><strong>Alternate Phone:</strong> {client.alternatePhone || 'N/A'}</p>
                <p><strong>Preferred Contact Method:</strong> <span className="capitalize">{client.preferredContactMethod || 'Email'}</span></p>
                <p><strong>Address:</strong> {client.address ? `${client.address.street} ${client.address.unit ? `#${client.address.unit}` : ''}, ${client.address.city}, ${client.address.state} ${client.address.zip}` : 'No address on file'}</p>
              </div>

              {/* 3. Emergency Contact & Primary Care */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">3. Emergency Contact & PCP</h4>
                <p><strong>Emergency Contact Name:</strong> {client.emergencyContact?.name || 'None provided'}</p>
                <p><strong>Relationship:</strong> {client.emergencyContact?.relationship || 'N/A'}</p>
                <p><strong>Emergency Phone:</strong> {client.emergencyContact?.phone || 'N/A'}</p>
                <p className="pt-1"><strong>Primary Care Physician (PCP):</strong> {client.primaryCareProvider || 'None listed'}</p>
                <p><strong>Preferred Pharmacy:</strong> {client.preferredPharmacy || 'None listed'}</p>
                <p><strong>Referral Source:</strong> {client.referralSource || 'Not specified'}</p>
              </div>

              {/* 4. Service Preferences & Insurance */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">4. Insurance & Format Preferences</h4>
                <p><strong>Preferred Service Format:</strong> <span className="capitalize font-semibold text-[#BF5B33]">{client.preferredFormat || 'telehealth'}</span></p>
                <p><strong>Insurance Provider:</strong> {client.insuranceInfo?.provider || 'Self-Pay / Cash'}</p>
                <p><strong>Policy Number:</strong> {client.insuranceInfo?.policyNumber || 'N/A'}</p>
                <p><strong>Group Number:</strong> {client.insuranceInfo?.groupNumber || 'N/A'}</p>
                <p><strong>Subscriber Name:</strong> {client.insuranceInfo?.subscriberName || 'Self'}</p>
                <p><strong>Subscriber Relationship:</strong> {client.insuranceInfo?.subscriberRelationship || 'Self'}</p>
              </div>
            </div>

            {/* 5. ACCESSIBILITY & ACCOMMODATION REQUESTS */}
            <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-xl space-y-2">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                ♿ Accessibility & Accommodation Requests
              </h4>
              {client.accessibilityRequests ? (
                <p className="text-sm text-amber-950 whitespace-pre-wrap bg-white p-3 rounded-lg border border-amber-200 font-medium">
                  {client.accessibilityRequests}
                </p>
              ) : (
                <p className="text-xs text-amber-800/80 italic">
                  No special accessibility or accommodation requests submitted by client.
                </p>
              )}
            </div>

            {/* 6. Communication Consents & Signed Documents Summary */}
            <div className="bg-[#F7F2E9]/70 p-5 rounded-xl border border-[#EAE1D2] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741]">Client Communication & Signed Consent Summary</h4>
                <span className="text-xs font-semibold px-3 py-1 bg-white rounded-full border border-[#EAE1D2] text-[#4A5741]">
                  {signedDocs.length} E-Signed Agreements On File
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-[#EAE1D2] flex flex-col justify-between">
                  <span className="font-medium text-[#2C2A2A]/80">Email Notifications</span>
                  <span className={`mt-2 inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full w-fit ${
                    client.communicationConsent?.emailConsent !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}>
                    {client.communicationConsent?.emailConsent !== false ? '✓ Approved' : '✗ Not Approved'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#EAE1D2] flex flex-col justify-between">
                  <span className="font-medium text-[#2C2A2A]/80">SMS Reminders</span>
                  <span className={`mt-2 inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full w-fit ${
                    client.communicationConsent?.smsConsent ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}>
                    {client.communicationConsent?.smsConsent ? '✓ Approved' : '✗ Not Approved'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#EAE1D2] flex flex-col justify-between">
                  <span className="font-medium text-[#2C2A2A]/80">Confidential Voicemail</span>
                  <span className={`mt-2 inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full w-fit ${
                    client.communicationConsent?.voicemailConsent !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}>
                    {client.communicationConsent?.voicemailConsent !== false ? '✓ Approved' : '✗ Not Approved'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'appointments' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <div className="border-b border-[#EAE1D2] pb-3">
              <h3 className="text-xl font-serif font-medium">Client Appointments & Clinical History</h3>
              <p className="text-xs text-[#2C2A2A]/70 mt-1">
                View upcoming scheduled sessions and historical completed appointments.
              </p>
            </div>

            {/* Upcoming Appointments */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-[#4A5741] tracking-wider">
                Upcoming & Active Sessions ({upcomingAppts.length})
              </h4>
              {upcomingAppts.length === 0 ? (
                <div className="bg-[#F7F2E9] p-4 rounded-xl border border-[#EAE1D2] text-xs text-gray-600 text-center">
                  No active upcoming appointments scheduled for this client.
                </div>
              ) : (
                upcomingAppts.map((appt) => (
                  <div key={appt.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{appt.appointmentTypeName}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          appt.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {appt.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1">
                        <strong>Time:</strong> {new Date(appt.startISO).toLocaleString()} | <strong>Format:</strong> <span className="capitalize">{appt.format}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStatusChangeInChart(appt.id!, 'completed')}
                        className="px-3 py-1.5 bg-[#4A5741] text-white font-semibold rounded-lg hover:bg-[#384232] transition"
                      >
                        ✓ Mark Completed
                      </button>
                      <button
                        onClick={() => handleStatusChangeInChart(appt.id!, 'canceled_by_practice')}
                        className="px-3 py-1.5 border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Completed & Past Appointments History */}
            <div className="space-y-3 pt-4 border-t border-[#EAE1D2]">
              <h4 className="text-xs font-semibold uppercase text-[#4A5741] tracking-wider">
                Completed & Past Session History ({pastAppts.length})
              </h4>
              {pastAppts.length === 0 ? (
                <div className="bg-[#F7F2E9] p-4 rounded-xl border border-[#EAE1D2] text-xs text-gray-600 text-center">
                  No completed or past session history for this client.
                </div>
              ) : (
                pastAppts.map((appt) => (
                  <div key={appt.id} className="p-4 bg-white rounded-xl border border-[#EAE1D2] flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{appt.appointmentTypeName}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          appt.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {appt.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1">
                        <strong>Date:</strong> {new Date(appt.startISO).toLocaleString()} | <strong>Format:</strong> <span className="capitalize">{appt.format}</span>
                      </p>
                    </div>
                    <div className="font-mono font-semibold text-gray-700">
                      ${(appt.priceInCents / 100).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* INTAKE PACKET TAB (FULL ADMIN VIEWER & REVIEWER) */}
        {activeTab === 'intake' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-4 gap-2 no-print print:hidden">
              <div>
                <h3 className="text-xl font-serif font-medium">Initial Client Intake Questionnaire Packet</h3>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Review submitted clinical background, symptoms, treatment history, and safety screening.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase border ${
                  intakeData?.status === 'submitted' || intakeData?.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : intakeData?.status === 'revision_requested'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}>
                  Status: {intakeData?.status ? intakeData.status.replace('_', ' ') : client.intakeStatus}
                </span>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#4A5741] text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-[#384232] transition"
                >
                  🖨️ Print Intake Packet
                </button>
              </div>
            </div>

            {!intakeData || (!intakeData.reasonForTherapy && client.intakeStatus === 'not_started') ? (
              <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-xl p-8 text-center">
                <p className="text-xs font-semibold text-[#2C2A2A]/70">No submitted intake questionnaire packet found for this client yet.</p>
                <p className="text-[11px] text-[#2C2A2A]/50 mt-1">Client intake status: Not Started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Therapist Review Controls Banner */}
                <div className="bg-[#F7F2E9] p-5 rounded-2xl border border-[#EAE1D2] space-y-4 no-print print:hidden">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741]">Therapist Intake Packet Review Actions</h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleReviewStatus('approved')}
                      disabled={reviewingIntake}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      ✓ Approve Intake Packet
                    </button>
                    <button
                      onClick={() => setShowRevisionForm(!showRevisionForm)}
                      disabled={reviewingIntake}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      ✏️ Request Corrections / Revisions
                    </button>
                  </div>

                  {showRevisionForm && (
                    <div className="space-y-3 pt-3 border-t border-[#EAE1D2]">
                      <label className="block text-xs font-semibold text-[#2C2A2A]">Enter Correction Notes for Client:</label>
                      <textarea
                        rows={3}
                        value={revisionNotesInput}
                        onChange={(e) => setRevisionNotesInput(e.target.value)}
                        className="w-full p-3 rounded-xl border border-[#EAE1D2] bg-white text-xs focus:ring-2 focus:ring-[#BF5B33] outline-none"
                        placeholder="Specify which section needs clarification or additional details..."
                      />
                      <button
                        onClick={() => handleReviewStatus('revision_requested')}
                        disabled={reviewingIntake || !revisionNotesInput.trim()}
                        className="px-4 py-2 bg-amber-800 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                      >
                        Send Revision Request to Client
                      </button>
                    </div>
                  )}
                </div>

                <PrintableIntakeDocument
                  clientName={`${client.legalFirstName} ${client.legalLastName}`}
                  clientEmail={client.email || ''}
                  intakeData={intakeData}
                />
              </div>
            )}
          </div>
        )}

        {/* SIGNED CONSENT DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-4 gap-2 no-print print:hidden">
              <div>
                <h3 className="text-xl font-serif font-medium">Practice Consent Forms & Signed Agreements</h3>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Immutably archived legal agreements e-signed by {client.legalFirstName} {client.legalLastName}.
                </p>
              </div>
              <button
                onClick={refreshSignedDocs}
                disabled={loadingDocs}
                className="px-3 py-1.5 bg-[#F7F2E9] hover:bg-[#EAE1D2] text-[#4A5741] text-xs font-semibold rounded-xl border border-[#EAE1D2] transition w-fit"
              >
                {loadingDocs ? 'Refreshing...' : '🔄 Refresh Signed Docs'}
              </button>
            </div>

            {signedDocs.length === 0 ? (
              <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-xl p-8 text-center">
                <p className="text-xs font-semibold text-[#2C2A2A]/70">No e-signed consent agreements found for this client yet.</p>
                <p className="text-[11px] text-[#2C2A2A]/50 mt-1">
                  Required documents: Informed Consent for Psychotherapy, Telehealth Consent, Financial Responsibility Agreement.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* List of Signed Documents (Hidden on Print) */}
                <div className="space-y-3 no-print print:hidden">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#4A5741]">Submitted Agreements</h4>
                  {signedDocs.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <button
                        key={doc.id || doc.documentHash}
                        onClick={() => setSelectedDoc(doc)}
                        className={`w-full text-left p-4 rounded-xl border text-xs transition flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-[#4A5741] text-white border-[#4A5741] shadow-sm'
                            : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2] hover:bg-[#EAE1D2]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{doc.documentTitle}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                            ✓ Signed
                          </span>
                        </div>
                        <p className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[#2C2A2A]/60'}`}>
                          Version: {doc.templateVersion} | Signed by: {doc.clientTypedName}
                        </p>
                        <p className={`text-[10px] font-mono ${isSelected ? 'text-white/70' : 'text-[#2C2A2A]/50'}`}>
                          Hash: {doc.documentHash.substring(0, 20)}...
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Signed Document Viewer & Official Printable Document */}
                <div className="md:col-span-2">
                  {selectedDoc ? (
                    <PrintableSignedConsentDocument
                      clientName={`${client.legalFirstName} ${client.legalLastName}`}
                      clientEmail={client.email || ''}
                      signedDoc={selectedDoc}
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-[#2C2A2A]/60">Select a signed document from the list to view its complete audit snapshot.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="text-sm text-[#2C2A2A] space-y-6">
            <h3 className="text-xl font-serif font-medium border-b border-[#EAE1D2] pb-2">Contact Details & Communication Preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-2">Phone & Email</h4>
                <p><strong>Primary Phone:</strong> {client.primaryPhone || 'N/A'}</p>
                <p><strong>Alternate Phone:</strong> {client.alternatePhone || 'N/A'}</p>
                <p><strong>Email Address:</strong> {client.email}</p>
                <p><strong>Preferred Contact Method:</strong> <span className="capitalize">{client.preferredContactMethod || 'Email'}</span></p>
              </div>

              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-2">Physical Address</h4>
                <p><strong>Street:</strong> {client.address?.street || 'Not provided'}</p>
                <p><strong>Unit/Apt:</strong> {client.address?.unit || 'N/A'}</p>
                <p><strong>City, State Zip:</strong> {client.address ? `${client.address.city}, ${client.address.state} ${client.address.zip}` : 'N/A'}</p>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-xl space-y-2">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-900">
                ♿ Accessibility & Accommodation Requests
              </h4>
              <p className="text-sm text-amber-950 font-medium">
                {client.accessibilityRequests || 'No special accommodations requested.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <h3 className="text-xl font-serif font-medium border-b border-[#EAE1D2] pb-2">Uploaded Insurance Cards & Client Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Front Card */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] text-center">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">Insurance Card (Front)</h4>
                {client.insuranceCardFrontPath ? (
                  <div className="space-y-3">
                    <img src={client.insuranceCardFrontPath} alt="Insurance Card Front" className="max-h-56 mx-auto rounded-lg border border-[#EAE1D2] object-cover shadow-sm bg-white" />
                    <div className="flex items-center justify-center gap-3">
                      <a href={client.insuranceCardFrontPath} target="_blank" rel="noopener noreferrer" className="inline-block px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs rounded-lg font-medium shadow-sm transition">
                        📥 Download / View File ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#2C2A2A]/60 italic py-8">No front insurance card uploaded by client yet.</p>
                )}
              </div>

              {/* Back Card */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] text-center">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">Insurance Card (Back)</h4>
                {client.insuranceCardBackPath ? (
                  <div className="space-y-3">
                    <img src={client.insuranceCardBackPath} alt="Insurance Card Back" className="max-h-56 mx-auto rounded-lg border border-[#EAE1D2] object-cover shadow-sm bg-white" />
                    <div className="flex items-center justify-center gap-3">
                      <a href={client.insuranceCardBackPath} target="_blank" rel="noopener noreferrer" className="inline-block px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs rounded-lg font-medium shadow-sm transition">
                        📥 Download / View File ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#2C2A2A]/60 italic py-8">No back insurance card uploaded by client yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'private-clinical-notes' && (
          <div className="space-y-4">
            <PrivateClinicalNotesView targetClientId={client.uid} />
          </div>
        )}

        {activeTab !== 'overview' && activeTab !== 'contact' && activeTab !== 'files' && activeTab !== 'documents' && activeTab !== 'intake' && activeTab !== 'private-clinical-notes' && activeTab !== 'appointments' && (
          <div className="text-xs text-[#2C2A2A]/70">
            Active chart tab: <strong className="capitalize">{activeTab.replace('-', ' ')}</strong>. Functional module binder active.
          </div>
        )}
      </div>

      {/* Admin Schedule Appointment Popup Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#EAE1D2]">
            <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3">
              <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">
                Schedule Appointment for {client.legalFirstName} {client.legalLastName}
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {schedMessage && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium">
                {schedMessage}
              </div>
            )}

            <form onSubmit={handleScheduleAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Select Appointment Type
                </label>
                <select
                  value={schedType.id}
                  onChange={(e) => {
                    const found = rules.appointmentTypes.find(t => t.id === e.target.value);
                    if (found) {
                      setSchedType(found);
                      if (found.format === 'telehealth') setSchedFormat('telehealth');
                      else if (found.format === 'in_person') setSchedFormat('in_person');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium"
                >
                  {rules.appointmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.durationMinutes} min • ${(type.priceInCents / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Start Time Slot
                  </label>
                  <select
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium"
                  >
                    {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Service Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSchedFormat('telehealth')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      schedFormat === 'telehealth' ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'
                    }`}
                  >
                    💻 Telehealth
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedFormat('in_person')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      schedFormat === 'in_person' ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'
                    }`}
                  >
                    🏢 In-Person Office
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE1D2]">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedBooking}
                  className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {schedBooking ? 'Booking...' : 'Book & Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
