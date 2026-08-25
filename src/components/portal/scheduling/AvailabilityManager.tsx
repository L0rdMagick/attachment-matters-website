import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAvailabilityRules, saveAvailabilityRules } from '../../../lib/firebase/scheduling';
import type { AvailabilityRules, AppointmentType, EmailNotificationRules } from '../../../types/scheduling';
import { usePortalModal } from '../common/PortalModalContext';

type SettingsTab = 'hours' | 'types' | 'timezone' | 'permissions' | 'notifications';

export const AvailabilityManager: React.FC = () => {
  const { user } = useAuth();
  const { showConfirm, showAlert } = usePortalModal();
  const [rules, setRules] = useState<AvailabilityRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('hours');
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Add Custom Appointment Type Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeFeeUsd, setNewTypeFeeUsd] = useState('150.00');
  const [newTypeDuration, setNewTypeDuration] = useState(50);
  const [newTypeBufferBefore, setNewTypeBufferBefore] = useState(5);
  const [newTypeBufferAfter, setNewTypeBufferAfter] = useState(5);
  const [newTypeFormat, setNewTypeFormat] = useState<'either' | 'telehealth' | 'in_person'>('either');

  useEffect(() => {
    if (!user) return;
    async function loadRules() {
      try {
        const data = await getAvailabilityRules(user!.uid);
        setRules(data);
      } catch (err) {
        console.error("Failed to load availability rules", err);
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, [user]);

  const handleSaveSection = async (section: string, updatedRules?: AvailabilityRules) => {
    const targetRules = updatedRules || rules;
    if (!targetRules || !user) return;
    setSavingSection(section);

    try {
      await saveAvailabilityRules({ ...targetRules, therapistId: user.uid });
      const labels: Record<string, string> = {
        hours: 'Weekly Working Hours',
        types: 'Configured Appointment Types',
        timezone: 'Practice Timezone & Booking Lead Times',
        permissions: 'Client Permissions & Self-Scheduling Rules',
        notifications: 'Email Notification Preferences'
      };
      showAlert('✓ Saved Successfully', `${labels[section] || 'Settings'} have been updated and saved to practice configuration.`, 'success', '✓');
    } catch (err) {
      console.error(err);
      showAlert('⚠️ Save Error', 'Failed to save settings section. Please try again.', 'danger', '⚠️');
    } finally {
      setSavingSection(null);
    }
  };

  const updateWorkingDay = (day: string, field: 'enabled' | 'startTime' | 'endTime', val: any) => {
    if (!rules) return;
    setRules({
      ...rules,
      workingDays: {
        ...rules.workingDays,
        [day]: {
          ...rules.workingDays[day],
          [field]: val
        }
      }
    });
  };

  const updateAppointmentType = (index: number, field: keyof AppointmentType, val: any) => {
    if (!rules) return;
    const updated = [...rules.appointmentTypes];
    updated[index] = { ...updated[index], [field]: val };
    setRules({ ...rules, appointmentTypes: updated });
  };

  const toggleEmailNotification = (key: keyof EmailNotificationRules) => {
    if (!rules) return;
    const current = rules.emailNotifications || {
      appointmentBooked: true,
      appointmentRescheduled: true,
      appointmentCanceled: true,
      invoiceIssued: true,
      paymentReceived: true,
      intakeSubmitted: true,
      consentSigned: true
    };
    setRules({
      ...rules,
      emailNotifications: {
        ...current,
        [key]: !current[key]
      }
    });
  };

  const openAddAppointmentTypeModal = () => {
    setNewTypeName('');
    setNewTypeFeeUsd('150.00');
    setNewTypeDuration(50);
    setNewTypeBufferBefore(5);
    setNewTypeBufferAfter(5);
    setNewTypeFormat('either');
    setShowAddModal(true);
  };

  const handleConfirmAddAppointmentType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules) return;
    if (!newTypeName.trim()) {
      showAlert('⚠️ Title Required', 'Please enter a title for the new custom appointment type.', 'warning', '⚠️');
      return;
    }

    const feeInCents = Math.round(parseFloat(newTypeFeeUsd || '0') * 100);

    const newType: AppointmentType = {
      id: `custom_${Date.now()}`,
      name: newTypeName.trim(),
      durationMinutes: newTypeDuration,
      priceInCents: feeInCents,
      bufferBeforeMinutes: newTypeBufferBefore,
      bufferAfterMinutes: newTypeBufferAfter,
      format: newTypeFormat
    };

    const updatedRules: AvailabilityRules = {
      ...rules,
      appointmentTypes: [...rules.appointmentTypes, newType]
    };

    setRules(updatedRules);
    setShowAddModal(false);
    handleSaveSection('types', updatedRules);
  };

  const removeAppointmentType = (index: number) => {
    if (!rules) return;
    if (rules.appointmentTypes.length <= 1) {
      showAlert('⚠️ Cannot Delete', 'At least one appointment type must remain configured for practice booking.', 'warning', '⚠️');
      return;
    }

    const targetType = rules.appointmentTypes[index];

    showConfirm({
      title: '🗑️ Delete Appointment Type',
      message: `Are you sure you want to delete "${targetType.name}"?`,
      details: 'Clients will no longer be able to select or book this appointment type in the portal.',
      icon: '🗑️',
      confirmText: 'Yes, Delete Type',
      cancelText: 'Keep Type',
      variant: 'danger',
      onConfirm: () => {
        const updated = rules.appointmentTypes.filter((_, i) => i !== index);
        const updatedRules = { ...rules, appointmentTypes: updated };
        setRules(updatedRules);
        handleSaveSection('types', updatedRules);
      }
    });
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading practice settings...</div>;
  }

  if (!rules) return null;

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const emailNotifs = rules.emailNotifications || {
    appointmentBooked: true,
    appointmentRescheduled: true,
    appointmentCanceled: true,
    invoiceIssued: true,
    paymentReceived: true,
    intakeSubmitted: true,
    consentSigned: true
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Practice & Portal Settings</h2>
        <p className="text-xs text-[#2C2A2A]/70 mt-1">
          Manage practice working hours, appointment offerings, timezones, client permissions, and email notification triggers.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-[#EAE1D2] pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('hours')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'hours'
              ? 'bg-[#BF5B33] text-white shadow-sm'
              : 'bg-white border border-[#EAE1D2] text-[#2C2A2A] hover:bg-[#F7F2E9]'
          }`}
        >
          <span>🕒</span> Hours
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'types'
              ? 'bg-[#BF5B33] text-white shadow-sm'
              : 'bg-white border border-[#EAE1D2] text-[#2C2A2A] hover:bg-[#F7F2E9]'
          }`}
        >
          <span>🏷️</span> Appointment Types
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timezone')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'timezone'
              ? 'bg-[#BF5B33] text-white shadow-sm'
              : 'bg-white border border-[#EAE1D2] text-[#2C2A2A] hover:bg-[#F7F2E9]'
          }`}
        >
          <span>🌐</span> Timezone
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'permissions'
              ? 'bg-[#BF5B33] text-white shadow-sm'
              : 'bg-white border border-[#EAE1D2] text-[#2C2A2A] hover:bg-[#F7F2E9]'
          }`}
        >
          <span>🔒</span> Client Permissions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'bg-[#BF5B33] text-white shadow-sm'
              : 'bg-white border border-[#EAE1D2] text-[#2C2A2A] hover:bg-[#F7F2E9]'
          }`}
        >
          <span>✉️</span> Email Notifications
        </button>
      </div>

      {/* Tab 1: Hours */}
      {activeTab === 'hours' && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-[#EAE1D2] pb-3">
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium">Weekly Working Hours</h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-1">
              Enable the days of the week your practice is open and set operating hours for slot availability.
            </p>
          </div>

          <div className="space-y-3">
            {daysOfWeek.map((day) => {
              const config = rules.workingDays[day] || { enabled: false, startTime: '09:00', endTime: '17:00' };
              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2]">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateWorkingDay(day, 'enabled', e.target.checked)}
                      className="w-4 h-4 text-[#BF5B33] rounded accent-[#BF5B33] cursor-pointer"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#2C2A2A] w-28 capitalize">
                      {day}
                    </span>
                  </div>

                  {config.enabled ? (
                    <div className="flex items-center gap-2 text-xs text-[#2C2A2A]">
                      <span>Start:</span>
                      <input
                        type="time"
                        value={config.startTime}
                        onChange={(e) => updateWorkingDay(day, 'startTime', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white font-medium"
                      />
                      <span>End:</span>
                      <input
                        type="time"
                        value={config.endTime}
                        onChange={(e) => updateWorkingDay(day, 'endTime', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white font-medium"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-[#2C2A2A]/50 italic">Unavailable / Closed</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#EAE1D2] flex justify-end">
            <button
              type="button"
              disabled={savingSection === 'hours'}
              onClick={() => handleSaveSection('hours')}
              className="py-2.5 px-6 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingSection === 'hours' ? 'Saving Hours...' : '✓ Save Working Hours'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Appointment Types */}
      {activeTab === 'types' && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-3 gap-2">
            <div>
              <h3 className="text-xl font-serif text-[#2C2A2A] font-medium">
                Configured Appointment Types, Durations & Pricing
              </h3>
              <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                Customize session titles, pricing, durations, and buffer times available to clients and staff.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddAppointmentTypeModal}
              className="px-3.5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-xs transition w-fit flex items-center gap-1"
            >
              ➕ Add Custom Appointment Type
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.appointmentTypes.map((apt, index) => (
              <div key={apt.id || index} className="p-5 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] space-y-4 text-xs text-[#2C2A2A] shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-[#EAE1D2] pb-3">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Session Type Title</label>
                    <input
                      type="text"
                      value={apt.name}
                      onChange={(e) => updateAppointmentType(index, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-[#EAE1D2] bg-white font-serif text-sm font-semibold text-[#2C2A2A] focus:ring-2 focus:ring-[#BF5B33] outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAppointmentType(index)}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition mt-4"
                    title="Remove appointment type"
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Session Fee ($ USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(apt.priceInCents / 100).toString()}
                        onChange={(e) => updateAppointmentType(index, 'priceInCents', Math.round(parseFloat(e.target.value || '0') * 100))}
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-[#EAE1D2] bg-white font-bold text-sm text-[#BF5B33] focus:ring-2 focus:ring-[#BF5B33] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Duration (Minutes)</label>
                    <select
                      value={apt.durationMinutes}
                      onChange={(e) => updateAppointmentType(index, 'durationMinutes', parseInt(e.target.value) || 50)}
                      className="w-full px-3 py-1.5 rounded-xl border border-[#EAE1D2] bg-white font-semibold text-xs text-[#2C2A2A] focus:ring-2 focus:ring-[#BF5B33] outline-none"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={50}>50 Minutes (Standard)</option>
                      <option value={60}>60 Minutes (1 Hour)</option>
                      <option value={75}>75 Minutes</option>
                      <option value={90}>90 Minutes (Intake / Extended)</option>
                      <option value={120}>120 Minutes (2 Hours)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Buffer Before</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={apt.bufferBeforeMinutes}
                        onChange={(e) => updateAppointmentType(index, 'bufferBeforeMinutes', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white text-xs text-center font-semibold"
                      />
                      <span className="text-[10px] text-gray-600">min</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Buffer After</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={apt.bufferAfterMinutes}
                        onChange={(e) => updateAppointmentType(index, 'bufferAfterMinutes', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white text-xs text-center font-semibold"
                      />
                      <span className="text-[10px] text-gray-600">min</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Service Format</label>
                    <select
                      value={apt.format}
                      onChange={(e) => updateAppointmentType(index, 'format', e.target.value as any)}
                      className="w-full px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white text-[11px] font-semibold"
                    >
                      <option value="either">Either (Choice)</option>
                      <option value="telehealth">Telehealth Only</option>
                      <option value="in_person">In Person Only</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#EAE1D2] flex justify-end">
            <button
              type="button"
              disabled={savingSection === 'types'}
              onClick={() => handleSaveSection('types')}
              className="py-2.5 px-6 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingSection === 'types' ? 'Saving Appointment Types...' : '✓ Save Appointment Types'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Timezone */}
      {activeTab === 'timezone' && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#EAE1D2] pb-3">
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium">Practice Timezone & Lead Times</h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-1">
              Configure practice operating timezone and advance notice requirements for scheduling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs font-semibold uppercase text-[#2C2A2A]">
            <div>
              <label htmlFor="av-tz" className="block mb-2">Practice Timezone</label>
              <select
                id="av-tz"
                value={rules.timezone}
                onChange={(e) => setRules({ ...rules, timezone: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs normal-case bg-white"
              >
                <option value="America/Denver">America/Denver (Mountain MT)</option>
                <option value="America/Chicago">America/Chicago (Central CT)</option>
                <option value="America/New_York">America/New_York (Eastern ET)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (Pacific PT)</option>
                <option value="America/Anchorage">America/Anchorage (Alaska AK)</option>
                <option value="Pacific/Honolulu">Pacific/Honolulu (Hawaii HST)</option>
              </select>
            </div>

            <div>
              <label htmlFor="av-max-advance" className="block mb-2">
                Max Advance Booking (Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="av-max-advance"
                  type="number"
                  min={0}
                  max={100}
                  value={rules.maxAdvanceDays ?? 60}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                    setRules({ ...rules, maxAdvanceDays: val });
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
                  placeholder="e.g. 60"
                />
                <span className="text-[11px] text-[#2C2A2A]/70 normal-case whitespace-nowrap">Days</span>
              </div>
            </div>

            <div>
              <label htmlFor="av-notice-days" className="block mb-2">
                Min Booking Notice (Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="av-notice-days"
                  type="number"
                  min={0}
                  max={100}
                  value={Math.floor((rules.minNoticeHours || 24) / 24)}
                  onChange={(e) => {
                    const days = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                    setRules({ ...rules, minNoticeHours: days * 24 });
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
                  placeholder="e.g. 1"
                />
                <span className="text-[11px] text-[#2C2A2A]/70 normal-case whitespace-nowrap">
                  ({rules.minNoticeHours || 24} hrs)
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="av-cancel-days" className="block mb-2">
                Cancellation Deadline (Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="av-cancel-days"
                  type="number"
                  min={0}
                  max={100}
                  value={Math.floor((rules.cancellationNoticeHours || 24) / 24)}
                  onChange={(e) => {
                    const days = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                    setRules({ ...rules, cancellationNoticeHours: days * 24 });
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
                  placeholder="e.g. 1"
                />
                <span className="text-[11px] text-[#2C2A2A]/70 normal-case whitespace-nowrap">
                  ({rules.cancellationNoticeHours || 24} hrs)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#EAE1D2] flex justify-end">
            <button
              type="button"
              disabled={savingSection === 'timezone'}
              onClick={() => handleSaveSection('timezone')}
              className="py-2.5 px-6 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingSection === 'timezone' ? 'Saving Timezone...' : '✓ Save Timezone Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Client Permissions */}
      {activeTab === 'permissions' && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#EAE1D2] pb-3">
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium">Client Permissions & Self-Scheduling Rules</h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-1">
              Control client privileges for booking, rescheduling, and appointment approvals within the portal.
            </p>
          </div>

          <div className="space-y-4">
            {/* Allow Clients to Self-Schedule Appointments */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="av-self-sched" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  Allow Clients to Self-Schedule Appointments
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-1">
                  When enabled, clients can browse therapist open slots and book sessions directly in the portal. When disabled, only practice staff can schedule appointments.
                </p>
              </div>
              <input
                id="av-self-sched"
                type="checkbox"
                checked={rules.allowClientSelfScheduling ?? true}
                onChange={(e) => setRules({ ...rules, allowClientSelfScheduling: e.target.checked })}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Require Therapist Approval */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="av-req-approval" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  Require Therapist Approval for Client Bookings
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-1">
                  When enabled, client-booked appointments enter a "Requested" status until manually approved by practice staff.
                </p>
              </div>
              <input
                id="av-req-approval"
                type="checkbox"
                checked={rules.requireAppointmentApproval ?? false}
                onChange={(e) => setRules({ ...rules, requireAppointmentApproval: e.target.checked })}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#EAE1D2] flex justify-end">
            <button
              type="button"
              disabled={savingSection === 'permissions'}
              onClick={() => handleSaveSection('permissions')}
              className="py-2.5 px-6 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingSection === 'permissions' ? 'Saving Permissions...' : '✓ Save Client Permissions'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Email Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#EAE1D2] pb-3">
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium">Email Notification Preferences</h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-1">
              Check or uncheck individual notification triggers to disallow or allow email alerts to be sent.
            </p>
          </div>

          <div className="space-y-3">
            {/* Trigger 1: Appointment Booked */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-booked" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  📅 Appointment Booked
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send email confirmation to client and practice when a new session is scheduled.
                </p>
              </div>
              <input
                id="notif-booked"
                type="checkbox"
                checked={emailNotifs.appointmentBooked ?? true}
                onChange={() => toggleEmailNotification('appointmentBooked')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Trigger 2: Appointment Rescheduled */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-resched" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  🔄 Appointment Rescheduled
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send email notification showing original vs updated date/time when a session is moved.
                </p>
              </div>
              <input
                id="notif-resched"
                type="checkbox"
                checked={emailNotifs.appointmentRescheduled ?? true}
                onChange={() => toggleEmailNotification('appointmentRescheduled')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Trigger 3: Appointment Canceled */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-canceled" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  🛑 Appointment Canceled
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send immediate email notice when an appointment is canceled by client or staff.
                </p>
              </div>
              <input
                id="notif-canceled"
                type="checkbox"
                checked={emailNotifs.appointmentCanceled ?? true}
                onChange={() => toggleEmailNotification('appointmentCanceled')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Trigger 4: Invoice Issued */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-invoice" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  💳 New Invoice Issued / Fee Adjustment
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send email to client when a new bill or balance due change is posted.
                </p>
              </div>
              <input
                id="notif-invoice"
                type="checkbox"
                checked={emailNotifs.invoiceIssued ?? true}
                onChange={() => toggleEmailNotification('invoiceIssued')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Trigger 5: Payment Received */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-payment" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  🧾 Payment Received / Receipt
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send payment receipt to client and payment confirmation notice to practice.
                </p>
              </div>
              <input
                id="notif-payment"
                type="checkbox"
                checked={emailNotifs.paymentReceived ?? true}
                onChange={() => toggleEmailNotification('paymentReceived')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Trigger 6: Intake Submitted */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-intake" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  📝 Clinical Intake Submitted
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send email notice to practice staff when a client completes initial intake paperwork.
                </p>
              </div>
              <input
                id="notif-intake"
                type="checkbox"
                checked={emailNotifs.intakeSubmitted ?? true}
                onChange={() => toggleEmailNotification('intakeSubmitted')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>

            {/* Trigger 7: Consent Document Signed */}
            <div className="p-4 bg-[#F7F2E9] rounded-2xl border border-[#EAE1D2] flex items-center justify-between gap-4">
              <div>
                <label htmlFor="notif-consent" className="text-sm font-semibold text-[#2C2A2A] block cursor-pointer">
                  📄 Consent Agreement Signed
                </label>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Send confirmation email with audit record hash when a client signs a consent form or policy.
                </p>
              </div>
              <input
                id="notif-consent"
                type="checkbox"
                checked={emailNotifs.consentSigned ?? true}
                onChange={() => toggleEmailNotification('consentSigned')}
                className="w-5 h-5 text-[#BF5B33] rounded cursor-pointer accent-[#BF5B33]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#EAE1D2] flex justify-end">
            <button
              type="button"
              disabled={savingSection === 'notifications'}
              onClick={() => handleSaveSection('notifications')}
              className="py-2.5 px-6 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingSection === 'notifications' ? 'Saving Email Preferences...' : '✓ Save Email Notification Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Add Custom Appointment Type Overlay Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">➕</span>
                <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">Add Custom Appointment Type</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddAppointmentType} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Session Type Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Extended Couples Counseling Session"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] bg-white font-serif text-sm font-semibold text-[#2C2A2A] focus:ring-2 focus:ring-[#BF5B33] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Session Fee ($ USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newTypeFeeUsd}
                      onChange={(e) => setNewTypeFeeUsd(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#EAE1D2] bg-white font-bold text-sm text-[#BF5B33] focus:ring-2 focus:ring-[#BF5B33] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Duration (Minutes)</label>
                  <select
                    value={newTypeDuration}
                    onChange={(e) => setNewTypeDuration(parseInt(e.target.value) || 50)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EAE1D2] bg-white font-semibold text-xs text-[#2C2A2A] focus:ring-2 focus:ring-[#BF5B33] outline-none"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={50}>50 Minutes (Standard)</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={75}>75 Minutes</option>
                    <option value={90}>90 Minutes (Intake / Extended)</option>
                    <option value={120}>120 Minutes (2 Hours)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Buffer Before</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={newTypeBufferBefore}
                      onChange={(e) => setNewTypeBufferBefore(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-lg border border-[#EAE1D2] bg-white text-xs text-center font-semibold"
                    />
                    <span className="text-[10px] text-gray-600">min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Buffer After</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={newTypeBufferAfter}
                      onChange={(e) => setNewTypeBufferAfter(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-lg border border-[#EAE1D2] bg-white text-xs text-center font-semibold"
                    />
                    <span className="text-[10px] text-gray-600">min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">Service Format</label>
                  <select
                    value={newTypeFormat}
                    onChange={(e) => setNewTypeFormat(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#EAE1D2] bg-white text-[11px] font-semibold"
                  >
                    <option value="either">Either (Choice)</option>
                    <option value="telehealth">Telehealth Only</option>
                    <option value="in_person">In Person Only</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#EAE1D2]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#EAE1D2] hover:bg-[#e0d4c1] text-[#2C2A2A] font-semibold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1"
                >
                  Save Appointment Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
