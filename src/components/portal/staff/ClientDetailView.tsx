import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { getClientProfile, updateClientProfile } from '../../../lib/firebase/clients';
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
import { LedgerManager } from '../billing/LedgerManager';
import { useAuth } from '../../../context/AuthContext';
import { PortalConfirmModal } from '../common/PortalConfirmModal';

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
  | 'files';

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onBack }) => {
  const { user, role } = useAuth();
  const [client, setClient] = useState<ClientProfileData | null>(null);
  const [signedDocs, setSignedDocs] = useState<SignedDocumentData[]>([]);
  const [intakeData, setIntakeData] = useState<IntakeSubmissionData | null>(null);
  const [clientAppointments, setClientAppointments] = useState<AppointmentData[]>([]);
  const [rules, setRules] = useState<AvailabilityRules>(DEFAULT_AVAILABILITY_RULES);
  const [selectedDoc, setSelectedDoc] = useState<SignedDocumentData | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [schedNote, setSchedNote] = useState('');
  const [minimizedNotes, setMinimizedNotes] = useState<Record<string, boolean>>({});
  const toggleNote = (id: string) => setMinimizedNotes((prev) => ({ ...prev, [id]: !prev[id] }));

  // Reschedule Appointment Modal State
  const [reschedulingAppt, setReschedulingAppt] = useState<AppointmentData | null>(null);
  const [reschedDate, setReschedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reschedTime, setReschedTime] = useState('09:00');
  const [reschedNotes, setReschedNotes] = useState('');
  const [reschedSubmitting, setReschedSubmitting] = useState(false);

  // Review states
  const [reviewingIntake, setReviewingIntake] = useState(false);
  const [revisionNotesInput, setRevisionNotesInput] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // Admin Schedule Appointment Modal State (Must be declared at top level before conditional returns)
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Portal Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    icon?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
    onCancel?: () => void;
    isAlertOnly?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));

  const executeBooking = async (
    startISO: string,
    endISO: string,
    schedType: any,
    schedFormat: any
  ) => {
    if (!client) return;
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
        notes: schedNote.trim() || undefined,
        priceInCents: schedType.priceInCents,
        syncStatus: 'pending'
      }, true);

      const appts = await getAppointments({ clientId: client.uid });
      setClientAppointments(appts);
      setShowScheduleModal(false);
      setSchedNote('');

      setConfirmModal({
        isOpen: true,
        title: '✓ Session Scheduled',
        message: `Appointment for ${client.legalFirstName} ${client.legalLastName} has been scheduled successfully!`,
        icon: '🗓️',
        confirmText: 'OK',
        variant: 'success',
        isAlertOnly: true,
        onConfirm: closeConfirmModal
      });
    } catch (err: any) {
      console.error("Booking error:", err);
    } finally {
      setSchedBooking(false);
    }
  };

  const [schedType, setSchedType] = useState<any>(null);
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
        if (r && r.appointmentTypes && r.appointmentTypes.length > 0) {
          setSchedType(r.appointmentTypes[0]);
        }
      } catch (err) {
        console.error("Failed to load client chart", err);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const handleSelfSchedulingOverrideChange = async (val: 'global' | 'allowed' | 'restricted') => {
    if (!client) return;
    try {
      await updateClientProfile(client.uid, { allowSelfSchedulingOverride: val }, user?.uid || '', role || '');
      setClient({ ...client, allowSelfSchedulingOverride: val });
    } catch (err) {
      console.error("Failed to update client self-scheduling permission", err);
      alert("Failed to update client self-scheduling permission.");
    }
  };

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
    if (!client) return;
    setReviewingIntake(true);
    try {
      await reviewIntakeSubmission(clientId, status, status === 'revision_requested' ? revisionNotesInput : undefined);
      await refreshIntake();
      setShowRevisionForm(false);
      
      setConfirmModal({
        isOpen: true,
        title: status === 'approved' ? '✓ Intake Approved' : '✏️ Revision Requested',
        message: status === 'approved'
          ? `Intake questionnaire for ${client.legalFirstName} ${client.legalLastName} has been approved.`
          : `Correction request sent to ${client.legalFirstName} ${client.legalLastName}.`,
        icon: status === 'approved' ? '✓' : '✏️',
        confirmText: 'OK',
        variant: status === 'approved' ? 'success' : 'warning',
        isAlertOnly: true,
        onConfirm: closeConfirmModal
      });
    } catch (err: any) {
      console.error(err);
      alert("Failed to update intake review status.");
    } finally {
      setReviewingIntake(false);
    }
  };

  const handleStatusChangeInChart = async (apptId: string, newStatus: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(apptId, newStatus);
      const updatedAppts = await getAppointments({ clientId });
      setClientAppointments(updatedAppts);
    } catch (err) {
      console.error("Failed to update appointment status", err);
      alert("Failed to update appointment status.");
    }
  };

  const handleRescheduleAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingAppt || !reschedulingAppt.id) return;
    setReschedSubmitting(true);
    try {
      const newStartISO = `${reschedDate}T${reschedTime}:00`;
      const currentStart = new Date(reschedulingAppt.startISO).getTime();
      const currentEnd = new Date(reschedulingAppt.endISO).getTime();
      const durationMs = currentEnd > currentStart ? currentEnd - currentStart : 50 * 60 * 1000;
      const newEndISO = new Date(new Date(newStartISO).getTime() + durationMs).toISOString();

      const docRef = doc(db, 'appointments', reschedulingAppt.id);
      await updateDoc(docRef, {
        startISO: newStartISO,
        endISO: newEndISO,
        status: 'rescheduled',
        notes: reschedNotes ? `${reschedulingAppt.notes ? reschedulingAppt.notes + '\n' : ''}Rescheduled: ${reschedNotes}` : reschedulingAppt.notes,
        updatedAt: serverTimestamp()
      });

      const updatedAppts = await getAppointments({ clientId });
      setClientAppointments(updatedAppts);
      setReschedulingAppt(null);
      setReschedNotes('');
      setConfirmModal({
        isOpen: true,
        title: '✓ Session Rescheduled',
        message: `Appointment for ${client?.legalFirstName} ${client?.legalLastName} has been rescheduled to ${new Date(newStartISO).toLocaleString()}.`,
        icon: '📅',
        confirmText: 'OK',
        variant: 'success',
        isAlertOnly: true,
        onConfirm: closeConfirmModal
      });
    } catch (err: any) {
      console.error("Reschedule error:", err);
      alert(err.message || "Failed to reschedule appointment.");
    } finally {
      setReschedSubmitting(false);
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
    { id: 'overview', label: 'Overview' },
    { id: 'contact', label: 'Contact Info' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'intake', label: 'Intake Packet' },
    { id: 'documents', label: 'Signed Docs' },
    { id: 'shared-notes', label: 'Shared Summaries' },
    { id: 'private-clinical-notes', label: 'Clinical Notes' },
    { id: 'billing', label: 'Billing' },
    { id: 'files', label: 'Insurance Docs' }
  ];

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !schedType) return;
    setSchedBooking(true);
    setSchedMessage(null);

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

    const startISO = `${schedDate}T${schedTime}:00`;
    const endISO = new Date(new Date(startISO).getTime() + (schedType?.durationMinutes || 50) * 60000).toISOString();

    if (availCheck.hasDoubleBooking) {
      setConfirmModal({
        isOpen: true,
        title: '⚠️ Double Booking Warning',
        message: 'The selected slot conflicts with another appointment in your calendar.',
        details: availCheck.doubleBookingReason,
        icon: '⚠️',
        confirmText: 'Override & Double Book',
        cancelText: 'Cancel & Change Slot',
        variant: 'warning',
        onConfirm: () => {
          closeConfirmModal();
          executeBooking(startISO, endISO, schedType, schedFormat);
        },
        onCancel: () => {
          closeConfirmModal();
          setSchedBooking(false);
        }
      });
      return;
    }

    if (availCheck.isOutsideHours) {
      setConfirmModal({
        isOpen: true,
        title: '⚠️ Outside Scheduled Hours Warning',
        message: 'The selected time falls outside of regular scheduled practice hours.',
        details: availCheck.outsideHoursReason,
        icon: '⚠️',
        confirmText: 'Override & Schedule',
        cancelText: 'Cancel & Change Slot',
        variant: 'warning',
        onConfirm: () => {
          closeConfirmModal();
          executeBooking(startISO, endISO, schedType, schedFormat);
        },
        onCancel: () => {
          closeConfirmModal();
          setSchedBooking(false);
        }
      });
      return;
    }

    executeBooking(startISO, endISO, schedType, schedFormat);
  };

  const upcomingAppts = clientAppointments.filter(
    (a) => a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled'
  );
  const pastAppts = clientAppointments.filter(
    (a) => a.status === 'completed' || a.status === 'canceled_by_client' || a.status === 'canceled_by_practice' || a.status === 'no_show'
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Client Summary */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print print:hidden">
        <div>
          <button onClick={onBack} className="text-xs text-[#BF5B33] hover:underline font-semibold mb-2 block min-h-[32px] flex items-center">
            ← Back to Directory
          </button>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#2C2A2A] font-medium">
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

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#4A5741]/10 text-[#4A5741] border border-[#4A5741]/20">
            Account Status: {client.accountStatus || 'Active'}
          </span>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm transition min-h-[42px] flex items-center justify-center"
          >
            + Schedule Appointment
          </button>
        </div>
      </div>

      {/* Chart Navigation Tabs */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-1.5 sm:p-2 shadow-sm overflow-x-auto no-scrollbar flex space-x-1 no-print print:hidden touch-scroll">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isPrivate = tab.id === 'private-clinical-notes';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 min-h-[40px] ${
                isActive
                  ? isPrivate
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-[#4A5741] text-white shadow-xs'
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

            {/* Administrative Portal Permissions */}
            <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741]">
                  ⚙️ Administrative Portal Permissions
                </h4>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                  client.allowSelfSchedulingOverride === 'allowed'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : client.allowSelfSchedulingOverride === 'restricted'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  Effective Status: {client.allowSelfSchedulingOverride === 'allowed' ? '✅ Allowed (Override)' : client.allowSelfSchedulingOverride === 'restricted' ? '🚫 Restricted (Override)' : `🌐 Inheriting Global Practice Policy (${rules.allowClientSelfScheduling !== false ? 'Allowed' : 'Disabled'})`}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-white p-4 rounded-xl border border-[#EAE1D2]">
                <div>
                  <label className="block text-xs font-semibold text-[#2C2A2A] mb-0.5">
                    Client Self-Scheduling Permission
                  </label>
                  <p className="text-[11px] text-[#2C2A2A]/70">
                    Optionally override the global "Allow Clients to Self-Schedule Appointments" setting for this client alone.
                  </p>
                </div>
                <div>
                  <select
                    value={client.allowSelfSchedulingOverride || 'global'}
                    onChange={(e) => handleSelfSchedulingOverrideChange(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A] font-semibold focus:ring-2 focus:ring-[#BF5B33] outline-none cursor-pointer"
                  >
                    <option value="global">🌐 Use Global Practice Setting (Default)</option>
                    <option value="allowed">✅ Always Allowed for this Client (Override)</option>
                    <option value="restricted">🚫 Always Restricted for this Client (Override)</option>
                  </select>
                </div>
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
              <h3 className="text-xl font-serif font-medium">Client Appointments & History</h3>
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
                  <div key={appt.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] flex flex-col gap-3 text-xs overflow-hidden break-words">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#2C2A2A]">{appt.appointmentTypeName}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            appt.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            appt.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {appt.status.replace(/_/g, ' ')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#4A5741]/10 text-[#4A5741] font-mono font-bold text-xs">
                            ${((appt.priceInCents || 15000) / 100).toFixed(2)}
                          </span>
                        </div>

                        <p className="text-xs text-gray-700 mt-1">
                          👤 <strong>Client:</strong> <span className="font-semibold text-[#BF5B33]">{client.legalFirstName} {client.legalLastName}</span> ({client.email}) ↗
                        </p>

                        <p className="text-xs text-gray-600 mt-0.5 font-mono">
                          Time: <strong>{new Date(appt.startISO).toLocaleString()}</strong> | Format: <strong className="capitalize">{appt.format}</strong> | Fee: <strong className="text-amber-800">${((appt.priceInCents || 15000) / 100).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EAE1D2]">
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: '✓ Mark Session Completed',
                              message: `Confirm completion of the ${appt.appointmentTypeName} session for ${client.legalFirstName} ${client.legalLastName}?`,
                              details: 'This will update the appointment status to completed and move it to past session history.',
                              icon: '✓',
                              confirmText: 'Yes, Mark Completed',
                              cancelText: 'Cancel',
                              variant: 'success',
                              onConfirm: () => {
                                closeConfirmModal();
                                handleStatusChangeInChart(appt.id!, 'completed');
                              },
                              onCancel: closeConfirmModal
                            });
                          }}
                          className="px-3 py-1.5 bg-[#4A5741] text-white font-semibold text-xs rounded-xl hover:bg-[#384232] transition min-h-[38px] flex items-center justify-center shadow-2xs"
                        >
                          ✓ Mark Completed
                        </button>
                        <button
                          onClick={() => {
                            setReschedulingAppt(appt);
                            setReschedDate(new Date(appt.startISO).toISOString().split('T')[0]);
                            const timeStr = new Date(appt.startISO).toTimeString().slice(0, 5);
                            setReschedTime(timeStr || '09:00');
                          }}
                          className="px-3 py-1.5 bg-[#BF5B33]/10 text-[#BF5B33] border border-[#BF5B33]/30 font-semibold text-xs rounded-xl hover:bg-[#BF5B33]/20 transition min-h-[38px] flex items-center justify-center"
                        >
                          📅 Reschedule
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: '🛑 Cancel Appointment',
                              message: `Are you sure you want to cancel the scheduled ${appt.appointmentTypeName} session for ${client.legalFirstName} ${client.legalLastName}?`,
                              icon: '🛑',
                              confirmText: 'Yes, Cancel Session',
                              cancelText: 'Keep Appointment',
                              variant: 'danger',
                              onConfirm: () => {
                                closeConfirmModal();
                                handleStatusChangeInChart(appt.id!, 'canceled_by_practice');
                              },
                              onCancel: closeConfirmModal
                            });
                          }}
                          className="px-3 py-1.5 border border-red-300 text-red-700 font-semibold text-xs rounded-xl hover:bg-red-50 transition min-h-[38px] flex items-center justify-center"
                        >
                          🛑 Cancel Session
                        </button>
                      </div>
                    </div>

                    {appt.notes && (
                      <div className="pt-2 border-t border-[#EAE1D2]/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#4A5741]">Appointment Note / Instructions:</span>
                          <button
                            type="button"
                            onClick={() => toggleNote(appt.id!)}
                            className="text-[11px] font-semibold text-[#BF5B33] hover:underline cursor-pointer"
                          >
                            {minimizedNotes[appt.id!] ? '📝 Open Note' : '✕ Close Note'}
                          </button>
                        </div>
                        {!minimizedNotes[appt.id!] && (
                          <div className="p-2.5 bg-white/90 rounded-lg border border-[#EAE1D2] text-xs italic text-[#2C2A2A] whitespace-pre-line">
                            {appt.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Historical Past Appointments */}
            <div className="space-y-3 pt-4 border-t border-[#EAE1D2]">
              <h4 className="text-xs font-semibold uppercase text-[#4A5741] tracking-wider">
                Past Session History ({pastAppts.length})
              </h4>
              {pastAppts.length === 0 ? (
                <div className="bg-[#F7F2E9] p-4 rounded-xl border border-[#EAE1D2] text-xs text-gray-600 text-center">
                  No historical completed or canceled appointments on record.
                </div>
              ) : (
                pastAppts.map((appt) => (
                  <div key={appt.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{appt.appointmentTypeName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          appt.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {appt.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[#2C2A2A]/70 text-[11px] mt-1 font-mono">
                        Time: {new Date(appt.startISO).toLocaleString()} | Format: {appt.format} | Fee: ${((appt.priceInCents || 15000) / 100).toFixed(2)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-gray-700">${((appt.priceInCents || 15000) / 100).toFixed(2)}</span>
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
                        className={`w-full text-left p-4 rounded-xl border text-xs transition flex flex-col gap-1 overflow-hidden break-words ${
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
                        <p className={`text-[10px] font-mono ${isSelected ? 'text-white/70' : 'text-[#2C2A2A]/50'} break-all`}>
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
                <p className="break-all"><strong>Email Address:</strong> {client.email}</p>
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

        {activeTab === 'billing' && (
          <div className="space-y-4">
            <LedgerManager targetClientId={client.uid} />
          </div>
        )}

        {activeTab !== 'overview' && activeTab !== 'contact' && activeTab !== 'files' && activeTab !== 'documents' && activeTab !== 'intake' && activeTab !== 'private-clinical-notes' && activeTab !== 'appointments' && activeTab !== 'billing' && (
          <div className="text-xs text-[#2C2A2A]/70">
            Active chart tab: <strong className="capitalize">{activeTab.replace('-', ' ')}</strong>. Functional module binder active.
          </div>
        )}
      </div>

      {/* Admin Reschedule Appointment Popup Modal */}
      {reschedulingAppt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-[#EAE1D2]">
            <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#2C2A2A]">
                  📅 Reschedule Session
                </h3>
                <p className="text-xs text-[#4A5741] font-medium">
                  {reschedulingAppt.appointmentTypeName} for {client.legalFirstName} {client.legalLastName}
                </p>
              </div>
              <button
                onClick={() => setReschedulingAppt(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleAppt} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  New Session Date
                </label>
                <input
                  type="date"
                  required
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  New Start Time Slot
                </label>
                <select
                  value={reschedTime}
                  onChange={(e) => setReschedTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium"
                >
                  {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Reason for Rescheduling (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reschedNotes}
                  onChange={(e) => setReschedNotes(e.target.value)}
                  placeholder="Note reason or requested schedule adjustment..."
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE1D2]">
                <button
                  type="button"
                  onClick={() => setReschedulingAppt(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reschedSubmitting}
                  className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {reschedSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Appointment Note / Comments (Optional)
                </label>
                <p className="text-[11px] text-[#4A5741] font-medium mb-1.5">
                  ℹ️ Note: Comments added here will be viewable by both the therapist and the client.
                </p>
                <textarea
                  rows={2}
                  value={schedNote}
                  onChange={(e) => setSchedNote(e.target.value)}
                  placeholder="Add session notes or topics viewable by both client & therapist..."
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A]"
                />
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

      {/* Portal Confirm Modal */}
      <PortalConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        icon={confirmModal.icon}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel || closeConfirmModal}
        isAlertOnly={confirmModal.isAlertOnly}
      />
    </div>
  );
};
