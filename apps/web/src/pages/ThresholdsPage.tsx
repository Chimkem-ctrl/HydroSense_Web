import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdvisoryRuleSettings, MeasuredParameter, Threshold } from '@hydrosense/shared';
import { DEFAULT_ADVISORY_RULES, validateAdvisoryRules, validateThresholds } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { PageHeading } from '../components/common/PageHeading';
import { ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

const parameterNames: Record<MeasuredParameter, string> = { temperature: 'Temperature (°C)', do: 'Dissolved oxygen (mg/L)', ph: 'pH' };
const parameters: MeasuredParameter[] = ['temperature', 'do', 'ph'];

export default function ThresholdsPage() {
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const thresholdsQuery = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds() });
  const rulesQuery = useQuery({ queryKey: ['advisory-rules'], queryFn: () => api.getAdvisorySettings() });
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [rules, setRules] = useState<AdvisoryRuleSettings>(DEFAULT_ADVISORY_RULES);
  const [confirm, setConfirm] = useState(false);
  const [issue, setIssue] = useState('');
  const [changedAt, setChangedAt] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const [savedThresholds, savedRules] = await Promise.all([
        api.updateThresholds(thresholds, userName),
        api.updateAdvisorySettings(rules, userName),
      ]);
      return { savedThresholds, savedRules };
    },
    onSuccess: async ({ savedThresholds, savedRules }) => {
      setThresholds(savedThresholds);
      setRules(savedRules);
      setChangedAt(new Date().toISOString());
      setConfirm(false);
      await queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      await queryClient.invalidateQueries({ queryKey: ['advisory-rules'] });
      await queryClient.invalidateQueries({ queryKey: ['advisories'] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
  useEffect(() => { if (thresholdsQuery.data) setThresholds(thresholdsQuery.data); }, [thresholdsQuery.data]);
  useEffect(() => { if (rulesQuery.data) setRules(rulesQuery.data); }, [rulesQuery.data]);
  useEffect(() => {
    if (!confirm) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirm(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [confirm]);

  function updateThreshold(parameter: MeasuredParameter, bound: 'min' | 'max', value: string) {
    setThresholds((current) => {
      const existing = current.find((item) => item.parameter === parameter) ?? { parameter };
      const number = value === '' ? undefined : Number(value);
      const updated = { ...existing, [bound]: number };
      return [...current.filter((item) => item.parameter !== parameter), updated];
    });
  }

  function save() {
    const mapped = Object.fromEntries(parameters.map((parameter) => {
      const item = thresholds.find((threshold) => threshold.parameter === parameter);
      return [parameter, { min: item?.min, max: item?.max }];
    })) as Record<MeasuredParameter, { min?: number; max?: number }>;
    const errors = [...validateThresholds(mapped), ...validateAdvisoryRules(rules)];
    if (errors.length) { setIssue(errors[0].message); setConfirm(false); return; }
    setIssue('');
    setConfirm(true);
  }

  if (thresholdsQuery.isLoading || rulesQuery.isLoading) return <LoadingState />;
  if (thresholdsQuery.isError) return <ErrorState error={thresholdsQuery.error} onRetry={() => void thresholdsQuery.refetch()} />;
  if (rulesQuery.isError) return <ErrorState error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} />;

  return (
    <div className="stack">
      <PageHeading title="Thresholds & advisory rules" description="Edit measured-parameter limits and rule settings. Changes apply to display and alerts; they do not control devices." />
      <StaleQueryState updatedAt={thresholdsQuery.dataUpdatedAt} />
      <StaleQueryState updatedAt={rulesQuery.dataUpdatedAt} />
      <section className="card stack">
        <h2 className="card-title">Measured parameter thresholds</h2>
        {parameters.map((parameter) => {
          const item = thresholds.find((threshold) => threshold.parameter === parameter);
          return (
            <div className="threshold-editor" key={parameter}>
              <strong>{parameterNames[parameter]}</strong>
              <label className="field">Minimum<input type="number" step="0.1" value={item?.min ?? ''} onChange={(event) => updateThreshold(parameter, 'min', event.target.value)} /></label>
              <label className="field">Maximum<input type="number" step="0.1" value={item?.max ?? ''} onChange={(event) => updateThreshold(parameter, 'max', event.target.value)} /></label>
            </div>
          );
        })}
      </section>
      <section className="card stack">
        <h2 className="card-title">Rule-based advisories (not sensor readings)</h2>
        <div className="form-grid">
          <label className="field">Salinity watch temperature (°C)<input type="number" value={rules.salinityWatchTemperatureC} onChange={(event) => setRules((current) => ({ ...current, salinityWatchTemperatureC: Number(event.target.value) }))} /></label>
          <label className="field">Salinity high temperature (°C)<input type="number" value={rules.salinityHighTemperatureC} onChange={(event) => setRules((current) => ({ ...current, salinityHighTemperatureC: Number(event.target.value) }))} /></label>
          <label className="field">Ammonia watch temperature (°C)<input type="number" value={rules.ammoniaWatchTemperatureC} onChange={(event) => setRules((current) => ({ ...current, ammoniaWatchTemperatureC: Number(event.target.value) }))} /></label>
          <label className="field">Ammonia high pH<input type="number" value={rules.ammoniaHighPh} onChange={(event) => setRules((current) => ({ ...current, ammoniaHighPh: Number(event.target.value) }))} /></label>
        </div>
        <button type="button" className="button button-primary" onClick={save}>Review and save</button>
        <p className="small muted">Last changed by {userName}{changedAt ? ` · ${new Date(changedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT` : ' · demo defaults'}.</p>
        {issue && <p className="state-error" role="alert">{issue}</p>}
        {mutation.isError && <ErrorState error={mutation.error} />}
      </section>
      {confirm && <div className="dialog-backdrop"><section className="dialog card stack" role="dialog" aria-modal="true" aria-labelledby="confirm-thresholds">
        <h2 id="confirm-thresholds" className="card-title">Confirm rule changes</h2>
        <p>These thresholds change how measured data is labeled and alerts are evaluated. No equipment will be controlled.</p>
        <div className="inline"><button className="button" type="button" onClick={() => setConfirm(false)}>Cancel</button><button className="button button-primary" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Confirm changes</button></div>
      </section></div>}
    </div>
  );
}
