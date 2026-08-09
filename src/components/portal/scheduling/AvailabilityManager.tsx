import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAvailabilityRules, saveAvailabilityRules } from '../../../lib/firebase/scheduling';
import type { AvailabilityRules, AppointmentType } from '../../../types/scheduling';

export const AvailabilityManager: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<AvailabilityRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules || !user) return;
    setSaving(true);
    setMessage(null);

    try {
      await saveAvailabilityRules({ ...rules, therapistId: user.uid });
      setMessage("Availability rules and appointment pricing saved successfully.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to save rules. Please try again.");
    } finally {
      setSaving(false);
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

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading therapist availability settings...</div>;
  }

  if (!rules) return null;

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="space-y-8 font-sans">
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Therapist Schedule & Working Hours</h2>
        <p className="text-xs text-[#2C2A2A]/70 mt-1">
          Configure working hours, session durations, pricing, and client self-booking policies.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-semibold">
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Working Hours by Day */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3">
            1. Weekly Working Hours
          </h3>

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
                      className="w-4 h-4 text-[#BF5B33] rounded"
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
                        className="px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white"
                      />
                      <span>End:</span>
                      <input
                        type="time"
                        value={config.endTime}
                        onChange={(e) => updateWorkingDay(day, 'endTime', e.target.value)}
                        className="px-2 py-1 rounded-lg border border-[#EAE1D2] bg-white"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-[#2C2A2A]/50 italic">Unavailable / Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Appointment Types & Pricing */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3">
            2. Configured Appointment Types & Pricing
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rules.appointmentTypes.map((apt) => (
              <div key={apt.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] space-y-2 text-xs text-[#2C2A2A]">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-sm font-serif text-[#2C2A2A]">{apt.name}</span>
                  <span className="text-[#BF5B33] font-bold">${(apt.priceInCents / 100).toFixed(2)}</span>
                </div>
                <p><strong>Duration:</strong> {apt.durationMinutes} mins | <strong>Buffers:</strong> {apt.bufferBeforeMinutes}m before / {apt.bufferAfterMinutes}m after</p>
                <p><strong>Format:</strong> <span className="capitalize">{apt.format}</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* Practice Timezone & Rules */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3">
            3. Practice Timezone & Booking Parameters (0 - 100 Days)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold uppercase text-[#2C2A2A]">
            <div>
              <label htmlFor="av-tz" className="block mb-1">Practice Timezone</label>
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
              <label htmlFor="av-max-advance" className="block mb-1">
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
                <span className="text-[11px] text-[#2C2A2A]/70 normal-case whitespace-nowrap">Days Ahead</span>
              </div>
            </div>

            <div>
              <label htmlFor="av-notice-days" className="block mb-1">
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
              <label htmlFor="av-cancel-days" className="block mb-1">
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
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="py-3.5 px-8 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {saving ? 'Saving Rules...' : 'Save Availability Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
