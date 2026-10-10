import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useReportUser } from '@/queries/moderationHooks';
import { AppError } from '@/types';

const reasons = ['HARASSMENT', 'UNAUTHORIZED_PROMOTION', 'ACADEMIC_DISHONESTY', 'IMPERSONATION', 'OTHER'] as const;

export const ReportDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
}> = ({ isOpen, onClose, reportedUserId, reportedUserName }) => {
  const [category, setCategory] = useState<(typeof reasons)[number]>('HARASSMENT');
  const [description, setDescription] = useState('');
  const mutation = useReportUser();

  const submit = () => {
    if (description.length > 500) return;
    mutation.mutate(
      { reportedUserId, category, description },
      { onSuccess: () => setDescription('') }
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Report ${reportedUserName}`}
      description="Reports create a pending moderation receipt. They do not automatically penalize or hide the reported account."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            onClick={submit}
            disabled={description.length > 500 || mutation.isPending || mutation.isSuccess}
            isLoading={mutation.isPending}
          >
            Submit report
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-xs font-medium" htmlFor="report-reason">Reason</label>
        <select
          id="report-reason"
          value={category}
          onChange={(event) => setCategory(event.target.value as (typeof reasons)[number])}
          className="w-full rounded-md border border-craft-border bg-craft-base px-3 py-2 text-xs"
        >
          {reasons.map((reason) => <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>)}
        </select>
        <label className="block text-xs font-medium" htmlFor="report-description">Description (optional)</label>
        <textarea
          id="report-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          rows={4}
          className="w-full rounded-md border border-craft-border bg-craft-base px-3 py-2 text-xs"
          aria-describedby="report-help"
        />
        <p id="report-help" className="text-[11px] text-craft-muted">{description.length}/500 characters. Do not include private contact details.</p>
        {mutation.isError && <p role="alert" className="text-xs text-red-300">{mutation.error instanceof AppError ? mutation.error.message : 'Report failed.'}</p>}
        {mutation.isSuccess && <p role="status" className="text-xs text-emerald-300">Report received. Your identity is not disclosed to the reported user.</p>}
      </div>
    </Dialog>
  );
};
