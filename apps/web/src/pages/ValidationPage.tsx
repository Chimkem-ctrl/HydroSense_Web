import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ValidationRow, ValidationTolerance } from '@hydrosense/shared';
import { DEFAULT_VALIDATION_TOLERANCES, validateValidationTolerances } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';
import { StatusBadge } from '../components/readings/StatusBadge';

export default function ValidationPage() {
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({ queryKey: ['validation'], queryFn: () => api.listValidationRows() });
  const tolerancesQuery = useQuery({ queryKey: ['validation-tolerances'], queryFn: () => api.getValidationTolerances() });
  const [tolerances, setTolerances] = useState<ValidationTolerance>(DEFAULT_VALIDATION_TOLERANCES);
  const mutation = useMutation({
    mutationFn: () => {
      const issues = validateValidationTolerances(tolerances);
      if (issues.length) throw new Error(issues[0].message);
      return api.updateValidationTolerances(tolerances, userName);
    },
    onSuccess: async (value) => {
      setTolerances(value);
      await queryClient.invalidateQueries({ queryKey: ['validation-tolerances'] });
    },
  });
  useEffect(() => { if (tolerancesQuery.data) setTolerances(tolerancesQuery.data); }, [tolerancesQuery.data]);
  const rows: ValidationRow[] = (rowsQuery.data ?? []).map((row) => {
    const key = row.parameter.toLowerCase().includes('temp') ? 'temperature' : row.parameter.toLowerCase().includes('ph') ? 'ph' : 'do';
    const tolerance = tolerances[key];
    return { ...row, error: Number((row.hydrosenseMean - row.reference).toFixed(3)), pctError: row.reference === 0 ? 0 : Number((Math.abs(row.hydrosenseMean - row.reference) / Math.abs(row.reference) * 100).toFixed(2)), tolerance, pass: Math.abs(row.hydrosenseMean - row.reference) <= tolerance };
  });

  return (
    <div className="stack">
      <PageHeading title="Validation view" description="Compare sensor averages with manual or laboratory references. Tolerances are editable." />
      <StaleQueryState updatedAt={rowsQuery.dataUpdatedAt} />
      <StaleQueryState updatedAt={tolerancesQuery.dataUpdatedAt} />
      {rowsQuery.isLoading || tolerancesQuery.isLoading ? <LoadingState /> : rowsQuery.isError ? <ErrorState error={rowsQuery.error} onRetry={() => void rowsQuery.refetch()} /> : tolerancesQuery.isError ? <ErrorState error={tolerancesQuery.error} onRetry={() => void tolerancesQuery.refetch()} /> : !rows.length ? <EmptyState>No validation comparisons are available.</EmptyState> : (
        <>
          <section className="card stack">
            <h2 className="card-title">Tolerance limits</h2>
            <div className="form-grid">
              <label className="field">Temperature (°C)<input type="number" min="0" step="0.1" value={tolerances.temperature} onChange={(event) => setTolerances((value) => ({ ...value, temperature: Number(event.target.value) }))} /></label>
              <label className="field">pH<input type="number" min="0" step="0.01" value={tolerances.ph} onChange={(event) => setTolerances((value) => ({ ...value, ph: Number(event.target.value) }))} /></label>
              <label className="field">DO (mg/L)<input type="number" min="0" step="0.1" value={tolerances.do} onChange={(event) => setTolerances((value) => ({ ...value, do: Number(event.target.value) }))} /></label>
            </div>
            {mutation.isError && <ErrorState error={mutation.error} />}
            <button type="button" className="button button-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>Save tolerances</button>
          </section>
          <section className="card">
            <div className="table-wrap"><table><thead><tr><th>Parameter</th><th>HydroSense mean</th><th>Reference</th><th>Error</th><th>% error</th><th>Tolerance</th><th>Result</th></tr></thead><tbody>
              {rows.map((row) => <tr key={row.parameter}><td>{row.parameter}</td><td>{row.hydrosenseMean}</td><td>{row.reference}</td><td>{row.error}</td><td>{row.pctError}%</td><td>±{row.tolerance}</td><td><StatusBadge level={row.pass ? 'normal' : 'critical'} label={row.pass ? 'Pass' : 'Fail'} /></td></tr>)}
            </tbody></table></div>
          </section>
        </>
      )}
    </div>
  );
}
