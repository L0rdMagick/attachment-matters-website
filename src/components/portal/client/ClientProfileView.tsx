import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getClientProfile, updateClientProfile, uploadInsuranceCard, deleteInsuranceCard } from '../../../lib/firebase/clients';
import type { ClientProfileData } from '../../../types/client';
import { usePortalModal } from '../common/PortalModalContext';

export const ClientProfileView: React.FC = () => {
  const { user, role } = useAuth();
  const { showConfirm } = usePortalModal();
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [legalFirstName, setLegalFirstName] = useState('');
  const [legalMiddleName, setLegalMiddleName] = useState('');
  const [legalLastName, setLegalLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [dob, setDob] = useState('');

  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const [primaryPhone, setPrimaryPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'email' | 'phone' | 'sms'>('email');
  const [emailConsent, setEmailConsent] = useState(true);
  const [smsConsent, setSmsConsent] = useState(false);
  const [voicemailConsent, setVoicemailConsent] = useState(true);

  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [primaryCareProvider, setPrimaryCareProvider] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [preferredFormat, setPreferredFormat] = useState<'in_person' | 'telehealth' | 'either'>('telehealth');
  const [accessibilityRequests, setAccessibilityRequests] = useState('');
  const [preferredPharmacy, setPreferredPharmacy] = useState('');

  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [subscriberName, setSubscriberName] = useState('');

  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const data = await getClientProfile(user!.uid);
        if (data) {
          setProfile(data);
          setLegalFirstName(data.legalFirstName || '');
          setLegalMiddleName(data.legalMiddleName || '');
          setLegalLastName(data.legalLastName || '');
          setPreferredName(data.preferredName || '');
          setPronouns(data.pronouns || '');
          setDob(data.dob || '');

          if (data.address) {
            setStreet(data.address.street || '');
            setUnit(data.address.unit || '');
            setCity(data.address.city || '');
            setState(data.address.state || '');
            setZip(data.address.zip || '');
          }

          setPrimaryPhone(data.primaryPhone || '');
          setAlternatePhone(data.alternatePhone || '');
          setPreferredContactMethod(data.preferredContactMethod || 'email');
          if (data.communicationConsent) {
            setEmailConsent(data.communicationConsent.emailConsent);
            setSmsConsent(data.communicationConsent.smsConsent);
            setVoicemailConsent(data.communicationConsent.voicemailConsent);
          }

          if (data.emergencyContact) {
            setEmergencyName(data.emergencyContact.name || '');
            setEmergencyRelationship(data.emergencyContact.relationship || '');
            setEmergencyPhone(data.emergencyContact.phone || '');
          }

          setPrimaryCareProvider(data.primaryCareProvider || '');
          setReferralSource(data.referralSource || '');
          setPreferredFormat(data.preferredFormat || 'telehealth');
          setAccessibilityRequests(data.accessibilityRequests || '');
          setPreferredPharmacy(data.preferredPharmacy || '');

          if (data.insuranceInfo) {
            setInsuranceProvider(data.insuranceInfo.provider || '');
            setPolicyNumber(data.insuranceInfo.policyNumber || '');
            setGroupNumber(data.insuranceInfo.groupNumber || '');
            setSubscriberName(data.insuranceInfo.subscriberName || '');
          }
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in as a client to save profile changes.' });
      return;
    }
    setSaving(true);
    setMessage(null);

    const updatedData: Partial<ClientProfileData> = {
      legalFirstName,
      legalMiddleName,
      legalLastName,
      preferredName,
      pronouns,
      dob,
      address: { street, unit, city, state, zip },
      primaryPhone,
      alternatePhone,
      preferredContactMethod,
      communicationConsent: { emailConsent, smsConsent, voicemailConsent },
      emergencyContact: { name: emergencyName, relationship: emergencyRelationship, phone: emergencyPhone },
      primaryCareProvider,
      referralSource,
      preferredFormat,
      accessibilityRequests,
      preferredPharmacy,
      insuranceInfo: {
        provider: insuranceProvider,
        policyNumber,
        groupNumber,
        subscriberName
      }
    };

    try {
      await updateClientProfile(user.uid, updatedData, user.uid, role);
      setMessage({ type: 'success', text: 'Profile updated successfully and recorded in audit history.' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to update profile. Please check your information.' });
    } finally {
      setSaving(false);
    }
  };

  const handleInsuranceUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const downloadUrl = await uploadInsuranceCard(user.uid, file, side);
      setProfile((prev) => ({
        ...(prev || {
          uid: user.uid,
          legalFirstName: legalFirstName || 'Client',
          legalLastName: legalLastName || '',
          email: user.email || '',
          accountStatus: 'active',
          intakeStatus: 'not_started',
          consentStatus: 'pending'
        }),
        [side === 'front' ? 'insuranceCardFrontPath' : 'insuranceCardBackPath']: downloadUrl
      }));
      setMessage({ type: 'success', text: `Insurance card (${side}) uploaded and saved successfully.` });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Failed to upload insurance card (${side}). ${err.message || ''}` });
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleInsuranceDelete = (side: 'front' | 'back') => {
    if (!user) return;
    showConfirm({
      title: `🗑️ Remove Insurance Card (${side.toUpperCase()})`,
      message: `Are you sure you want to delete your uploaded ${side} insurance card image file?`,
      icon: '🗑️',
      confirmText: 'Yes, Delete Image',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInsuranceCard(user.uid, side);
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  [side === 'front' ? 'insuranceCardFrontPath' : 'insuranceCardBackPath']: undefined
                }
              : null
          );
          setMessage({ type: 'success', text: `Insurance card (${side}) removed successfully.` });
        } catch (err: any) {
          console.error(err);
          setMessage({ type: 'error', text: `Failed to remove insurance card (${side}).` });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-8 text-center text-[#2C2A2A]">
        Loading client profile...
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header card */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs bg-[#4A5741]/10 text-[#4A5741] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Client Profile & Preferences
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#2C2A2A] mt-2">
            {profile?.preferredName ? `${profile.preferredName} (${profile.legalFirstName} ${profile.legalLastName})` : `${legalFirstName} ${legalLastName}`}
          </h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Status: <span className="font-semibold text-[#4A5741] capitalize">{profile?.accountStatus || 'Active'}</span> | Assigned Therapist:{' '}
            <span className="font-semibold text-[#2C2A2A]">{profile?.assignedTherapistName || 'Unassigned (Pending Review)'}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-xl font-semibold border ${profile?.intakeStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            Intake: {profile?.intakeStatus ? profile.intakeStatus.replace('_', ' ') : 'Pending'}
          </span>
          <span className={`text-xs px-3 py-1.5 rounded-xl font-semibold border ${profile?.consentStatus === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            Consent: {profile?.consentStatus || 'Pending'}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm border font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal Details Section */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-[#2C2A2A] mb-4 border-b border-[#EAE1D2] pb-3">
            1. Personal Demographics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold uppercase text-[#2C2A2A]">
            <div>
              <label htmlFor="pf-legalFirst" className="block mb-1">
                Legal First Name <span className="text-[#BF5B33]">* Required</span>
              </label>
              <input
                id="pf-legalFirst"
                type="text"
                required
                value={legalFirstName}
                onChange={(e) => setLegalFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-legalMiddle" className="block mb-1">
                Legal Middle Name <span className="text-[#2C2A2A]/50">(Optional)</span>
              </label>
              <input
                id="pf-legalMiddle"
                type="text"
                value={legalMiddleName}
                onChange={(e) => setLegalMiddleName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-legalLast" className="block mb-1">
                Legal Last Name <span className="text-[#BF5B33]">* Required</span>
              </label>
              <input
                id="pf-legalLast"
                type="text"
                required
                value={legalLastName}
                onChange={(e) => setLegalLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>

            <div>
              <label htmlFor="pf-prefName" className="block mb-1">
                Preferred Name <span className="text-[#2C2A2A]/50">(Optional)</span>
              </label>
              <input
                id="pf-prefName"
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
                placeholder="Name you go by"
              />
            </div>

            <div>
              <label htmlFor="pf-pronouns" className="block mb-1">
                Pronouns <span className="text-[#2C2A2A]/50">(Optional)</span>
              </label>
              <input
                id="pf-pronouns"
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
                placeholder="she/her, they/them, etc."
              />
            </div>

            <div>
              <label htmlFor="pf-dob" className="block mb-1">
                Date of Birth <span className="text-[#BF5B33]">* Required</span>
              </label>
              <input
                id="pf-dob"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Address & Contact Section */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-[#2C2A2A] mb-4 border-b border-[#EAE1D2] pb-3">
            2. Address & Communication Preferences
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold uppercase text-[#2C2A2A] mb-4">
            <div className="sm:col-span-2">
              <label htmlFor="pf-street" className="block mb-1">Street Address</label>
              <input
                id="pf-street"
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-unit" className="block mb-1">Apt / Suite</label>
              <input
                id="pf-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-city" className="block mb-1">City</label>
              <input
                id="pf-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-state" className="block mb-1">State</label>
              <input
                id="pf-state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-zip" className="block mb-1">Zip Code</label>
              <input
                id="pf-zip"
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold uppercase text-[#2C2A2A] border-t border-[#EAE1D2] pt-4">
            <div>
              <label htmlFor="pf-primaryPhone" className="block mb-1">Primary Phone</label>
              <input
                id="pf-primaryPhone"
                type="tel"
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-altPhone" className="block mb-1">Alternate Phone</label>
              <input
                id="pf-altPhone"
                type="tel"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-prefMethod" className="block mb-1">Preferred Contact Method</label>
              <select
                id="pf-prefMethod"
                value={preferredContactMethod}
                onChange={(e) => setPreferredContactMethod(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none bg-white"
              >
                <option value="email">Email</option>
                <option value="phone">Phone Call</option>
                <option value="sms">SMS Text</option>
              </select>
            </div>
          </div>

          {/* Communication consents */}
          <div className="mt-4 pt-4 border-t border-[#EAE1D2]/60 space-y-3 normal-case font-normal text-sm text-[#2C2A2A] bg-[#F7F2E9]/60 p-4 rounded-xl border border-[#EAE1D2]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5741]">Consent Permissions</p>
              <span className="text-[11px] text-[#4A5741] italic">Saves with profile update</span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-[#EAE1D2]">
              <div className="flex items-center gap-3">
                <input
                  id="consent-email"
                  type="checkbox"
                  checked={emailConsent}
                  onChange={(e) => setEmailConsent(e.target.checked)}
                  className="w-4 h-4 text-[#BF5B33] rounded focus:ring-[#BF5B33]"
                />
                <label htmlFor="consent-email" className="cursor-pointer text-xs font-medium">
                  I consent to receiving email notifications regarding appointments and portal updates.
                </label>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                emailConsent ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}>
                {emailConsent ? '✓ Approved' : '✗ Not Approved'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-[#EAE1D2]">
              <div className="flex items-center gap-3">
                <input
                  id="consent-sms"
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="w-4 h-4 text-[#BF5B33] rounded focus:ring-[#BF5B33]"
                />
                <label htmlFor="consent-sms" className="cursor-pointer text-xs font-medium">
                  I consent to receiving SMS appointment reminders.
                </label>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                smsConsent ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}>
                {smsConsent ? '✓ Approved' : '✗ Not Approved'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-[#EAE1D2]">
              <div className="flex items-center gap-3">
                <input
                  id="consent-vm"
                  type="checkbox"
                  checked={voicemailConsent}
                  onChange={(e) => setVoicemailConsent(e.target.checked)}
                  className="w-4 h-4 text-[#BF5B33] rounded focus:ring-[#BF5B33]"
                />
                <label htmlFor="consent-vm" className="cursor-pointer text-xs font-medium">
                  Practice staff may leave confidential voicemails on my primary phone number.
                </label>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                voicemailConsent ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}>
                {voicemailConsent ? '✓ Approved' : '✗ Not Approved'}
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-[#2C2A2A] mb-4 border-b border-[#EAE1D2] pb-3">
            3. Emergency Contact <span className="text-[#BF5B33] text-xs font-sans font-semibold uppercase">* Required</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold uppercase text-[#2C2A2A]">
            <div>
              <label htmlFor="pf-emergName" className="block mb-1">Contact Name</label>
              <input
                id="pf-emergName"
                type="text"
                required
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-emergRel" className="block mb-1">Relationship</label>
              <input
                id="pf-emergRel"
                type="text"
                required
                value={emergencyRelationship}
                onChange={(e) => setEmergencyRelationship(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
                placeholder="Spouse, Parent, Friend"
              />
            </div>
            <div>
              <label htmlFor="pf-emergPhone" className="block mb-1">Contact Phone</label>
              <input
                id="pf-emergPhone"
                type="tel"
                required
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Healthcare & Format Preferences */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-[#2C2A2A] mb-4 border-b border-[#EAE1D2] pb-3">
            4. Clinical & Practice Preferences
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold uppercase text-[#2C2A2A]">
            <div>
              <label htmlFor="pf-pcp" className="block mb-1">Primary Care Provider</label>
              <input
                id="pf-pcp"
                type="text"
                value={primaryCareProvider}
                onChange={(e) => setPrimaryCareProvider(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
                placeholder="Dr. Name / Clinic"
              />
            </div>
            <div>
              <label htmlFor="pf-format" className="block mb-1">Preferred Appointment Format</label>
              <select
                id="pf-format"
                value={preferredFormat}
                onChange={(e) => setPreferredFormat(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none bg-white"
              >
                <option value="telehealth">Telehealth (Video)</option>
                <option value="in_person">In Person (Office)</option>
                <option value="either">Either / Flexible</option>
              </select>
            </div>
            <div>
              <label htmlFor="pf-[#pharmacy]" className="block mb-1">Preferred Pharmacy</label>
              <input
                id="pf-pharmacy"
                type="text"
                value={preferredPharmacy}
                onChange={(e) => setPreferredPharmacy(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
                placeholder="Pharmacy name & address"
              />
            </div>
          </div>

          <div className="mt-4 text-xs font-semibold uppercase text-[#2C2A2A]">
            <label htmlFor="pf-[#access]" className="block mb-1">Accessibility / Accommodation Requests</label>
            <textarea
              id="pf-access"
              rows={2}
              value={accessibilityRequests}
              onChange={(e) => setAccessibilityRequests(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              placeholder="Any mobility, sensory, language, or technical accommodations..."
            />
          </div>
        </div>

        {/* Insurance Information */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-[#2C2A2A] mb-4 border-b border-[#EAE1D2] pb-3">
            5. Insurance Information (Optional)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold uppercase text-[#2C2A2A] mb-6">
            <div>
              <label htmlFor="pf-[#insProv]" className="block mb-1">Insurance Provider</label>
              <input
                id="pf-insProv"
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
                placeholder="e.g. Blue Cross Blue Shield"
              />
            </div>
            <div>
              <label htmlFor="pf-[#subName]" className="block mb-1">Subscriber Name</label>
              <input
                id="pf-subName"
                type="text"
                value={subscriberName}
                onChange={(e) => setSubscriberName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-[#policyNum]" className="block mb-1">Member / Policy ID</label>
              <input
                id="pf-policyNum"
                type="text"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
            <div>
              <label htmlFor="pf-[#groupNum]" className="block mb-1">Group Number</label>
              <input
                id="pf-groupNum"
                type="text"
                value={groupNumber}
                onChange={(e) => setGroupNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              />
            </div>
          </div>

          {/* Insurance Card Uploads & File Management */}
          <div className="border-t border-[#EAE1D2] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Front Card */}
            <div className="bg-[#F7F2E9]/60 p-4 rounded-xl border border-[#EAE1D2]">
              <p className="text-xs font-semibold uppercase text-[#4A5741] mb-2">Insurance Card (Front)</p>
              {profile?.insuranceCardFrontPath ? (
                <div className="space-y-3 mb-3">
                  <img
                    src={profile.insuranceCardFrontPath}
                    alt="Insurance Card Front"
                    className="w-full h-40 object-cover rounded-xl border border-[#EAE1D2] bg-white"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={profile.insuranceCardFrontPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[#4A5741] hover:text-[#BF5B33] underline flex items-center gap-1"
                    >
                      📥 Download / View File ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => handleInsuranceDelete('front')}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 bg-red-50 rounded-lg border border-red-200"
                    >
                      🗑️ Delete File
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#2C2A2A]/60 italic mb-3">No front card uploaded yet.</p>
              )}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#2C2A2A]/70 uppercase">
                  {profile?.insuranceCardFrontPath ? 'Replace Front Card:' : 'Upload Front Card:'}
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleInsuranceUpload(e, 'front')}
                  className="text-xs text-[#2C2A2A] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#BF5B33] file:text-white hover:file:bg-[#a64e2b]"
                  disabled={uploadingFront}
                />
                {uploadingFront && <p className="text-xs text-[#BF5B33] mt-1 animate-pulse">Uploading and saving front file...</p>}
              </div>
            </div>

            {/* Back Card */}
            <div className="bg-[#F7F2E9]/60 p-4 rounded-xl border border-[#EAE1D2]">
              <p className="text-xs font-semibold uppercase text-[#4A5741] mb-2">Insurance Card (Back)</p>
              {profile?.insuranceCardBackPath ? (
                <div className="space-y-3 mb-3">
                  <img
                    src={profile.insuranceCardBackPath}
                    alt="Insurance Card Back"
                    className="w-full h-40 object-cover rounded-xl border border-[#EAE1D2] bg-white"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={profile.insuranceCardBackPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[#4A5741] hover:text-[#BF5B33] underline flex items-center gap-1"
                    >
                      📥 Download / View File ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => handleInsuranceDelete('back')}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 bg-red-50 rounded-lg border border-red-200"
                    >
                      🗑️ Delete File
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#2C2A2A]/60 italic mb-3">No back card uploaded yet.</p>
              )}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#2C2A2A]/70 uppercase">
                  {profile?.insuranceCardBackPath ? 'Replace Back Card:' : 'Upload Back Card:'}
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleInsuranceUpload(e, 'back')}
                  className="text-xs text-[#2C2A2A] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#BF5B33] file:text-white hover:file:bg-[#a64e2b]"
                  disabled={uploadingBack}
                />
                {uploadingBack && <p className="text-xs text-[#BF5B33] mt-1 animate-pulse">Uploading and saving back file...</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Form submit button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto py-3.5 px-8 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm transition disabled:opacity-50 min-h-[44px] flex items-center justify-center"
          >
            {saving ? 'Saving & Logging Audit Event...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
