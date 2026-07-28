import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Save, RotateCcw, ChevronDown, ChevronUp, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsAPI, vehicleTypesAPI, type CatalogueType } from '@/services/api';
import { PageHeader, LoadingSpinner, RefreshButton } from '@/components/common';

// ── Types ──────────────────────────────────────────────────────────────────────

// Pricing model: distance-based (per-km) or a flat subscription fare per ride
// (used for two/three-wheelers — bike/auto). For subscription the rider always
// pays `flatFare` regardless of distance/time.
type PricingModel = 'per_km' | 'subscription';

interface VehicleFareConfig {
  pricingModel: PricingModel;
  flatFare: number;  // flat fare per ride when pricingModel === 'subscription'
  base: number;      // base fare (flat charge at trip start)
  perKm: number;     // rate per kilometre
  perMin: number;    // rate per minute
  minFare: number;   // minimum billable fare
}

interface FareSettings {
  baseFares: Record<string, VehicleFareConfig>;
  commission: number;        // platform commission fraction (0–1)
  cancellationFee: number;
  minFare: number;
}

const DEFAULT_CONFIG: VehicleFareConfig = {
  pricingModel: 'per_km',
  flatFare: 0,
  base: 30,
  perKm: 12,
  perMin: 1.5,
  minFare: 40,
};

// ── Helper ────────────────────────────────────────────────────────────────────

// Surge is intentionally excluded: it is resolved per-zone at booking time,
// so the preview matches the pre-surge fare riders are quoted.
function calcFare(cfg: VehicleFareConfig, km: number, minutes: number): number {
  if (cfg.pricingModel === 'subscription') return cfg.flatFare;
  const raw = cfg.base + cfg.perKm * km + cfg.perMin * minutes;
  return Math.max(cfg.minFare, raw);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NumInput({
  value,
  onChange,
  min = 0,
  max,
  step = 0.5,
  className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [text, setText] = useState<string>(String(value ?? 0));
  const [prevVal, setPrevVal] = useState<number>(value);

  if (value !== prevVal) {
    setPrevVal(value);
    setText(String(value ?? 0));
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) {
          onChange(parsed);
        } else if (e.target.value === '') {
          onChange(0);
        }
      }}
      onBlur={() => {
        const parsed = parseFloat(text);
        const finalVal = isNaN(parsed) ? 0 : parsed;
        setText(String(finalVal));
        onChange(finalVal);
      }}
      className={className}
    />
  );
}

function FareRow({
  label,
  field,
  value,
  onChange,
  prefix,
  step,
}: {
  label: string;
  field: keyof VehicleFareConfig;
  value: number;
  onChange: (f: keyof VehicleFareConfig, v: number) => void;
  prefix?: string;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-36 text-sm text-gray-600 shrink-0">{label}</label>
      <div className="relative flex-1">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {prefix}
          </span>
        )}
        <NumInput
          min={0}
          step={step ?? 0.5}
          value={value}
          onChange={(v) => onChange(field, v)}
          className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-3 ${
            prefix ? 'pl-7' : 'pl-3'
          }`}
        />
      </div>
    </div>
  );
}

function VehicleCard({
  name,
  code,
  config,
  onChange,
}: {
  name: string;
  code: string;
  config: VehicleFareConfig;
  onChange: (code: string, updated: VehicleFareConfig) => void;
}) {
  const [open, setOpen] = useState(true);

  function handleField(field: keyof VehicleFareConfig, val: number) {
    onChange(code, { ...config, [field]: val });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
            <Car className="w-4 h-4 text-primary-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">{name}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">{code}</div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
          {/* Pricing model selector — per-km (distance based) vs subscription
              (flat fare per ride, for two/three-wheelers). */}
          <div className="flex items-center gap-3">
            <label className="w-36 text-sm text-gray-600 shrink-0">Pricing Model</label>
            <select
              value={config.pricingModel}
              onChange={(e) =>
                onChange(code, { ...config, pricingModel: e.target.value as PricingModel })
              }
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="per_km">Per-km (distance based)</option>
              <option value="subscription">Subscription (flat fare per ride)</option>
            </select>
          </div>

          {config.pricingModel === 'subscription' ? (
            <>
              <FareRow label="Flat Fare" field="flatFare" value={config.flatFare} onChange={handleField} prefix="₹" />
              <p className="text-xs text-gray-400">
                Riders pay this fixed amount per ride regardless of distance or
                time. Surge does not apply.
              </p>
            </>
          ) : (
            <>
              <FareRow label="Base Fare" field="base" value={config.base} onChange={handleField} prefix="₹" />
              <FareRow label="Per Km" field="perKm" value={config.perKm} onChange={handleField} prefix="₹" />
              <FareRow label="Per Minute" field="perMin" value={config.perMin} onChange={handleField} prefix="₹" step={0.1} />
              <FareRow label="Minimum Fare" field="minFare" value={config.minFare} onChange={handleField} prefix="₹" />
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm text-gray-600 shrink-0">Surge Multiplier</label>
                <span className="flex-1 text-sm text-gray-400 py-2">
                  ×1.0 — set via Zones &amp; Surge
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fare Calculator Widget ────────────────────────────────────────────────────

function FareCalculator({
  fareConfigs,
  vehicleTypes,
}: {
  fareConfigs: Record<string, VehicleFareConfig>;
  vehicleTypes: CatalogueType[];
}) {
  const [km, setKm] = useState<number>(5);
  const [minutes, setMinutes] = useState<number>(15);

  const entries = vehicleTypes.map((vt) => ({
    name: vt.name,
    code: vt.code,
    cfg: fareConfigs[vt.code] ?? DEFAULT_CONFIG,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">Fare Calculator</h3>
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Distance (km)</label>
          <NumInput
            min={0}
            step={0.5}
            value={km}
            onChange={setKm}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Duration (minutes)</label>
          <NumInput
            min={0}
            step={1}
            value={minutes}
            onChange={setMinutes}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Estimated Fares
        </div>
        {entries.length === 0 && (
          <div className="text-sm text-gray-400">No vehicle types configured.</div>
        )}
        {entries.map(({ name, code, cfg }) => {
          const fare = calcFare(cfg, km, minutes);
          const isSub = cfg.pricingModel === 'subscription';
          return (
            <div
              key={code}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
            >
              <div>
                <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  {name}
                  {isSub && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">
                      Flat
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{code}</div>
              </div>
              <div className="text-base font-bold text-primary-600">
                ₹{fare.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {entries.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-3">
          Formula: max(Min Fare, Base + Per Km × km + Per Min × min)
          <br />
          (zone surge &amp; surcharges applied at booking time)
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FareCalculationPage() {
  const queryClient = useQueryClient();

  const { data: fareData, isLoading: fareLoading, refetch: refetchFare, isFetching: fareFetching } = useQuery({
    queryKey: ['fare-settings'],
    queryFn: async () => {
      const res = await settingsAPI.getFareConfig();
      return res.data?.data as FareSettings | undefined;
    },
  });

  const { data: vehicleData, isLoading: vtLoading, refetch: refetchVehicles } = useQuery({
    queryKey: ['admin-vehicle-types'],
    queryFn: async () =>
      (await vehicleTypesAPI.list()).data?.data?.types as CatalogueType[] | undefined,
  });

  const vehicleTypes: CatalogueType[] = Array.isArray(vehicleData)
    ? vehicleData.filter((v) => v.isActive)
    : [];

  // Local state mirrors the saved config so the user can edit freely before saving.
  const [localConfig, setLocalConfig] = useState<Record<string, VehicleFareConfig> | null>(null);
  // Platform commission (stored/displayed as a percentage) and cancellation fee.
  // `null` means "not edited yet — show the saved value". Wired to editable
  // inputs and included in the save payload (this is what was previously
  // read-only and silently dropped on save).
  const [commissionPct, setCommissionPct] = useState<number | null>(null);
  const [cancellationFee, setCancellationFee] = useState<number | null>(null);

  // Sync remote → local whenever fareData arrives (and local hasn't been touched yet).
  const baseFares = fareData?.baseFares ?? {};
  const effectiveConfig: Record<string, VehicleFareConfig> = localConfig ?? buildInitialConfig(vehicleTypes, baseFares);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const effectiveCommissionPct =
    commissionPct ?? round2((fareData?.commission ?? 0.2) * 100);
  const effectiveCancellationFee = cancellationFee ?? (fareData?.cancellationFee ?? 50);

  function buildInitialConfig(
    vts: CatalogueType[],
    saved: Record<string, Partial<VehicleFareConfig>>,
  ): Record<string, VehicleFareConfig> {
    const result: Record<string, VehicleFareConfig> = {};
    vts.forEach((vt) => {
      const s = saved[vt.code] ?? {};
      result[vt.code] = {
        pricingModel: s.pricingModel ?? DEFAULT_CONFIG.pricingModel,
        flatFare: s.flatFare ?? DEFAULT_CONFIG.flatFare,
        base: s.base ?? DEFAULT_CONFIG.base,
        perKm: s.perKm ?? DEFAULT_CONFIG.perKm,
        perMin: s.perMin ?? DEFAULT_CONFIG.perMin,
        minFare: s.minFare ?? DEFAULT_CONFIG.minFare,
      };
    });
    return result;
  }

  function handleVehicleChange(code: string, updated: VehicleFareConfig) {
    setLocalConfig((prev) => ({
      ...(prev ?? effectiveConfig),
      [code]: updated,
    }));
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsAPI.updateFareConfig({
        baseFares: effectiveConfig,
        // Commission is sent as a percentage; the backend stores it as a
        // fraction. Cancellation fee is a flat ₹ amount.
        commission: effectiveCommissionPct,
        cancellationFee: effectiveCancellationFee,
      }),
    onSuccess: () => {
      toast.success('Fare configuration saved');
      queryClient.invalidateQueries({ queryKey: ['fare-settings'] });
      setLocalConfig(null);
      setCommissionPct(null);
      setCancellationFee(null);
    },
    onError: () => toast.error('Failed to save fare configuration'),
  });

  function handleReset() {
    setLocalConfig(buildInitialConfig(vehicleTypes, baseFares));
    setCommissionPct(null);
    setCancellationFee(null);
    toast('Reset to saved values', { icon: '↩️' });
  }

  const isLoading = fareLoading || vtLoading;

  return (
    <div>
      <PageHeader
        title="Fare Calculation"
        subtitle="Configure per-km fare rates for each vehicle type and preview live estimates"
        actions={
          <RefreshButton
            onRefresh={() => { refetchFare(); refetchVehicles(); }}
            isFetching={fareFetching}
          />
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: Vehicle fare cards */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Vehicle Type Rates
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({vehicleTypes.length} active types)
                </span>
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saveMutation.isPending}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            {vehicleTypes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <Car className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  No active vehicle types found.{' '}
                  <a href="/vehicle-types" className="text-primary-600 hover:underline">
                    Add vehicle types
                  </a>{' '}
                  first.
                </p>
              </div>
            ) : (
              vehicleTypes.map((vt) => (
                <VehicleCard
                  key={vt._id}
                  name={vt.name}
                  code={vt.code}
                  config={effectiveConfig[vt.code] ?? DEFAULT_CONFIG}
                  onChange={handleVehicleChange}
                />
              ))
            )}

            {/* Global settings card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Global Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Platform Commission (%)
                  </label>
                  <NumInput
                    min={0}
                    max={100}
                    step={1}
                    value={effectiveCommissionPct}
                    onChange={setCommissionPct}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Platform's cut of each fare. Applies on the next ride after saving.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Cancellation Fee (₹)
                  </label>
                  <NumInput
                    min={0}
                    step={5}
                    value={effectiveCancellationFee}
                    onChange={setCancellationFee}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Charged on late cancellations. Applies on the next ride after saving.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live calculator */}
          <div>
            <FareCalculator
              fareConfigs={effectiveConfig}
              vehicleTypes={vehicleTypes}
            />
          </div>
        </div>
      )}
    </div>
  );
}
