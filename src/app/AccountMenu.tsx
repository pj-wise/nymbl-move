import { ChevronDown, RotateCcw, Sparkles } from 'lucide-react'
import { useRef } from 'react'
import { WORKSPACE_LABEL, jobTitleOf, workspacesFor, type AppUser, type Workspace } from '@/auth/permissions'
import type { Session } from '@/auth/useSession'
import { DemoDataTag } from '@/components/Tone'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { demoUsers } from '@/data/demoUsers'
import type { Person } from '@/domain/types'

/** Heading each workspace focuses after a switch, so keyboard users land in the new content. */
const WORKSPACE_HEADING_ID: Record<Workspace, string> = {
  staffing: 'roles-heading',
  delivery: 'delivery-heading',
}

const ACCESS_SUMMARY = (user: AppUser) =>
  workspacesFor(user)
    .map((w) => WORKSPACE_LABEL[w])
    .join(' + ') || 'No access'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface AccountMenuProps {
  session: Session
  people: Map<string, Person>
  onAnnounce: (message: string) => void
  /** Whether there are local staffing changes to clear. */
  canReset: boolean
  onReset: () => void
  /** Synthetic client-fit data (seniority expectations, industry). Null hides the control. */
  demoData: { shown: boolean; onChange: (shown: boolean) => void } | null
}

export function AccountMenu({ session, people, onAnnounce, canReset, onReset, demoData }: AccountMenuProps) {
  const { user, workspace, workspaces } = session
  // Set when a choice changes what's on screen; read when the menu closes.
  const focusTarget = useRef<string | null>(null)
  const workspaceLabel = workspace ? WORKSPACE_LABEL[workspace] : 'No access'

  function switchWorkspace(value: string) {
    const next = value as Workspace
    if (next === workspace) return
    session.switchWorkspace(next)
    focusTarget.current = WORKSPACE_HEADING_ID[next]
    onAnnounce(`Switched to the ${WORKSPACE_LABEL[next]} workspace.`)
  }

  function signInAs(userId: string) {
    if (userId === user.id) return
    const next = demoUsers.find((u) => u.id === userId)
    if (!next) return
    const allowed = workspacesFor(next)
    const landing = workspace && allowed.includes(workspace) ? workspace : allowed[0]
    session.signInAs(userId)
    focusTarget.current = landing ? WORKSPACE_HEADING_ID[landing] : null
    onAnnounce(`Signed in as ${next.name}. ${landing ? `${WORKSPACE_LABEL[landing]} workspace.` : 'No workspace access.'}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${user.name}, ${workspaceLabel} workspace`}
        className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 py-1 pr-2 pl-1 text-left outline-none hover:bg-slate-50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-slate-50"
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white"
        >
          {initials(user.name)}
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-medium text-slate-900">{user.name}</span>
          <span className="block text-[11px] text-slate-500">{workspaceLabel}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72"
        onCloseAutoFocus={(event) => {
          const id = focusTarget.current
          focusTarget.current = null
          if (!id) return
          event.preventDefault()
          requestAnimationFrame(() => document.getElementById(id)?.focus())
        }}
      >
        <div className="px-2 pt-1.5 pb-2">
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{jobTitleOf(user, people)}</p>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          {workspaces.length === 0 ? (
            <p className="px-2 pb-1.5 text-sm text-slate-600">This account has no workspace access.</p>
          ) : (
            <DropdownMenuRadioGroup value={workspace ?? ''} onValueChange={switchWorkspace}>
              {workspaces.map((w) => (
                <DropdownMenuRadioItem key={w} value={w}>
                  {WORKSPACE_LABEL[w]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            Demo sign-in <DemoDataTag />
          </DropdownMenuLabel>
          <p className="px-2 pb-1.5 text-[11px] leading-snug text-slate-500">
            Prototype only, not real authentication. Changes who is signed in; staffing data stays the same.
          </p>
          <DropdownMenuRadioGroup value={user.id} onValueChange={signInAs}>
            {demoUsers.map((u) => (
              <DropdownMenuRadioItem key={u.id} value={u.id} className="items-start">
                <span className="leading-tight">
                  <span className="block">{u.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {ACCESS_SUMMARY(u)}
                    {u.personId === null && ' · mock user, not in dataset'}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        {demoData && (
          <DropdownMenuCheckboxItem
            checked={demoData.shown}
            onCheckedChange={demoData.onChange}
            // Keep the menu open so the change can be seen and undone in place.
            onSelect={(event) => event.preventDefault()}
            className="items-start"
          >
            <Sparkles aria-hidden className="mt-0.5 text-violet-700" />
            <span className="leading-tight">
              <span className="block">Show demo fit data</span>
              <span className="block text-[11px] whitespace-normal text-slate-500">
                Client seniority expectations and industry experience. Added for the demo, not in the supplied data.
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuItem disabled={!canReset} onSelect={onReset} className="items-start">
          <RotateCcw aria-hidden className="mt-0.5 text-slate-500" />
          <span className="leading-tight">
            <span className="block">Reset demo</span>
            <span className="block text-[11px] text-slate-500">
              {canReset ? 'Clear assignments made in this tab' : 'Nothing to reset yet'}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
