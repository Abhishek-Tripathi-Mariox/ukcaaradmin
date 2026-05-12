import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '@/services/api';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';
import { Settings, Car, Save, Lock } from 'lucide-react';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type TabType = 'fare' | 'general' | 'security';

export default function SettingsPage() {
  const [tab, setTab] = useState<TabType>('general');
  const queryClient = useQueryClient();

  const { data: fareConfig, isLoading: fareLoading, refetch: refetchFare, isFetching: fareFetching } = useQuery({
    queryKey: ['settings', 'fare'],
    queryFn: async () => {
      const res = await settingsAPI.getFareConfig();
      return res.data.data;
    },
  });

  const { data: generalSettings, isLoading: generalLoading, refetch: refetchGeneral } = useQuery({
    queryKey: ['settings', 'general'],
    queryFn: async () => {
      const res = await settingsAPI.getGeneral();
      return res.data.data;
    },
  });

  const [fareForm, setFareForm] = useState<any>(null);
  const [generalForm, setGeneralForm] = useState<any>(null);

  // Initialize forms when data loads
  if (fareConfig && !fareForm) {
    setFareForm(fareConfig);
  }
  if (generalSettings && !generalForm) {
    setGeneralForm(generalSettings);
  }

  const updateFareMutation = useMutation({
    mutationFn: (data: any) => settingsAPI.updateFareConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'fare'] });
      toast.success('Fare settings updated');
    },
    onError: () => toast.error('Failed to update fare settings'),
  });

  const updateGeneralMutation = useMutation({
    mutationFn: (data: any) => settingsAPI.updateGeneral(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'general'] });
      toast.success('General settings updated');
    },
    onError: () => toast.error('Failed to update settings'),
  });

  const vehicleTypes = ['standard', 'comfort', 'xl'];

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure application settings"
        actions={
          <RefreshButton
            onRefresh={() => { refetchFare(); refetchGeneral(); }}
            isFetching={fareFetching}
          />
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          // { key: 'fare', label: 'Fare Configuration', icon: DollarSign },
          { key: 'general', label: 'General Settings', icon: Settings },
          { key: 'security', label: 'Security', icon: Lock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as TabType)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Fare Configuration Tab */}
      {tab === 'fare' && (
        fareLoading || !fareForm ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid gap-8">
              {/* Base Fare */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Base Fare (₹)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {vehicleTypes.map((type) => (
                    <div key={type}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {type}
                      </label>
                      <input
                        type="number"
                        value={fareForm.baseFare?.[type] || 0}
                        onChange={(e) =>
                          setFareForm({
                            ...fareForm,
                            baseFare: { ...fareForm.baseFare, [type]: Number(e.target.value) },
                          })
                        }
                        className="input"
                        step="0.01"
                        min={0}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Per Mile */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Per Km (₹)</h3>
                <div className="grid grid-cols-3 gap-4">
                  {vehicleTypes.map((type) => (
                    <div key={type}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {type}
                      </label>
                      <input
                        type="number"
                        value={fareForm.perMile?.[type] || 0}
                        onChange={(e) =>
                          setFareForm({
                            ...fareForm,
                            perMile: { ...fareForm.perMile, [type]: Number(e.target.value) },
                          })
                        }
                        className="input"
                        step="0.01"
                        min={0}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Per Minute */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Per Minute (₹)</h3>
                <div className="grid grid-cols-3 gap-4">
                  {vehicleTypes.map((type) => (
                    <div key={type}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {type}
                      </label>
                      <input
                        type="number"
                        value={fareForm.perMinute?.[type] || 0}
                        onChange={(e) =>
                          setFareForm({
                            ...fareForm,
                            perMinute: { ...fareForm.perMinute, [type]: Number(e.target.value) },
                          })
                        }
                        className="input"
                        step="0.01"
                        min={0}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimum Fare */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Minimum Fare (₹)</h3>
                <div className="grid grid-cols-3 gap-4">
                  {vehicleTypes.map((type) => (
                    <div key={type}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {type}
                      </label>
                      <input
                        type="number"
                        value={fareForm.minimumFare?.[type] || 0}
                        onChange={(e) =>
                          setFareForm({
                            ...fareForm,
                            minimumFare: { ...fareForm.minimumFare, [type]: Number(e.target.value) },
                          })
                        }
                        className="input"
                        step="0.01"
                        min={0}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Fees */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Other Fees</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cancellation Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={fareForm.cancellationFee || 0}
                      onChange={(e) =>
                        setFareForm({ ...fareForm, cancellationFee: Number(e.target.value) })
                      }
                      className="input"
                      step="0.01"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Booking Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={fareForm.bookingFee || 0}
                      onChange={(e) =>
                        setFareForm({ ...fareForm, bookingFee: Number(e.target.value) })
                      }
                      className="input"
                      step="0.01"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Surge Multipliers */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Surge Multipliers</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Low Demand
                    </label>
                    <input
                      type="number"
                      value={fareForm.surgeMultipliers?.low || 1}
                      onChange={(e) =>
                        setFareForm({
                          ...fareForm,
                          surgeMultipliers: {
                            ...fareForm.surgeMultipliers,
                            low: Number(e.target.value),
                          },
                        })
                      }
                      className="input"
                      step="0.1"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Medium Demand
                    </label>
                    <input
                      type="number"
                      value={fareForm.surgeMultipliers?.medium || 1.25}
                      onChange={(e) =>
                        setFareForm({
                          ...fareForm,
                          surgeMultipliers: {
                            ...fareForm.surgeMultipliers,
                            medium: Number(e.target.value),
                          },
                        })
                      }
                      className="input"
                      step="0.1"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      High Demand
                    </label>
                    <input
                      type="number"
                      value={fareForm.surgeMultipliers?.high || 1.5}
                      onChange={(e) =>
                        setFareForm({
                          ...fareForm,
                          surgeMultipliers: {
                            ...fareForm.surgeMultipliers,
                            high: Number(e.target.value),
                          },
                        })
                      }
                      className="input"
                      step="0.1"
                      min={1}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => updateFareMutation.mutate(fareForm)}
                className="btn btn-primary w-full"
                disabled={updateFareMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateFareMutation.isPending ? 'Saving...' : 'Save Fare Configuration'}
              </button>
            </div>
          </div>
        )
      )}

      {/* General Settings Tab */}
      {tab === 'general' && (
        generalLoading || !generalForm ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App Name
                </label>
                <input
                  type="text"
                  value={generalForm.appName || ''}
                  onChange={(e) => setGeneralForm({ ...generalForm, appName: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  value={generalForm.supportEmail || ''}
                  onChange={(e) => setGeneralForm({ ...generalForm, supportEmail: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Support Phone
                </label>
                <input
                  type="text"
                  value={generalForm.supportPhone || ''}
                  onChange={(e) => setGeneralForm({ ...generalForm, supportPhone: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Search Radius (km)
                </label>
                <input
                  type="number"
                  value={generalForm.maxSearchRadius || 10}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, maxSearchRadius: Number(e.target.value) })
                  }
                  className="input"
                  min={1}
                  max={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Driver Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={generalForm.driverTimeout || 30}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, driverTimeout: Number(e.target.value) })
                  }
                  className="input"
                  min={10}
                  max={120}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">Maintenance Mode</div>
                  <div className="text-sm text-gray-500">
                    Disable app access for users during maintenance
                  </div>
                </div>
                <button
                  onClick={() =>
                    setGeneralForm({
                      ...generalForm,
                      maintenanceMode: !generalForm.maintenanceMode,
                    })
                  }
                  className={clsx(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                    generalForm.maintenanceMode ? 'bg-red-600' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={clsx(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      generalForm.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              <button
                onClick={() => updateGeneralMutation.mutate(generalForm)}
                className="btn btn-primary w-full"
                disabled={updateGeneralMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateGeneralMutation.isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )
      )}

      {tab === 'security' && <ChangePasswordCard />}
    </div>
  );
}
