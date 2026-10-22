import { useId, useRef, useState } from 'react'
import { ToneText } from '@/components/Tone'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { VERDICT_LABEL, type StaffingPreview } from '@/domain/preview'
import { firstName, formatRange } from '@/lib/format'

interface CommitDialogProps {
  preview: StaffingPreview
  /**
   * Called with the note once the dialog has fully closed, so the parent can swap content
   * and move focus without Radix returning focus to a trigger that no longer exists.
   */
  onConfirm: (note: string) => void
}

/**
 * Explicit confirmation step. "Needs a decision" requires acknowledging each listed issue;
 * going over 100% additionally requires a written reason. Blocked moves can't open this dialog.
 */
export function CommitDialog({ preview, onConfirm }: CommitDialogProps) {
  const [open, setOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [note, setNote] = useState('')
  /** Set when the user confirmed; consumed after the close animation. */
  const confirmedNote = useRef<string | null>(null)
  const ackId = useId()
  const noteId = useId()
  const noteHintId = useId()

  const decisions = preview.issues.filter((i) => i.severity === 'decision')
  const needsAck = preview.verdict === 'needs-decision'
  const needsReason = preview.issues.some((i) => i.code === 'overallocated')
  const canConfirm = (!needsAck || acknowledged) && (!needsReason || note.trim().length > 0)
  const blocked = preview.verdict === 'blocked'
  const name = firstName(preview.person.name)
  const tentative = preview.proposed.status === 'Tentative'

  function reset() {
    setAcknowledged(false)
    setNote('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" disabled={blocked} className="w-full">
          {blocked
            ? 'Blocked: resolve the issue above first'
            : needsAck
              ? `Review ${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'} and assign ${name}…`
              : `Assign ${name}…`}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          const confirmed = confirmedNote.current
          if (confirmed === null) return // cancelled: let Radix return focus to the trigger
          event.preventDefault()
          confirmedNote.current = null
          onConfirm(confirmed)
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Assign {preview.person.name} to {preview.project?.name}?
          </DialogTitle>
          <DialogDescription>
            {preview.role.level} {preview.role.roleNeeded} at {preview.role.allocationPct}%,{' '}
            {formatRange(preview.role.startDate, preview.role.endDate)}.{' '}
            {tentative
              ? 'This will be recorded as tentative because the project is not won yet.'
              : 'This will be recorded as confirmed work.'}{' '}
            It only changes this browser session; nothing is saved or sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="font-medium">
            Verdict: {VERDICT_LABEL[preview.verdict]}
          </p>
          {decisions.length > 0 && (
            <ul className="space-y-1.5 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
              {decisions.map((issue) => (
                <li key={issue.message}>
                  <ToneText tone="caution">{issue.message}</ToneText>
                </li>
              ))}
            </ul>
          )}
          {preview.released.length > 0 && (
            <p className="text-slate-600">
              The internal commitment will end the day before this role starts. It stays in the record as history.
            </p>
          )}

          {needsAck && (
            <div className="flex items-start gap-2">
              <Checkbox
                id={ackId}
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor={ackId} className="leading-snug font-normal">
                I’ve reviewed {decisions.length === 1 ? 'this issue' : `these ${decisions.length} issues`} and want to
                go ahead.
              </Label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={noteId}>
              {needsReason ? 'Reason for going over 100% (required)' : 'Note for the Delivery Manager (optional)'}
            </Label>
            <Textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-required={needsReason}
              aria-describedby={noteHintId}
              rows={3}
              placeholder={needsReason ? 'e.g. Short overlap agreed with the Claims Dashboard lead' : 'e.g. Starts Nov 16, intro call booked'}
            />
            <p id={noteHintId} className="text-xs text-slate-500">
              Shown next to the assignment so whoever reads it later knows why.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!canConfirm}
            onClick={() => {
              confirmedNote.current = note.trim()
              setOpen(false)
              reset()
            }}
          >
            {tentative ? 'Assign tentatively' : 'Assign'} (local only)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
